export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

const patchSchema = z.object({
  scope_json: z.object({
    project_summary: z.string().optional(),
    scope_of_work: z.array(z.object({ heading: z.string(), bullets: z.array(z.string()) })).optional(),
    assumptions: z.array(z.string()).optional(),
    exclusions: z.array(z.string()).optional(),
  }).optional(),
  deposit_pct: z.number().min(0.1).max(1).optional(),
  schedule: z.object({
    start_window: z.string(),
    duration_days: z.number().int(),
  }).optional(),
  terms_template_id: z.string().uuid().optional(),
  regenerate_scope_ai: z.boolean().default(false),
});

export async function PATCH(
  request: Request,
  { params }: { params: { proposalId: string } }
) {
  requireAuth(await getSession());
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError(parsed.error.errors.map((e) => ({ code: 'VALIDATION_ERROR', field: e.path.join('.'), message: e.message })));
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: params.proposalId },
    include: { estimate: { include: { lineItems: { include: { product: true }, orderBy: { sortOrder: 'asc' } }, lead: { include: { client: true } } } } },
  });
  if (!proposal) return apiError([{ code: 'NOT_FOUND', message: 'Proposal not found' }], 404);
  if (!['draft', 'internal_review'].includes(proposal.status)) {
    return apiError([{ code: 'IMMUTABLE', message: 'Cannot edit sent proposals' }], 422);
  }

  const data = parsed.data;
  let scopeJson = data.scope_json;

  if (data.regenerate_scope_ai) {
    const { generateProposalScopeWithAi } = await import('@/lib/ai/proposal-writer');
    const scopeResult = await generateProposalScopeWithAi(proposal.estimate, data.schedule);
    const { _source, ...scope } = scopeResult as typeof scopeResult & { _source?: string };
    scopeJson = scope;
  }

  const approvedAmount = Number(proposal.approvedAmount ?? proposal.estimate.roundedPrice ?? 0);
  const depositPct = data.deposit_pct ?? Number(proposal.depositPct);
  const depositAmount = Math.round(approvedAmount * depositPct * 100) / 100;

  const updated = await prisma.proposal.update({
    where: { id: proposal.id },
    data: {
      ...(scopeJson ? { scopeJson: scopeJson as object, assumptionsJson: scopeJson.assumptions as object, exclusionsJson: scopeJson.exclusions as object } : {}),
      ...(data.deposit_pct !== undefined ? { depositPct, depositAmount } : {}),
      ...(data.schedule ? { scheduleStartWindow: data.schedule.start_window, scheduleDurationDays: data.schedule.duration_days } : {}),
      ...(data.terms_template_id ? { termsTemplateId: data.terms_template_id } : {}),
    },
  });

  return apiSuccess(updated);
}
