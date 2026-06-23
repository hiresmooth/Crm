import { prisma } from '../prisma';
import { differenceInDays } from 'date-fns';

export async function runAlertEngine() {
  const created: string[] = [];
  const now = new Date();

  const staleLeads = await prisma.lead.findMany({
    where: {
      stage: 'new_lead',
      createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
  });
  for (const lead of staleLeads) {
    const id = await upsertAlert({
      alertType: 'stale_lead',
      severity: 'warning',
      leadId: lead.id,
      message: `No contact in 24h: ${lead.leadNumber}`,
      assignedUserId: lead.assignedSalesUserId,
    });
    if (id) created.push(id);
  }

  const viewedProposals = await prisma.proposal.findMany({
    where: {
      status: 'viewed',
      viewedAt: { lt: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      clientApprovedAt: null,
      clientDeclinedAt: null,
    },
    include: { estimate: true },
  });
  for (const p of viewedProposals) {
    const id = await upsertAlert({
      alertType: 'proposal_viewed_no_answer',
      severity: 'warning',
      proposalId: p.id,
      leadId: p.estimate.leadId,
      message: `Proposal viewed, no response: ${p.proposalNumber}`,
    });
    if (id) created.push(id);
  }

  const lowMargin = await prisma.estimate.findMany({
    where: {
      status: 'in_review',
      marginStatus: { in: ['yellow', 'red'] },
    },
  });
  for (const e of lowMargin) {
    const id = await upsertAlert({
      alertType: 'low_margin_estimate',
      severity: e.marginStatus === 'red' ? 'critical' : 'warning',
      estimateId: e.id,
      leadId: e.leadId,
      message: `Low margin estimate ${e.estimateNumber}: ${e.marginStatus}`,
    });
    if (id) created.push(id);
  }

  const highValueLeads = await prisma.lead.findMany({
    where: {
      estimatedValue: { gte: 25000 },
      stage: { notIn: ['won', 'lost'] },
    },
  });
  for (const lead of highValueLeads) {
    const id = await upsertAlert({
      alertType: 'high_value_lead',
      severity: 'info',
      leadId: lead.id,
      message: `High-value lead ${lead.leadNumber}: $${Number(lead.estimatedValue).toLocaleString()}`,
      assignedUserId: lead.assignedSalesUserId,
    });
    if (id) created.push(id);
  }

  const repeatClients = await prisma.lead.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
    include: { client: true },
  });
  for (const lead of repeatClients.filter((l) => l.client.jobsCount > 0)) {
    const id = await upsertAlert({
      alertType: 'repeat_client',
      severity: 'info',
      leadId: lead.id,
      message: `Repeat client lead: ${lead.client.firstName} ${lead.client.lastName}`,
    });
    if (id) created.push(id);
  }

  const followUpLeads = await prisma.lead.findMany({
    where: { stage: { in: ['proposal_sent', 'follow_up_needed'] } },
  });
  for (const lead of followUpLeads) {
    const days = differenceInDays(now, lead.stageEnteredAt);
    if (days >= 3) {
      const id = await upsertAlert({
        alertType: 'follow_up_overdue',
        severity: 'critical',
        leadId: lead.id,
        message: `Follow-up overdue ${days} days: ${lead.leadNumber}`,
        assignedUserId: lead.assignedSalesUserId,
      });
      if (id) created.push(id);
    }
  }

  const recentLeads = await prisma.lead.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - 15 * 60 * 1000) } },
  });
  for (const lead of recentLeads) {
    const existing = await prisma.alert.findFirst({
      where: { leadId: lead.id, alertType: 'new_lead', createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
    });
    if (!existing) {
      const alert = await prisma.alert.create({
        data: {
          alertType: 'new_lead',
          severity: 'info',
          leadId: lead.id,
          message: `New lead: ${lead.leadNumber} from ${lead.source}`,
          assignedUserId: lead.assignedSalesUserId,
        },
      });
      created.push(alert.id);
    }
  }

  return { created: created.length };
}

async function upsertAlert(data: {
  alertType: string;
  severity: string;
  message: string;
  leadId?: string;
  estimateId?: string;
  proposalId?: string;
  assignedUserId?: string | null;
}): Promise<string | null> {
  const existing = await prisma.alert.findFirst({
    where: {
      alertType: data.alertType,
      isDismissed: false,
      leadId: data.leadId ?? undefined,
      estimateId: data.estimateId ?? undefined,
      proposalId: data.proposalId ?? undefined,
    },
  });
  if (existing) return null;

  const alert = await prisma.alert.create({ data });
  return alert.id;
}

export async function getAlerts(opts: { assignedUserId?: string; unreadOnly?: boolean }) {
  return prisma.alert.findMany({
    where: {
      isDismissed: false,
      ...(opts.unreadOnly ? { isRead: false } : {}),
      ...(opts.assignedUserId ? { assignedUserId: opts.assignedUserId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { lead: true, proposal: true },
  });
}
