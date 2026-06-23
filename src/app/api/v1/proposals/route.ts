import { z } from 'zod';
import { apiError, apiSuccess, nextNumber } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { generateProposalScope } from '@/lib/proposal-scope';

const proposalSchema = z.object({
  estimate_id: z.string().uuid(),
  terms_template_id: z.string().uuid().optional(),
  deposit_pct: z.number().min(0.1).max(1).default(0.5),
  is_preliminary: z.boolean().default(false),
  schedule: z.object({
    start_window: z.string().default('2–3 weeks from deposit receipt'),
    duration_days: z.number().int().default(2),
  }).optional(),
  generate_scope_ai: z.boolean().default(true),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = proposalSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.errors.map((e) => ({
        code: 'VALIDATION_ERROR',
        field: e.path.join('.'),
        message: e.message,
      }))
    );
  }

  const data = parsed.data;
  const estimate = await prisma.estimate.findUnique({
    where: { id: data.estimate_id },
    include: {
      lineItems: { include: { product: true }, orderBy: { sortOrder: 'asc' } },
      lead: { include: { client: true } },
    },
  });

  if (!estimate) return apiError([{ code: 'NOT_FOUND', message: 'Estimate not found' }], 404);
  if (estimate.status !== 'approved') {
    return apiError([{ code: 'NOT_APPROVED', message: 'Estimate must be approved' }], 422);
  }

  const terms = data.terms_template_id
    ? await prisma.termsTemplate.findUnique({ where: { id: data.terms_template_id } })
    : await prisma.termsTemplate.findFirst({ where: { isDefault: true, active: true } });

  const approvedAmount = Number(estimate.roundedPrice ?? 0);
  const depositAmount = Math.round(approvedAmount * data.deposit_pct * 100) / 100;

  const scopeJson = data.generate_scope_ai
    ? generateProposalScope(estimate)
    : { project_summary: '', scope_of_work: [], assumptions: [], exclusions: [] };

  const count = await prisma.proposal.count();
  const proposalNumber = nextNumber('SCS', count + 1).replace('SCS-', 'SCS-');
  const viewToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  const proposal = await prisma.proposal.create({
    data: {
      proposalNumber: `SCS-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`,
      estimateId: estimate.id,
      status: 'draft',
      isPreliminary: data.is_preliminary,
      depositPct: data.deposit_pct,
      depositAmount,
      approvedAmount,
      scopeJson: scopeJson as object,
      assumptionsJson: scopeJson.assumptions as object,
      exclusionsJson: scopeJson.exclusions as object,
      scheduleStartWindow: data.schedule?.start_window ?? '2–3 weeks from deposit receipt',
      scheduleDurationDays: data.schedule?.duration_days ?? 2,
      termsTemplateId: terms?.id,
      viewToken,
      expiresAt: estimate.validUntil,
    },
  });

  await prisma.activityLog.create({
    data: {
      eventType: 'proposal_created',
      leadId: estimate.leadId,
      estimateId: estimate.id,
      proposalId: proposal.id,
      payload: { proposal_number: proposal.proposalNumber },
    },
  });

  return apiSuccess(
    {
      proposal_id: proposal.id,
      proposal_number: proposal.proposalNumber,
      version: proposal.version,
      status: proposal.status,
      approved_amount: approvedAmount,
      deposit_amount: depositAmount,
      scope_json: scopeJson,
      pdf_url: null,
    },
    201
  );
}

export async function GET() {
  const proposals = await prisma.proposal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      estimate: {
        include: { lead: { include: { client: true } } },
      },
    },
  });
  return apiSuccess(proposals);
}
