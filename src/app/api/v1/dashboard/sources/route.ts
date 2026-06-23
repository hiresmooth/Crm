export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { LeadSource } from '@prisma/client';

const SOURCES = Object.values(LeadSource);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('date_from');
  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const sources = await Promise.all(
    SOURCES.map(async (source) => {
      const leads = await prisma.lead.count({ where: { source, createdAt: { gte: from } } });
      const estimates = await prisma.estimate.count({ where: { lead: { source }, createdAt: { gte: from } } });
      const approvals = await prisma.proposal.count({
        where: { status: 'client_approved', estimate: { lead: { source } }, clientApprovedAt: { gte: from } },
      });
      const revenue = await prisma.job.aggregate({
        _sum: { contractAmount: true },
        where: { lead: { source }, createdAt: { gte: from } },
      });
      const adSpend = await prisma.marketingAdSpend.aggregate({
        _sum: { amount: true },
        where: { source, periodStart: { gte: from } },
      });
      const spend = Number(adSpend._sum.amount ?? 0);

      return {
        source,
        leads,
        estimates,
        approvals,
        revenue: Number(revenue._sum.contractAmount ?? 0),
        conversion_rate: leads > 0 ? approvals / leads : 0,
        ad_spend: spend,
        cost_per_lead: leads > 0 && spend > 0 ? spend / leads : null,
      };
    })
  );

  return apiSuccess({ sources: sources.filter((s) => s.leads > 0) });
}
