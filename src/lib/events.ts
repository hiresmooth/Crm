import type { ActivityEventType, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { dispatchCrmEvent } from './crm';

export async function emitEvent(opts: {
  eventType: ActivityEventType;
  leadId?: string;
  estimateId?: string;
  proposalId?: string;
  jobId?: string;
  clientId?: string;
  userId?: string;
  payload?: Record<string, unknown>;
  crmPayload?: Record<string, unknown>;
}) {
  await prisma.activityLog.create({
    data: {
      eventType: opts.eventType,
      leadId: opts.leadId,
      estimateId: opts.estimateId,
      proposalId: opts.proposalId,
      jobId: opts.jobId,
      clientId: opts.clientId,
      userId: opts.userId,
      payload: (opts.payload ?? {}) as Prisma.InputJsonValue,
    },
  });

  const crmEvent = mapToCrmEvent(opts.eventType);
  if (crmEvent && opts.crmPayload) {
    await dispatchCrmEvent(crmEvent, opts.crmPayload);
  }
}

function mapToCrmEvent(type: ActivityEventType): string | null {
  const map: Partial<Record<ActivityEventType, string>> = {
    lead_created: 'lead.created',
    estimate_created: 'estimate.summary',
    estimate_approved: 'estimate.summary',
    proposal_sent: 'proposal.sent',
    proposal_client_approved: 'proposal.approved',
    proposal_client_declined: 'proposal.declined',
    job_created: 'job.created',
  };
  return map[type] ?? null;
}
