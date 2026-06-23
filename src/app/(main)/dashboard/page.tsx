import { Card, formatCurrency, KpiCard } from '@/components/AppShell';
import { AlertsPanel, PipelineChart, RevenueChart } from '@/components/DashboardWidgets';
import { prisma } from '@/lib/prisma';
import { runAlertEngine } from '@/lib/alerts/engine';

async function getDashboardData() {
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [leads, estimates, proposalsSent, jobsWon, booked, projected, wonEstimates] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: from } } }),
    prisma.estimate.count({ where: { createdAt: { gte: from } } }),
    prisma.proposal.count({ where: { sentAt: { gte: from } } }),
    prisma.proposal.count({ where: { clientApprovedAt: { gte: from } } }),
    prisma.job.aggregate({ _sum: { contractAmount: true }, where: { createdAt: { gte: from } } }),
    prisma.proposal.aggregate({
      _sum: { approvedAmount: true },
      where: { status: { in: ['sent', 'viewed', 'internal_approved'] }, clientApprovedAt: null },
    }),
    prisma.estimate.aggregate({
      _avg: { grossMarginPct: true, roundedPrice: true },
      where: { proposals: { some: { status: 'client_approved' } }, createdAt: { gte: from } },
    }),
  ]);

  const pipelineRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/v1/dashboard/pipeline`, { cache: 'no-store' }).catch(() => null);
  const revenueRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/v1/dashboard/revenue-trend`, { cache: 'no-store' }).catch(() => null);

  let pipelineStages: { stage: string; count: number; total_value: number; overdue_count: number }[] = [];
  let revenuePoints: { period: string; booked: number; projected: number }[] = [];

  if (pipelineRes?.ok) {
    const j = await pipelineRes.json();
    pipelineStages = j.data?.stages ?? [];
  } else {
    const stages = await prisma.lead.groupBy({ by: ['stage'], _count: true });
    pipelineStages = stages.map((s) => ({ stage: s.stage, count: s._count, total_value: 0, overdue_count: 0 }));
  }

  if (revenueRes?.ok) {
    const j = await revenueRes.json();
    revenuePoints = j.data?.points ?? [];
  }

  const services = await prisma.lead.groupBy({ by: ['serviceType'], _count: true, orderBy: { _count: { serviceType: 'desc' } }, take: 6 });

  const estimators = await prisma.user.findMany({ where: { role: 'estimator', isActive: true }, take: 5 });

  return {
    kpis: {
      leads,
      estimates,
      proposalsSent,
      jobsWon,
      closeRate: proposalsSent > 0 ? ((jobsWon / proposalsSent) * 100).toFixed(1) : '0',
      projected: Number(projected._sum.approvedAmount ?? 0),
      booked: Number(booked._sum.contractAmount ?? 0),
      avgJob: Number(wonEstimates._avg.roundedPrice ?? 0),
      avgMargin: Number(wonEstimates._avg.grossMarginPct ?? 0),
    },
    pipelineStages,
    revenuePoints,
    services,
    estimators,
  };
}

export default async function DashboardPage() {
  await runAlertEngine().catch(() => {});

  let data;
  try {
    data = await getDashboardData();
  } catch {
    data = {
      kpis: { leads: 0, estimates: 0, proposalsSent: 0, jobsWon: 0, closeRate: '0', projected: 0, booked: 0, avgJob: 0, avgMargin: 0 },
      pipelineStages: [],
      revenuePoints: [],
      services: [],
      estimators: [],
    };
  }

  const { kpis, pipelineStages, revenuePoints, services, estimators } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-smooth-black">Executive Dashboard</h1>
        <p className="text-gray-500 text-sm">Last 30 days · Smooth Construction Services</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Leads" value={String(kpis.leads)} />
        <KpiCard label="Estimates" value={String(kpis.estimates)} />
        <KpiCard label="Proposals Sent" value={String(kpis.proposalsSent)} />
        <KpiCard label="Jobs Won" value={String(kpis.jobsWon)} sub={`${kpis.closeRate}% close`} />
        <KpiCard label="Projected Revenue" value={formatCurrency(kpis.projected)} />
        <KpiCard label="Booked Revenue" value={formatCurrency(kpis.booked)} />
        <KpiCard label="Avg Job Size" value={formatCurrency(kpis.avgJob)} />
        <KpiCard label="Avg Gross Margin" value={`${(kpis.avgMargin * 100).toFixed(1)}%`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Sales Pipeline">
            <PipelineChart stages={pipelineStages} />
          </Card>
          <Card title="Revenue Trend (weekly)">
            <div className="flex gap-4 text-xs text-gray-500 mb-2">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-smooth-orange rounded" /> Booked</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-300 rounded" /> Projected</span>
            </div>
            <RevenueChart points={revenuePoints} />
          </Card>
          <Card title="Service Performance">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs">
                  <th className="pb-2">Service</th>
                  <th className="pb-2">Leads</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.serviceType} className="border-b">
                    <td className="py-1.5">{s.serviceType.replace(/_/g, ' ')}</td>
                    <td>{s._count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <div className="space-y-6">
          <AlertsPanel />
          <Card title="Estimator Team">
            {estimators.map((e) => (
              <div key={e.id} className="text-sm py-1 border-b last:border-0">
                {e.firstName} {e.lastName}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
