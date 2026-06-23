import { Card } from '@/components/AppShell';
import { ProductEditForm } from '@/components/ProductEditForm';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { canEditRates } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export default async function AdminRatesPage() {
  const session = await getSession();
  if (!canEditRates(session)) redirect('/dashboard');

  let products: Awaited<ReturnType<typeof prisma.product.findMany>> = [];
  let laborRates: Awaited<ReturnType<typeof prisma.laborRate.findMany>> = [];
  let marginProfiles: Awaited<ReturnType<typeof prisma.marginProfile.findMany>> = [];
  let overheadProfiles: Awaited<ReturnType<typeof prisma.overheadProfile.findMany>> = [];

  try {
    [products, laborRates, marginProfiles, overheadProfiles] = await Promise.all([
      prisma.product.findMany({ where: { active: true }, orderBy: { serviceCode: 'asc' } }),
      prisma.laborRate.findMany({ where: { active: true } }),
      prisma.marginProfile.findMany({ where: { active: true } }),
      prisma.overheadProfile.findMany({ where: { active: true } }),
    ]);
  } catch {
    // empty
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Rate Tables</h1>
      <p className="text-gray-500 text-sm">Editable rate assumptions that drive formula pricing.</p>

      <ProductEditForm />

      <Card title="Products">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b text-xs">
              <th className="pb-2">SKU</th>
              <th className="pb-2">Name</th>
              <th className="pb-2">Service</th>
              <th className="pb-2">Unit Cost</th>
              <th className="pb-2">Waste %</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="py-1.5 font-mono text-xs">{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.serviceCode.replace(/_/g, ' ')}</td>
                <td>${Number(p.unitCost).toFixed(2)}</td>
                <td>{(Number(p.defaultWastePct) * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Labor Rates">
          {laborRates.map((l) => (
            <div key={l.id} className="flex justify-between text-sm py-1 border-b">
              <span>{l.tradeName}</span>
              <span className="font-medium">${Number(l.burdenedRateHr).toFixed(2)}/hr</span>
            </div>
          ))}
        </Card>

        <Card title="Margin Profile">
          {marginProfiles.map((m) => (
            <dl key={m.id} className="text-sm space-y-1">
              <div className="flex justify-between"><dt className="text-gray-500">Green min GM</dt><dd>{(Number(m.greenMinPct) * 100).toFixed(0)}%</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Yellow min GM</dt><dd>{(Number(m.yellowMinPct) * 100).toFixed(0)}%</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Min job charge</dt><dd>${Number(m.minJobCharge).toFixed(0)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Rush multiplier</dt><dd>{Number(m.rushMultiplier)}×</dd></div>
            </dl>
          ))}
        </Card>
      </div>
    </div>
  );
}
