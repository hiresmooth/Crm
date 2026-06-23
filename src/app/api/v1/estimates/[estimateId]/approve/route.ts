import { apiError, apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: { estimateId: string } }
) {
  const body = await request.json().catch(() => ({}));
  const estimate = await prisma.estimate.findUnique({ where: { id: params.estimateId } });

  if (!estimate) return apiError([{ code: 'NOT_FOUND', message: 'Estimate not found' }], 404);
  if (estimate.status !== 'in_review') {
    return apiError([{ code: 'INVALID_STATUS', message: 'Estimate must be in_review' }], 422);
  }

  const manager = await prisma.user.findFirst({ where: { role: { in: ['manager', 'admin'] }, isActive: true } });

  const updated = await prisma.estimate.update({
    where: { id: estimate.id },
    data: {
      status: 'approved',
      approvedAt: new Date(),
      approvedByUserId: manager?.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      eventType: 'estimate_approved',
      leadId: estimate.leadId,
      estimateId: estimate.id,
      userId: manager?.id,
      payload: { notes: body.notes ?? null },
    },
  });

  return apiSuccess({
    estimate_id: updated.id,
    status: updated.status,
    approved_at: updated.approvedAt,
  });
}
