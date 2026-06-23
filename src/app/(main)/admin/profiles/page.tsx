'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/AppShell';

export default function AdminProfilesPage() {
  const [margin, setMargin] = useState<{ id: string; name: string; greenMinPct: string; yellowMinPct: string; minJobCharge: string; highValueThreshold: string }[]>([]);
  const [overhead, setOverhead] = useState<{ id: string; name: string; overheadPct: string }[]>([]);

  useEffect(() => {
    fetch('/api/v1/admin/margin-profiles').then((r) => r.json()).then((j) => { if (j.success) setMargin(j.data); });
    fetch('/api/v1/admin/overhead-profiles').then((r) => r.json()).then((j) => { if (j.success) setOverhead(j.data); });
  }, []);

  async function saveMargin(id: string, field: string, value: number) {
    await fetch('/api/v1/admin/margin-profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value }),
    });
  }

  async function saveOverhead(id: string, overhead_pct: number) {
    await fetch('/api/v1/admin/overhead-profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, overhead_pct }),
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Margin & Overhead Profiles</h1>
      <Card title="Margin Profiles">
        {margin.map((p) => (
          <div key={p.id} className="grid md:grid-cols-4 gap-2 text-sm mb-4 border-b pb-4">
            <div className="font-medium">{p.name}</div>
            <label>Green min %<input type="number" step="0.01" defaultValue={Number(p.greenMinPct)} onBlur={(e) => saveMargin(p.id, 'green_min_pct', Number(e.target.value))} className="block border rounded px-2 py-1 w-full mt-1" /></label>
            <label>Yellow min %<input type="number" step="0.01" defaultValue={Number(p.yellowMinPct)} onBlur={(e) => saveMargin(p.id, 'yellow_min_pct', Number(e.target.value))} className="block border rounded px-2 py-1 w-full mt-1" /></label>
            <label>Min job $<input type="number" defaultValue={Number(p.minJobCharge)} onBlur={(e) => saveMargin(p.id, 'min_job_charge', Number(e.target.value))} className="block border rounded px-2 py-1 w-full mt-1" /></label>
          </div>
        ))}
      </Card>
      <Card title="Overhead Profiles">
        {overhead.map((p) => (
          <div key={p.id} className="flex gap-4 items-center text-sm mb-3">
            <span className="font-medium w-40">{p.name}</span>
            <label>Overhead %<input type="number" step="0.01" defaultValue={Number(p.overheadPct)} onBlur={(e) => saveOverhead(p.id, Number(e.target.value))} className="border rounded px-2 py-1 ml-2" /></label>
          </div>
        ))}
      </Card>
    </div>
  );
}
