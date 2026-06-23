import { Card, formatCurrency } from '@/components/AppShell';
import { ClientProposalActions } from '@/components/ClientProposalActions';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/events';
import { notFound } from 'next/navigation';

export default async function ClientProposalViewPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { approved?: string };
}) {
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

  if (!proposal.viewedAt && proposal.status === 'sent') {
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { viewedAt: new Date(), viewCount: { increment: 1 }, status: 'viewed' },
    });
    await emitEvent({
      eventType: 'proposal_viewed',
      leadId: proposal.estimate.leadId,
      proposalId: proposal.id,
      payload: { proposal_number: proposal.proposalNumber },
    });
  }

  const scope = proposal.scopeJson as {
    project_summary?: string;
    scope_of_work?: { heading: string; bullets: string[] }[];
    exclusions?: string[];
  } | null;

  if (searchParams.approved === '1' || proposal.status === 'client_approved') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border rounded-lg p-8 text-center max-w-md">
          <div className="text-2xl font-bold text-green-700 mb-2">Approved</div>
          <p className="text-gray-600">Thank you. Smooth Construction Services will contact you to collect deposit and schedule.</p>
        </div>
      </div>
    );
  }

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
                {s.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </Card>

        {scope?.exclusions && scope.exclusions.length > 0 && (
          <Card title="Exclusions">
            <ul className="list-disc list-inside text-sm text-gray-600">
              {scope.exclusions.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Card>
        )}

        <ClientProposalActions token={params.token} amount={Number(proposal.approvedAmount)} />
      </main>
    </div>
  );
}
