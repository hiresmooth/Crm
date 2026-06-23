import { apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { ServiceCode } from '@prisma/client';

const SERVICES = Object.values(ServiceCode);

export async function GET() {
  const services = await Promise.all(
    SERVICES.map(async (service_code) => {
      const leads = await prisma.lead.count({ where: { serviceType: service_code } });
      const estimates = await prisma.estimate.findMany({ where: { serviceType: service_code } });
      const won = await prisma.proposal.count({
        where: { status: 'client_approved', estimate: { serviceType: service_code } },
      });
      const sent = await prisma.proposal.count({
        where: { status: { in: ['sent', 'viewed', 'client_approved', 'client_declined'] }, estimate: { serviceType: service_code } },
      });
      const revenue = await prisma.job.aggregate({
        _sum: { contractAmount: true },
        where: { lead: { serviceType: service_code } },
      });
      const margins = estimates.filter((e) => e.grossMarginPct).map((e) => Number(e.grossMarginPct));
      const values = estimates.filter((e) => e.roundedPrice).map((e) => Number(e.roundedPrice));

      return {
        service_code,
        leads,
        revenue: Number(revenue._sum.contractAmount ?? 0),
        win_rate: sent > 0 ? won / sent : 0,
        avg_margin: margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0,
        avg_estimate_value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      };
    })
  );

  return apiSuccess({ services: services.filter((s) => s.leads > 0 || s.revenue > 0) });
}
