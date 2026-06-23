export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { apiError, apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function POST(
  _request: Request,
  { params }: { params: { estimateId: string } }
) {
  const estimate = await prisma.estimate.findUnique({
    where: { id: params.estimateId },
    include: { lineItems: true },
  });

  if (!estimate) return apiError([{ code: 'NOT_FOUND', message: 'Estimate not found' }], 404);
  if (!['draft', 'revision_requested'].includes(estimate.status)) {
    return apiError([{ code: 'INVALID_STATUS', message: `Cannot submit from status ${estimate.status}` }], 422);
  }
  if (estimate.lineItems.length === 0) {
    return apiError([{ code: 'NO_LINES', message: 'Estimate must have line items' }], 422);
  }

  const updated = await prisma.estimate.update({
    where: { id: estimate.id },
    data: { status: 'in_review' },
  });

  await prisma.activityLog.create({
    data: {
      eventType: 'estimate_submitted',
      leadId: estimate.leadId,
      estimateId: estimate.id,
      payload: {
        approval_required: estimate.approvalRequired,
        margin_status: estimate.marginStatus,
      },
    },
  });

  return apiSuccess({
    estimate_id: updated.id,
    status: updated.status,
    approval_required: estimate.approvalRequired,
    margin_status: estimate.marginStatus,
  });
}
