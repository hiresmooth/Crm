import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api';
import { redirect } from 'next/navigation';

export async function POST(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const proposal = await prisma.proposal.findUnique({
    where: { viewToken: params.token },
    include: { estimate: true },
  });

  if (!proposal) return apiError([{ code: 'NOT_FOUND', message: 'Proposal not found' }], 404);
  if (!['sent', 'viewed'].includes(proposal.status)) {
    return apiError([{ code: 'INVALID_STATUS', message: 'Cannot approve this proposal' }], 422);
  }

  const jobCount = await prisma.job.count();
  const jobNumber = `J-${new Date().getFullYear()}-${String(jobCount + 1).padStart(5, '0')}`;

  const job = await prisma.job.create({
    data: {
      jobNumber,
      proposalId: proposal.id,
      leadId: proposal.estimate.leadId,
      clientId: proposal.estimate.clientId,
      contractAmount: proposal.approvedAmount ?? 0,
      grossMarginPctAtSale: proposal.estimate.grossMarginPct,
      projectAddress: {
        street: proposal.estimate.projectStreet,
        city: proposal.estimate.projectCity,
        state: proposal.estimate.projectState,
        zip: proposal.estimate.projectZip,
      },
    },
  });

  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { status: 'client_approved', clientApprovedAt: new Date() },
  });

  await prisma.lead.update({
    where: { id: proposal.estimate.leadId },
    data: { stage: 'won' },
  });

  await prisma.client.update({
    where: { id: proposal.estimate.clientId },
    data: { jobsCount: { increment: 1 }, lifetimeRevenue: { increment: Number(proposal.approvedAmount ?? 0) } },
  });

  await prisma.activityLog.create({
    data: {
      eventType: 'proposal_client_approved',
      leadId: proposal.estimate.leadId,
      proposalId: proposal.id,
      jobId: job.id,
      payload: { job_number: jobNumber },
    },
  });

  redirect(`/proposals/view/${params.token}?approved=1`);
}
