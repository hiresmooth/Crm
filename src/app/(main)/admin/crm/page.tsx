'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/AppShell';

export default function CrmAdminPage() {
  const [integrations, setIntegrations] = useState<{ id: string; provider: string; name: string; webhookUrl: string | null; active: boolean }[]>([]);

  useEffect(() => {
    fetch('/api/v1/admin/crm').then((r) => r.json()).then((j) => j.success && setIntegrations(j.data));
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch('/api/v1/admin/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: fd.get('provider'),
        name: fd.get('name'),
        webhook_url: fd.get('webhook_url'),
        api_key: fd.get('api_key') || undefined,
      }),
    });
    const r = await fetch('/api/v1/admin/crm');
    const j = await r.json();
    if (j.success) setIntegrations(j.data);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">CRM Integrations</h1>
      <p className="text-sm text-gray-500">Configure webhook targets for HubSpot, GoHighLevel, Zoho, Airtable, or SmoothOS native.</p>

      <Card title="Add / Update Integration">
        <form onSubmit={save} className="space-y-3">
          <select name="provider" className="w-full border rounded px-3 py-2" required>
            <option value="hubspot">HubSpot</option>
            <option value="ghl">GoHighLevel</option>
            <option value="zoho">Zoho</option>
            <option value="airtable">Airtable / Zapier</option>
            <option value="smoothos">SmoothOS Native</option>
          </select>
          <input name="name" placeholder="Display name" className="w-full border rounded px-3 py-2" required />
          <input name="webhook_url" placeholder="Webhook URL" type="url" className="w-full border rounded px-3 py-2" />
          <input name="api_key" placeholder="API key (optional)" className="w-full border rounded px-3 py-2" />
          <button type="submit" className="bg-smooth-orange text-white px-4 py-2 rounded-md text-sm">Save</button>
        </form>
      </Card>

      <Card title="Active Integrations">
        {integrations.map((i) => (
          <div key={i.id} className="text-sm py-2 border-b flex justify-between">
            <span className="font-medium">{i.name}</span>
            <span className="text-gray-500">{i.provider} · {i.active ? 'active' : 'inactive'}</span>
          </div>
        ))}
        {integrations.length === 0 && <p className="text-gray-400 text-sm">No integrations configured</p>}
      </Card>
    </div>
  );
}
