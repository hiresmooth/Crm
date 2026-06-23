'use client';

import { useState } from 'react';
import { Card } from '@/components/AppShell';

export function ProductEditForm({ product }: {
  product?: { id: string; sku: string; name: string; serviceCode: string; unit: string; unitCost: string; defaultWastePct: string };
}) {
  const [msg, setMsg] = useState('');

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/v1/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: product?.id,
        sku: fd.get('sku'),
        name: fd.get('name'),
        service_code: fd.get('service_code'),
        unit: fd.get('unit'),
        unit_cost: Number(fd.get('unit_cost')),
        default_waste_pct: Number(fd.get('default_waste_pct')),
      }),
    });
    const json = await res.json();
    setMsg(json.success ? 'Saved' : json.errors?.[0]?.message ?? 'Error');
  }

  return (
    <Card title={product ? `Edit ${product.sku}` : 'Add Product'}>
      <form onSubmit={save} className="grid grid-cols-2 gap-2 text-sm">
        <input name="sku" defaultValue={product?.sku} placeholder="SKU" required className="border rounded px-2 py-1" />
        <input name="name" defaultValue={product?.name} placeholder="Name" required className="border rounded px-2 py-1 col-span-2" />
        <input name="service_code" defaultValue={product?.serviceCode} placeholder="service_code" required className="border rounded px-2 py-1" />
        <input name="unit" defaultValue={product?.unit ?? 'sq_ft'} placeholder="unit" required className="border rounded px-2 py-1" />
        <input name="unit_cost" type="number" step="0.01" defaultValue={product ? Number(product.unitCost) : ''} placeholder="Unit cost" required className="border rounded px-2 py-1" />
        <input name="default_waste_pct" type="number" step="0.01" defaultValue={product ? Number(product.defaultWastePct) : 0.05} placeholder="Waste %" required className="border rounded px-2 py-1" />
        <button type="submit" className="col-span-2 bg-smooth-orange text-white py-2 rounded-md text-sm">Save Product</button>
        {msg && <p className="col-span-2 text-xs text-gray-500">{msg}</p>}
      </form>
    </Card>
  );
}
