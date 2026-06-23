import Link from 'next/link';
import { Card, formatCurrency, StatusBadge } from '@/components/AppShell';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export default async function LeadDetailPage({ params }: { params: { leadId: string } }) {
  let lead;
  try {
    lead = await prisma.lead.findUnique({
      where: { id: params.leadId },
      include: {
        client: true,
        estimates: { orderBy: { createdAt: 'desc' } },
        activityLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        assignedEstimator: { select: { firstName: true, lastName: true } },
      },
    });
  } catch {
    notFound();
  }

  if (!lead) notFound();

  const proposals = await prisma.proposal.findMany({
    where: { estimate: { leadId: lead.id } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{lead.leadNumber}</h1>
          <p className="text-gray-500">{lead.client.firstName} {lead.client.lastName} · {lead.projectCity}, MA</p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={lead.stage} />
          <Link href={`/estimates/new?leadId=${lead.id}`} className="bg-smooth-orange text-white px-4 py-2 rounded-md text-sm font-medium">
            Create Estimate
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Contact">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-500">Email:</span> {lead.client.email}</div>
              <div><span className="text-gray-500">Phone:</span> {lead.client.phone}</div>
              <div className="col-span-2"><span className="text-gray-500">Address:</span> {lead.projectStreet}, {lead.projectCity} {lead.projectZip}</div>
              <div><span className="text-gray-500">Service:</span> {lead.serviceType.replace(/_/g, ' ')}</div>
              <div><span className="text-gray-500">Source:</span> {lead.source.replace(/_/g, ' ')}</div>
            </div>
            {lead.description && <p className="mt-3 text-sm text-gray-600 border-t pt-3">{lead.description}</p>}
          </Card>

          <Card title="Estimates">
            {lead.estimates.length === 0 ? (
              <p className="text-gray-400 text-sm">No estimates yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lead.estimates.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2">{e.estimateNumber}</td>
                      <td>{e.estimateName}</td>
                      <td><StatusBadge status={e.status} /></td>
                      <td>{formatCurrency(e.roundedPrice)}</td>
                      <td><Link href={`/estimates/${e.id}`} className="text-smooth-orange">Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Proposals">
            {proposals.length === 0 ? (
              <p className="text-gray-400 text-sm">No proposals yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2">#</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {proposals.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2">{p.proposalNumber}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>{formatCurrency(p.approvedAmount)}</td>
                      <td><Link href={`/proposals/${p.id}`} className="text-smooth-orange">Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Assignment">
            <div className="text-sm">
              <div className="text-gray-500">Estimator</div>
              <div>{lead.assignedEstimator ? `${lead.assignedEstimator.firstName} ${lead.assignedEstimator.lastName}` : 'Unassigned'}</div>
            </div>
          </Card>

          <Card title="Activity">
            <div className="space-y-2 text-xs">
              {lead.activityLogs.map((log) => (
                <div key={log.id} className="border-l-2 border-smooth-orange pl-2">
                  <div className="font-medium">{log.eventType.replace(/_/g, ' ')}</div>
                  <div className="text-gray-400">{new Date(log.createdAt).toLocaleString()}</div>
                </div>
              ))}
              {lead.activityLogs.length === 0 && <p className="text-gray-400">No activity</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
