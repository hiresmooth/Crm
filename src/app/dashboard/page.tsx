import { Card, formatCurrency, KpiCard } from '@/components/AppShell';
import { prisma } from '@/lib/prisma';

async function getKpis() {
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [leads, estimates, proposalsSent, jobsWon, booked, projected] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: from } } }),
    prisma.estimate.count({ where: { createdAt: { gte: from } } }),
    prisma.proposal.count({ where: { sentAt: { gte: from } } }),
    prisma.proposal.count({ where: { clientApprovedAt: { gte: from } } }),
    prisma.job.aggregate({ _sum: { contractAmount: true }, where: { createdAt: { gte: from } } }),
    prisma.proposal.aggregate({
      _sum: { approvedAmount: true },
      where: { status: { in: ['sent', 'viewed', 'internal_approved'] }, clientApprovedAt: null },
    }),
  ]);

  const closeRate = proposalsSent > 0 ? ((jobsWon / proposalsSent) * 100).toFixed(1) : '0';

  return { leads, estimates, proposalsSent, jobsWon, booked, projected, closeRate };
}

export default async function DashboardPage() {
  let leads = 0;
  let estimates = 0;
  let proposalsSent = 0;
  let jobsWon = 0;
  let closeRate = '0';
  let projectedAmount = 0;
  let bookedAmount = 0;
  let recentLeads: Awaited<ReturnType<typeof prisma.lead.findMany<{ include: { client: true } }>>> = [];
  let pipeline: { stage: string; count: number }[] = [];

  try {
    const kpis = await getKpis();
    leads = kpis.leads;
    estimates = kpis.estimates;
    proposalsSent = kpis.proposalsSent;
    jobsWon = kpis.jobsWon;
    closeRate = kpis.closeRate;
    projectedAmount = Number(kpis.projected._sum.approvedAmount ?? 0);
    bookedAmount = Number(kpis.booked._sum.contractAmount ?? 0);
    recentLeads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { client: true },
    });
    const stages = await prisma.lead.groupBy({ by: ['stage'], _count: true });
    pipeline = stages.map((s) => ({ stage: s.stage, count: s._count }));
  } catch {
    // DB not connected — show empty state
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-smooth-black">Executive Dashboard</h1>
        <p className="text-gray-500 text-sm">Last 30 days · Smooth Construction Services</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Leads" value={String(leads)} />
        <KpiCard label="Estimates" value={String(estimates)} />
        <KpiCard label="Proposals Sent" value={String(proposalsSent)} />
        <KpiCard label="Jobs Won" value={String(jobsWon)} sub={`${closeRate}% close rate`} />
        <KpiCard label="Projected Revenue" value={formatCurrency(projectedAmount)} />
        <KpiCard label="Booked Revenue" value={formatCurrency(bookedAmount)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Pipeline by Stage">
          <div className="space-y-2">
            {pipeline.length === 0 && <p className="text-gray-400 text-sm">No pipeline data — run db:setup</p>}
            {pipeline.map((s) => (
              <div key={s.stage} className="flex items-center gap-3">
                <div className="w-32 text-xs text-gray-600">{s.stage.replace(/_/g, ' ')}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="bg-smooth-orange h-full rounded-full"
                    style={{ width: `${Math.min(100, s.count * 20)}%` }}
                  />
                </div>
                <div className="w-8 text-right font-medium">{s.count}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent Leads">
          <div className="divide-y">
            {recentLeads.length === 0 && <p className="text-gray-400 text-sm">No leads yet</p>}
            {recentLeads.map((lead) => (
              <a key={lead.id} href={`/leads/${lead.id}`} className="block py-2 hover:bg-orange-50 -mx-2 px-2 rounded">
                <div className="font-medium">{lead.leadNumber} — {lead.client?.firstName} {lead.client?.lastName}</div>
                <div className="text-xs text-gray-500">{lead.projectCity} · {lead.serviceType.replace(/_/g, ' ')} · {lead.stage.replace(/_/g, ' ')}</div>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
