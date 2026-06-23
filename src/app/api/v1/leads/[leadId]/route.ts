export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

const patchSchema = z.object({
  stage: z.enum([
    'new_lead', 'contacted', 'estimate_in_progress', 'proposal_sent',
    'follow_up_needed', 'won', 'lost',
  ]).optional(),
  assigned_sales_user_id: z.string().uuid().optional().nullable(),
  assigned_estimator_user_id: z.string().uuid().optional().nullable(),
  estimated_value: z.number().optional(),
  description: z.string().optional(),
  follow_up_at: z.string().optional().nullable(),
  lost_reason: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: { leadId: string } }
) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    include: {
      client: true,
      estimates: { orderBy: { createdAt: 'desc' } },
      activityLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
      assignedSales: { select: { firstName: true, lastName: true } },
      assignedEstimator: { select: { firstName: true, lastName: true } },
    },
  });

  if (!lead) {
    return Response.json({ success: false, errors: [{ code: 'NOT_FOUND', message: 'Lead not found' }] }, { status: 404 });
  }

  const proposals = await prisma.proposal.findMany({
    where: { estimate: { leadId: lead.id } },
    orderBy: { createdAt: 'desc' },
  });

  const documents = await prisma.document.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: 'desc' },
  });

  return apiSuccess({ ...lead, proposals, documents });
}

export async function PATCH(
  request: Request,
  { params }: { params: { leadId: string } }
) {
  const session = requireAuth(await getSession());
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError(parsed.error.errors.map((e) => ({
      code: 'VALIDATION_ERROR',
      field: e.path.join('.'),
      message: e.message,
    })));
  }

  const lead = await prisma.lead.findUnique({ where: { id: params.leadId } });
  if (!lead) return apiError([{ code: 'NOT_FOUND', message: 'Lead not found' }], 404);

  const data = parsed.data;
  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      ...(data.stage !== undefined ? { stage: data.stage } : {}),
      ...(data.assigned_sales_user_id !== undefined ? { assignedSalesUserId: data.assigned_sales_user_id } : {}),
      ...(data.assigned_estimator_user_id !== undefined ? { assignedEstimatorUserId: data.assigned_estimator_user_id } : {}),
      ...(data.estimated_value !== undefined ? { estimatedValue: data.estimated_value } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.follow_up_at !== undefined ? { followUpAt: data.follow_up_at ? new Date(data.follow_up_at) : null } : {}),
      ...(data.lost_reason !== undefined ? { lostReason: data.lost_reason } : {}),
    },
    include: { client: true },
  });

  await emitEvent({
    eventType: data.stage ? 'lead_stage_changed' : 'lead_updated',
    leadId: lead.id,
    userId: session.id,
    payload: { stage: data.stage, updated_by: session.email },
  });

  return apiSuccess(updated);
}
