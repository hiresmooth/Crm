import { Card, formatCurrency } from '@/components/AppShell';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export default async function ClientProposalViewPage({ params }: { params: { token: string } }) {
  const proposal = await prisma.proposal.findUnique({
    where: { viewToken: params.token },
    include: {
      estimate: {
        include: {
          lineItems: true,
          lead: { include: { client: true } },
        },
      },
    },
  });

  if (!proposal) notFound();

  if (!proposal.viewedAt) {
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { viewedAt: new Date(), viewCount: { increment: 1 }, status: proposal.status === 'sent' ? 'viewed' : proposal.status },
    });
  }

  const scope = proposal.scopeJson as { project_summary?: string; scope_of_work?: { heading: string; bullets: string[] }[] } | null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-smooth-black text-white border-b-4 border-smooth-orange py-6">
        <div className="max-w-2xl mx-auto px-4">
          <div className="font-bold text-xl">Smooth Construction Services</div>
          <div className="text-gray-400 text-sm">Proposal {proposal.proposalNumber}</div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Card title="Your Proposal">
          <p className="text-sm text-gray-600 mb-4">{scope?.project_summary}</p>
          <div className="text-3xl font-bold text-smooth-orange">{formatCurrency(proposal.approvedAmount)}</div>
          <p className="text-sm text-gray-500 mt-2">Deposit to schedule: {formatCurrency(proposal.depositAmount)}</p>
        </Card>

        <Card title="Scope of Work">
          {(scope?.scope_of_work ?? []).map((s, i) => (
            <div key={i} className="mb-3">
              <h3 className="font-semibold">{s.heading}</h3>
              <ul className="list-disc list-inside text-sm text-gray-700">
                {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            </div>
          ))}
        </Card>

        <form action={`/api/v1/public/proposals/${params.token}/approve`} method="POST" className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Approve Proposal</h3>
          <p className="text-xs text-gray-500 mb-3">By approving, you agree to the terms and authorize Smooth Construction Services to proceed upon deposit.</p>
          <button type="submit" className="w-full bg-smooth-orange text-white py-3 rounded-md font-medium">
            Approve — {formatCurrency(proposal.approvedAmount)}
          </button>
        </form>
      </main>
    </div>
  );
}
