import Link from 'next/link';
import { Card, formatCurrency, StatusBadge } from '@/components/AppShell';
import { prisma } from '@/lib/prisma';

export default async function EstimatesPage() {
  let estimates: Awaited<
    ReturnType<
      typeof prisma.estimate.findMany<{
        include: { lead: { include: { client: true } } };
      }>
    >
  > = [];
  try {
    estimates = await prisma.estimate.findMany({
      orderBy: { createdAt: 'desc' },
      include: { lead: { include: { client: true } } },
    });
  } catch {
    // empty
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Estimates</h1>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-2">#</th>
              <th className="pb-2">Name</th>
              <th className="pb-2">Client</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Price</th>
              <th className="pb-2">Margin</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {estimates.map((e) => (
              <tr key={e.id}>
                <td className="py-2">{e.estimateNumber}</td>
                <td>{e.estimateName}</td>
                <td>{e.lead.client.firstName} {e.lead.client.lastName}</td>
                <td><StatusBadge status={e.status} /></td>
                <td>{formatCurrency(e.roundedPrice)}</td>
                <td>{e.grossMarginPct ? `${(Number(e.grossMarginPct) * 100).toFixed(1)}%` : '—'}</td>
                <td><Link href={`/estimates/${e.id}`} className="text-smooth-orange">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
