import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api';
import { emitEvent } from '@/lib/events';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const schema = z.object({
  signer_name: z.string().min(1),
  accepted_terms: z.literal(true),
  signature_data: z.object({ type: z.string(), value: z.string() }),
});

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError([{ code: 'VALIDATION_ERROR', message: 'Signature and terms required' }], 400);
  }

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
    data: {
      status: 'client_approved',
      clientApprovedAt: new Date(),
      signatureData: parsed.data.signature_data as object,
    },
  });

  await prisma.lead.update({
    where: { id: proposal.estimate.leadId },
    data: { stage: 'won' },
  });

  await prisma.client.update({
    where: { id: proposal.estimate.clientId },
    data: {
      jobsCount: { increment: 1 },
      lifetimeRevenue: { increment: Number(proposal.approvedAmount ?? 0) },
    },
  });

  await emitEvent({
    eventType: 'proposal_client_approved',
    leadId: proposal.estimate.leadId,
    proposalId: proposal.id,
    jobId: job.id,
    clientId: proposal.estimate.clientId,
    payload: { job_number: jobNumber, signer: parsed.data.signer_name },
    crmPayload: {
      proposal_id: proposal.id,
      proposal_number: proposal.proposalNumber,
      lead_id: proposal.estimate.leadId,
      approved_amount: Number(proposal.approvedAmount),
      deposit_amount: Number(proposal.depositAmount),
      job_id: job.id,
      job_number: jobNumber,
      client_approved_at: new Date().toISOString(),
    },
  });

  await emitEvent({
    eventType: 'job_created',
    jobId: job.id,
    leadId: proposal.estimate.leadId,
    crmPayload: {
      job_id: job.id,
      job_number: jobNumber,
      contract_amount: Number(proposal.approvedAmount),
    },
  });

  return apiSuccess({
    proposal_id: proposal.id,
    status: 'client_approved',
    job_id: job.id,
    job_number: jobNumber,
  });
}
