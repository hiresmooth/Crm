'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/AppShell';

type Product = { id: string; name: string; serviceCode: string; sku: string };

export default function NewEstimatePage() {
  const searchParams = useSearchParams();
  const leadId = searchParams.get('leadId');
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [lead, setLead] = useState<{ leadNumber: string; projectCity: string; projectStreet: string; projectZip: string; serviceType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!leadId) return;
    fetch(`/api/v1/leads/${leadId}`).then((r) => r.json()).then((j) => {
      if (j.success) setLead(j.data);
    });
    fetch('/api/v1/rates').then((r) => r.json()).then((j) => {
      if (j.success) setProducts(j.data.products);
    });
  }, [leadId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!leadId) return;
    setLoading(true);
    setError('');

    const fd = new FormData(e.currentTarget);
    const serviceType = fd.get('service_type') as string;
    const product = products.find((p) => p.serviceCode === serviceType) ?? products[0];

    const lineItem: Record<string, unknown> = {
      service_code: serviceType,
      assembly_name: fd.get('assembly_name'),
      area_name: fd.get('area_name') || undefined,
      quantity_type: serviceType === 'window_replacement' ? 'each' : 'sq_ft',
      quantity_raw: Number(fd.get('quantity_raw')),
      product_id: product?.id,
      sort_order: 1,
    };

    if (serviceType.includes('foam') || serviceType === 'attic_insulation') {
      lineItem.thickness_inches = Number(fd.get('thickness_inches') || 13.2);
      lineItem.r_value_target = Number(fd.get('r_value_target') || 49);
    }
    if (serviceType === 'air_sealing') {
      lineItem.penetration_count = Number(fd.get('penetration_count') || 0);
      lineItem.duct_seal_count = Number(fd.get('duct_seal_count') || 0);
    }
    if (serviceType === 'drywall') {
      lineItem.drywall_finish_level = fd.get('drywall_finish_level') || 'level_4';
    }
    if (serviceType === 'window_replacement') {
      lineItem.window_size_tier = fd.get('window_size_tier') || 'medium';
    }

    const res = await fetch('/api/v1/estimates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: leadId,
        estimate_name: fd.get('estimate_name'),
        service_type: serviceType,
        project: {
          street: lead?.projectStreet,
          city: lead?.projectCity,
          state: 'MA',
          zip: lead?.projectZip,
        },
        access_difficulty: fd.get('access_difficulty'),
        margin_target_pct: Number(fd.get('margin_target_pct') || 0.35),
        line_items: [lineItem],
      }),
    });

    const json = await res.json();
    setLoading(false);
    if (!json.success) {
      setError(json.errors?.[0]?.message ?? 'Failed to create estimate');
      return;
    }
    router.push(`/estimates/${json.data.estimate_id}`);
  }

  if (!leadId) return <p className="text-red-600">Missing leadId query parameter</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">New Estimate</h1>
      {lead && <p className="text-gray-500">Lead {lead.leadNumber} · {lead.projectCity}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-red-600 bg-red-50 p-3 rounded text-sm">{error}</div>}

        <Card title="Estimate Header">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estimate Name</label>
              <input name="estimate_name" required defaultValue={`${lead?.projectStreet ?? ''} — Insulation`} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Service</label>
                <select name="service_type" defaultValue={lead?.serviceType ?? 'attic_insulation'} className="w-full border rounded px-3 py-2">
                  <option value="attic_insulation">Attic Insulation</option>
                  <option value="closed_cell_foam">Closed Cell Foam</option>
                  <option value="open_cell_foam">Open Cell Foam</option>
                  <option value="air_sealing">Air Sealing</option>
                  <option value="blow_in_insulation">Blow-In Insulation</option>
                  <option value="drywall">Drywall</option>
                  <option value="window_replacement">Windows</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Access</label>
                <select name="access_difficulty" defaultValue="standard" className="w-full border rounded px-3 py-2">
                  <option value="standard">Standard</option>
                  <option value="moderate">Moderate</option>
                  <option value="difficult">Difficult</option>
                  <option value="extreme">Extreme</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Target Margin %</label>
              <input name="margin_target_pct" type="number" step="0.01" defaultValue={0.35} className="w-32 border rounded px-3 py-2" />
            </div>
          </div>
        </Card>

        <Card title="Line Item — Assembly">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assembly Name</label>
              <input name="assembly_name" required defaultValue="Attic floor — blow-in cellulose R-49" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Area Name</label>
              <input name="area_name" defaultValue="Main attic" className="w-full border rounded px-3 py-2" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Quantity (SF or each)</label>
                <input name="quantity_raw" type="number" required defaultValue={1120} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Thickness (in)</label>
                <input name="thickness_inches" type="number" step="0.1" defaultValue={13.2} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">R-Value</label>
                <input name="r_value_target" type="number" defaultValue={49} className="w-full border rounded px-3 py-2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Penetrations (air seal)</label>
                <input name="penetration_count" type="number" defaultValue={0} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Drywall Finish</label>
                <select name="drywall_finish_level" className="w-full border rounded px-3 py-2">
                  <option value="level_4">Level 4</option>
                  <option value="level_3">Level 3</option>
                  <option value="level_5">Level 5</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        <button type="submit" disabled={loading} className="bg-smooth-orange text-white px-6 py-2 rounded-md font-medium disabled:opacity-50">
          {loading ? 'Calculating...' : 'Create & Calculate Estimate'}
        </button>
      </form>
    </div>
  );
}
