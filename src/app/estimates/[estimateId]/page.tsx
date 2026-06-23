import Link from 'next/link';
import { Card, formatCurrency, MarginBadge, StatusBadge } from '@/components/AppShell';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { EstimateActions } from '@/components/EstimateActions';

export default async function EstimateDetailPage({ params }: { params: { estimateId: string } }) {
  const estimate = await prisma.estimate.findUnique({
    where: { id: params.estimateId },
    include: {
      lineItems: { include: { product: true }, orderBy: { sortOrder: 'asc' } },
      lead: { include: { client: true } },
      marginProfile: true,
      proposals: true,
    },
  }).catch(() => null);

  if (!estimate) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{estimate.estimateNumber}</h1>
          <p className="text-gray-500">{estimate.estimateName}</p>
          <div className="flex gap-2 mt-2">
            <StatusBadge status={estimate.status} />
            {estimate.marginStatus && (
              <MarginBadge status={estimate.marginStatus} gm={Number(estimate.grossMarginPct)} />
            )}
          </div>
        </div>
        <EstimateActions estimateId={estimate.id} status={estimate.status} approvalRequired={estimate.approvalRequired} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Lead / Project">
            <div className="text-sm grid grid-cols-2 gap-2">
              <div>Client: {estimate.lead.client.firstName} {estimate.lead.client.lastName}</div>
              <div>City: {estimate.projectCity}</div>
              <div>Access: {estimate.accessDifficulty}</div>
              <div>Service: {estimate.serviceType.replace(/_/g, ' ')}</div>
              <div className="col-span-2">
                <Link href={`/leads/${estimate.leadId}`} className="text-smooth-orange text-xs">View lead →</Link>
              </div>
            </div>
          </Card>

          <Card title="Line Items (Internal)">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs">
                  <th className="pb-2">Assembly</th>
                  <th className="pb-2">Qty</th>
                  <th className="pb-2">Material</th>
                  <th className="pb-2">Labor</th>
                  <th className="pb-2">Direct</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {estimate.lineItems.map((line) => (
                  <tr key={line.id}>
                    <td className="py-2">
                      <div className="font-medium">{line.assemblyName}</div>
                      <div className="text-xs text-gray-400">{line.product.name}</div>
                    </td>
                    <td>{Number(line.quantityRaw).toLocaleString()} {line.quantityType.replace(/_/g, ' ')}</td>
                    <td>{formatCurrency(line.materialCost)}</td>
                    <td>{Number(line.laborHours).toFixed(1)}h / {formatCurrency(line.laborCost)}</td>
                    <td className="font-medium">{formatCurrency(line.lineDirectCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Pricing Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Line direct</dt><dd>{formatCurrency(estimate.directCostTotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Mobilization</dt><dd>{formatCurrency(estimate.mobilizationCost)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Small job fee</dt><dd>{formatCurrency(estimate.smallJobFee)}</dd></div>
              <div className="flex justify-between border-t pt-2"><dt className="text-gray-500">Overhead (18%)</dt><dd>{formatCurrency(estimate.overheadCost)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Cost before profit</dt><dd>{formatCurrency(estimate.costBeforeProfit)}</dd></div>
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <dt>Client Price</dt>
                <dd className="text-smooth-orange">{formatCurrency(estimate.roundedPrice)}</dd>
              </div>
            </dl>
            {estimate.approvalRequired && (
              <div className="mt-3 text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 p-2 rounded">
                Manager approval required before proposal
              </div>
            )}
          </Card>

          {estimate.status === 'approved' && estimate.proposals.length === 0 && (
            <Card title="Next Step">
              <p className="text-sm text-gray-600 mb-3">Estimate approved. Generate a proposal.</p>
              <Link href={`/proposals/new?estimateId=${estimate.id}`} className="block text-center bg-smooth-orange text-white py-2 rounded-md font-medium">
                Generate Proposal
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
