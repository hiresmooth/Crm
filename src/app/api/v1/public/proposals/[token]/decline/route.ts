export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/events';
import { apiError } from '@/lib/api';

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  const body = await request.json().catch(() => ({}));
  const proposal = await prisma.proposal.findUnique({
    where: { viewToken: params.token },
    include: { estimate: { include: { lead: { include: { client: true } } } } },
  });

  if (!proposal) return apiError([{ code: 'NOT_FOUND', message: 'Proposal not found' }], 404);
  if (!['sent', 'viewed'].includes(proposal.status)) {
    return apiError([{ code: 'INVALID_STATUS', message: 'Cannot decline this proposal' }], 422);
  }

  await prisma.proposal.update({
    where: { id: proposal.id },
    data: {
      status: 'client_declined',
      clientDeclinedAt: new Date(),
      declineReason: body.reason ?? 'No reason provided',
    },
  });

  await prisma.lead.update({
    where: { id: proposal.estimate.leadId },
    data: { stage: 'lost', lostReason: body.reason },
  });

  await emitEvent({
    eventType: 'proposal_client_declined',
    leadId: proposal.estimate.leadId,
    proposalId: proposal.id,
    payload: { reason: body.reason },
    crmPayload: {
      proposal_id: proposal.id,
      proposal_number: proposal.proposalNumber,
      decline_reason: body.reason,
    },
  });

  return Response.json({ success: true });
}
