'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/AppShell';

export default function BatchEstimatorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData(e.currentTarget);

    const res = await fetch('/api/v1/estimates/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: fd.get('lead_id'),
        estimate_name: fd.get('estimate_name'),
        unit_count: Number(fd.get('unit_count')),
        margin_target_pct: Number(fd.get('margin_target_pct') || 0.35),
        is_repeat_layout: true,
        unit_template: {
          service_code: fd.get('service_code'),
          assembly_name: fd.get('assembly_name'),
          quantity_raw: Number(fd.get('quantity_raw')),
          product_id: fd.get('product_id'),
          thickness_inches: Number(fd.get('thickness_inches') || 0) || undefined,
        },
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!json.success) {
      setError(json.errors?.[0]?.message ?? 'Failed');
      return;
    }
    router.push(`/estimates/${json.data.estimate_id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Multifamily Batch Estimator</h1>
      <p className="text-sm text-gray-500">Repeat-layout discount applies when unit count ≥ 4.</p>
      <Card title="Batch Configuration">
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <input name="lead_id" placeholder="Lead UUID" required className="w-full border rounded px-3 py-2 text-sm" />
          <input name="estimate_name" placeholder="Estimate name" required defaultValue="Multifamily — repeat units" className="w-full border rounded px-3 py-2" />
          <input name="unit_count" type="number" min={2} defaultValue={8} placeholder="Unit count" required className="w-full border rounded px-3 py-2" />
          <input name="assembly_name" defaultValue="Unit attic insulation" required className="w-full border rounded px-3 py-2" />
          <input name="quantity_raw" type="number" defaultValue={900} placeholder="SF per unit" required className="w-full border rounded px-3 py-2" />
          <input name="product_id" placeholder="Product UUID (from rates)" required className="w-full border rounded px-3 py-2 text-sm" />
          <select name="service_code" className="w-full border rounded px-3 py-2">
            <option value="attic_insulation">Attic Insulation</option>
            <option value="drywall">Drywall</option>
            <option value="blow_in_insulation">Blow-In</option>
          </select>
          <button type="submit" disabled={loading} className="bg-smooth-orange text-white px-4 py-2 rounded-md font-medium disabled:opacity-50">
            {loading ? 'Building...' : 'Create Batch Estimate'}
          </button>
        </form>
      </Card>
    </div>
  );
}
