import Link from 'next/link';
import { Card, formatCurrency, StatusBadge } from '@/components/AppShell';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { ProposalActions } from '@/components/ProposalActions';

export default async function ProposalDetailPage({ params }: { params: { proposalId: string } }) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: params.proposalId },
    include: {
      estimate: {
        include: {
          lineItems: { orderBy: { sortOrder: 'asc' } },
          lead: { include: { client: true } },
        },
      },
    },
  });

  if (!proposal) notFound();

  const scope = proposal.scopeJson as {
    project_summary?: string;
    scope_of_work?: { heading: string; bullets: string[] }[];
    assumptions?: string[];
    exclusions?: string[];
  } | null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{proposal.proposalNumber}</h1>
          <p className="text-gray-500">
            {proposal.estimate.lead.client.firstName} {proposal.estimate.lead.client.lastName} · {formatCurrency(proposal.approvedAmount)}
          </p>
          <div className="mt-2"><StatusBadge status={proposal.status} /></div>
        </div>
        <ProposalActions proposalId={proposal.id} status={proposal.status} hasPdf={!!proposal.pdfUrl} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Scope of Work">
            {scope?.project_summary && <p className="text-sm mb-4">{scope.project_summary}</p>}
            {(scope?.scope_of_work ?? []).map((section, i) => (
              <div key={i} className="mb-4">
                <h3 className="font-semibold text-smooth-black">{section.heading}</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                  {section.bullets.map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              </div>
            ))}
          </Card>

          {scope?.exclusions && (
            <Card title="Exclusions">
              <ul className="list-disc list-inside text-sm text-gray-600">
                {scope.exclusions.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title="Price Summary (Client)">
            <div className="text-3xl font-bold text-smooth-orange">{formatCurrency(proposal.approvedAmount)}</div>
            <div className="text-sm text-gray-500 mt-2">
              Deposit: {formatCurrency(proposal.depositAmount)} ({Number(proposal.depositPct) * 100}%)
            </div>
          </Card>

          <Card title="Schedule">
            <div className="text-sm">
              <div>Start: {proposal.scheduleStartWindow}</div>
              <div>Duration: {proposal.scheduleDurationDays} day(s)</div>
            </div>
          </Card>

          <Card title="Tracking">
            <dl className="text-xs space-y-1 text-gray-600">
              <div>Sent: {proposal.sentAt ? new Date(proposal.sentAt).toLocaleString() : '—'}</div>
              <div>Viewed: {proposal.viewedAt ? new Date(proposal.viewedAt).toLocaleString() : '—'}</div>
              <div>Approved: {proposal.clientApprovedAt ? new Date(proposal.clientApprovedAt).toLocaleString() : '—'}</div>
            </dl>
            {proposal.status === 'sent' && (
              <Link href={`/proposals/view/${proposal.viewToken}`} className="text-smooth-orange text-xs mt-2 block">
                Client view link →
              </Link>
            )}
          </Card>

          {proposal.pdfUrl && (
            <a href={proposal.pdfUrl} download={`${proposal.proposalNumber}.pdf`} className="block text-center border border-smooth-orange text-smooth-orange py-2 rounded-md text-sm font-medium">
              Download PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
