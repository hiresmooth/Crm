import { apiError, apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function POST(
  _request: Request,
  { params }: { params: { proposalId: string } }
) {
  const proposal = await prisma.proposal.findUnique({ where: { id: params.proposalId } });
  if (!proposal) return apiError([{ code: 'NOT_FOUND', message: 'Proposal not found' }], 404);

  const manager = await prisma.user.findFirst({ where: { role: { in: ['manager', 'admin'] } } });

  const updated = await prisma.proposal.update({
    where: { id: proposal.id },
    data: {
      status: 'internal_approved',
      internalApprovedAt: new Date(),
      internalApprovedBy: manager?.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      eventType: 'proposal_internal_approved',
      proposalId: proposal.id,
      estimateId: proposal.estimateId,
      userId: manager?.id,
    },
  });

  return apiSuccess({ proposal_id: updated.id, status: updated.status });
}
