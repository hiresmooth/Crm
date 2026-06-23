import Link from 'next/link';
import { Card, formatCurrency, StatusBadge } from '@/components/AppShell';
import { prisma } from '@/lib/prisma';

export default async function ProposalsPage() {
  let proposals: Awaited<
    ReturnType<
      typeof prisma.proposal.findMany<{
        include: { estimate: { include: { lead: { include: { client: true } } } } };
      }>
    >
  > = [];
  try {
    proposals = await prisma.proposal.findMany({
      orderBy: { createdAt: 'desc' },
      include: { estimate: { include: { lead: { include: { client: true } } } } },
    });
  } catch {
    // empty
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Proposals</h1>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-2">#</th>
              <th className="pb-2">Client</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">Sent</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {proposals.map((p) => (
              <tr key={p.id}>
                <td className="py-2">{p.proposalNumber}</td>
                <td>{p.estimate.lead.client.firstName} {p.estimate.lead.client.lastName}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{formatCurrency(p.approvedAmount)}</td>
                <td>{p.sentAt ? new Date(p.sentAt).toLocaleDateString() : '—'}</td>
                <td><Link href={`/proposals/${p.id}`} className="text-smooth-orange">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
