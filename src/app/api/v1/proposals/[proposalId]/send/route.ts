import { apiError, apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: { proposalId: string } }
) {
  const body = await request.json().catch(() => ({}));
  const proposal = await prisma.proposal.findUnique({
    where: { id: params.proposalId },
    include: { estimate: true },
  });

  if (!proposal) return apiError([{ code: 'NOT_FOUND', message: 'Proposal not found' }], 404);
  if (proposal.status !== 'internal_approved') {
    return apiError([{ code: 'NOT_APPROVED', message: 'Proposal must be internally approved' }], 422);
  }
  if (!proposal.pdfUrl) {
    return apiError([{ code: 'NO_PDF', message: 'Generate PDF before sending' }], 422);
  }

  const sales = await prisma.user.findFirst({ where: { role: { in: ['sales', 'manager', 'admin'] } } });

  const updated = await prisma.proposal.update({
    where: { id: proposal.id },
    data: {
      status: 'sent',
      sentAt: new Date(),
      sentByUserId: sales?.id,
    },
  });

  await prisma.lead.update({
    where: { id: proposal.estimate.leadId },
    data: { stage: 'proposal_sent' },
  });

  await prisma.activityLog.create({
    data: {
      eventType: 'proposal_sent',
      leadId: proposal.estimate.leadId,
      estimateId: proposal.estimateId,
      proposalId: proposal.id,
      userId: sales?.id,
      payload: { to_email: body.to_email },
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return apiSuccess({
    proposal_id: updated.id,
    status: updated.status,
    sent_at: updated.sentAt,
    view_token: updated.viewToken,
    client_view_url: `${baseUrl}/proposals/view/${updated.viewToken}`,
  });
}
