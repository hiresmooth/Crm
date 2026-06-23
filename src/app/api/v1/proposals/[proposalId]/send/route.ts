import { apiError, apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/events';
import { sendProposalEmail } from '@/lib/email';
import { getSession } from '@/lib/auth';
import { canSendProposals } from '@/lib/permissions';

export async function POST(
  request: Request,
  { params }: { params: { proposalId: string } }
) {
  const session = await getSession();
  if (!canSendProposals(session)) {
    return apiError([{ code: 'FORBIDDEN', message: 'Cannot send proposals' }], 403);
  }

  const body = await request.json().catch(() => ({}));
  const proposal = await prisma.proposal.findUnique({
    where: { id: params.proposalId },
    include: { estimate: { include: { lead: { include: { client: true } } } } },
  });

  if (!proposal) return apiError([{ code: 'NOT_FOUND', message: 'Proposal not found' }], 404);
  if (proposal.status !== 'internal_approved') {
    return apiError([{ code: 'NOT_APPROVED', message: 'Proposal must be internally approved' }], 422);
  }
  if (!proposal.pdfUrl) {
    return apiError([{ code: 'NO_PDF', message: 'Generate PDF before sending' }], 422);
  }

  const toEmail = body.to_email ?? proposal.estimate.lead.client.email;
  if (!toEmail) return apiError([{ code: 'NO_EMAIL', message: 'Client email required' }], 422);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const clientViewUrl = `${baseUrl}/proposals/view/${proposal.viewToken}`;

  const pdfBase64 = proposal.pdfUrl.startsWith('data:')
    ? proposal.pdfUrl.split(',')[1]
    : undefined;

  await sendProposalEmail({
    to: toEmail,
    cc: body.cc_emails,
    subject: body.subject ?? `Your Smooth Construction Services Proposal — ${proposal.proposalNumber}`,
    html: `<p>Hi ${proposal.estimate.lead.client.firstName},</p><p>Please review your proposal: <a href="${clientViewUrl}">${clientViewUrl}</a></p><p>— Smooth Construction Services</p>`,
    pdfBase64,
    pdfFilename: `${proposal.proposalNumber}.pdf`,
  }).catch((e) => console.error('Email error:', e));

  const updated = await prisma.proposal.update({
    where: { id: proposal.id },
    data: {
      status: 'sent',
      sentAt: new Date(),
      sentByUserId: session?.id,
    },
  });

  await prisma.lead.update({
    where: { id: proposal.estimate.leadId },
    data: { stage: 'proposal_sent' },
  });

  await emitEvent({
    eventType: 'proposal_sent',
    leadId: proposal.estimate.leadId,
    estimateId: proposal.estimateId,
    proposalId: proposal.id,
    userId: session?.id,
    payload: { to_email: toEmail },
    crmPayload: {
      proposal_id: proposal.id,
      proposal_number: proposal.proposalNumber,
      lead_id: proposal.estimate.leadId,
      client_email: toEmail,
      approved_amount: Number(proposal.approvedAmount),
      deposit_amount: Number(proposal.depositAmount),
      client_view_url: clientViewUrl,
      expires_at: proposal.expiresAt,
    },
  });

  return apiSuccess({
    proposal_id: updated.id,
    status: updated.status,
    sent_at: updated.sentAt,
    view_token: updated.viewToken,
    client_view_url: clientViewUrl,
  });
}
