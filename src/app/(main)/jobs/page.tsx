import Link from 'next/link';
import { Card, formatCurrency, StatusBadge } from '@/components/AppShell';
import { prisma } from '@/lib/prisma';

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      client: true,
      lead: true,
      proposal: { select: { proposalNumber: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Jobs</h1>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-2">Job #</th>
              <th className="pb-2">Client</th>
              <th className="pb-2">City</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Contract</th>
              <th className="pb-2">GM at Sale</th>
              <th className="pb-2">Proposal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {jobs.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">No jobs yet — win a proposal to create one</td></tr>
            )}
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="py-2 font-medium">{job.jobNumber}</td>
                <td>{job.client.firstName} {job.client.lastName}</td>
                <td>{job.lead.projectCity}</td>
                <td><StatusBadge status={job.status} /></td>
                <td>{formatCurrency(job.contractAmount)}</td>
                <td>{job.grossMarginPctAtSale ? `${(Number(job.grossMarginPctAtSale) * 100).toFixed(1)}%` : '—'}</td>
                <td>{job.proposal.proposalNumber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
