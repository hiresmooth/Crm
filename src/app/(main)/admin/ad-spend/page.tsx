'use client';

import { useEffect, useState } from 'react';
import { Card, formatCurrency } from '@/components/AppShell';

export default function AdSpendPage() {
  const [rows, setRows] = useState<{ id: string; source: string; amount: string; periodStart: string; periodEnd: string }[]>([]);

  useEffect(() => {
    fetch('/api/v1/admin/ad-spend').then((r) => r.json()).then((j) => j.success && setRows(j.data));
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch('/api/v1/admin/ad-spend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: fd.get('source'),
        amount: Number(fd.get('amount')),
        period_start: fd.get('period_start'),
        period_end: fd.get('period_end'),
        notes: fd.get('notes'),
      }),
    });
    const r = await fetch('/api/v1/admin/ad-spend');
    const j = await r.json();
    if (j.success) setRows(j.data);
    e.currentTarget.reset();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Marketing Ad Spend</h1>
      <Card title="Add Spend">
        <form onSubmit={save} className="space-y-3">
          <select name="source" className="w-full border rounded px-3 py-2">
            <option value="google_ads">Google Ads</option>
            <option value="facebook_instagram">Facebook / Instagram</option>
            <option value="google_business">Google Business</option>
          </select>
          <input name="amount" type="number" step="0.01" placeholder="Amount ($)" required className="w-full border rounded px-3 py-2" />
          <div className="grid grid-cols-2 gap-2">
            <input name="period_start" type="date" required className="border rounded px-3 py-2" />
            <input name="period_end" type="date" required className="border rounded px-3 py-2" />
          </div>
          <input name="notes" placeholder="Notes" className="w-full border rounded px-3 py-2" />
          <button type="submit" className="bg-smooth-orange text-white px-4 py-2 rounded-md text-sm">Add</button>
        </form>
      </Card>
      <Card title="Spend History">
        {rows.map((r) => (
          <div key={r.id} className="text-sm py-2 border-b flex justify-between">
            <span>{r.source.replace(/_/g, ' ')}</span>
            <span>{formatCurrency(r.amount)}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
