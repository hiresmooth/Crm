export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = dateTo ? new Date(dateTo) : new Date();

  const [leads, estimates, proposalsSent, jobsWon, bookedRevenue] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.estimate.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.proposal.count({
      where: { sentAt: { gte: from, lte: to }, status: { in: ['sent', 'viewed', 'client_approved'] } },
    }),
    prisma.proposal.count({
      where: { clientApprovedAt: { gte: from, lte: to } },
    }),
    prisma.job.aggregate({
      _sum: { contractAmount: true },
      where: { createdAt: { gte: from, lte: to } },
    }),
  ]);

  const projected = await prisma.proposal.aggregate({
    _sum: { approvedAmount: true },
    where: {
      status: { in: ['sent', 'viewed', 'internal_approved'] },
      clientApprovedAt: null,
    },
  });

  const wonEstimates = await prisma.estimate.aggregate({
    _avg: { grossMarginPct: true, roundedPrice: true },
    where: {
      proposals: { some: { status: 'client_approved' } },
      createdAt: { gte: from, lte: to },
    },
  });

  const closeRate = proposalsSent > 0 ? jobsWon / proposalsSent : 0;
  const avgJob = wonEstimates._avg.roundedPrice ? Number(wonEstimates._avg.roundedPrice) : 0;

  return apiSuccess({
    kpis: {
      leads: { count: leads },
      estimates_requested: { count: estimates },
      proposals_sent: { count: proposalsSent },
      jobs_won: { count: jobsWon },
      close_rate: { value: closeRate },
      projected_revenue: { amount: Number(projected._sum.approvedAmount ?? 0) },
      booked_revenue: { amount: Number(bookedRevenue._sum.contractAmount ?? 0) },
      average_job_size: { amount: avgJob },
      average_gross_margin: { value: Number(wonEstimates._avg.grossMarginPct ?? 0) },
    },
    filters_applied: { date_from: from.toISOString(), date_to: to.toISOString() },
  });
}
