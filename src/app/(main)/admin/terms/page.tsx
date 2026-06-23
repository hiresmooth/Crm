'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/AppShell';

type Template = { id: string; name: string; bodyHtml: string; isDefault: boolean; active: boolean };

export default function AdminTermsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState({ name: '', body_html: '', is_default: false });

  useEffect(() => {
    fetch('/api/v1/admin/terms').then((r) => r.json()).then((j) => { if (j.success) setTemplates(j.data); });
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/v1/admin/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const j = await res.json();
    if (j.success) {
      setTemplates((t) => [...t, j.data]);
      setForm({ name: '', body_html: '', is_default: false });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Terms Templates</h1>
      <Card title="Create Template">
        <form onSubmit={create} className="space-y-3 text-sm">
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border rounded px-2 py-1 w-full max-w-md" />
          <textarea required placeholder="HTML body" value={form.body_html} onChange={(e) => setForm({ ...form, body_html: e.target.value })} rows={6} className="border rounded p-2 w-full" />
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} /> Default template</label>
          <button type="submit" className="bg-smooth-orange text-white px-4 py-1 rounded">Create</button>
        </form>
      </Card>
      <Card title="Templates">
        {templates.map((t) => (
          <div key={t.id} className="border-b py-3">
            <div className="font-medium">{t.name} {t.isDefault && <span className="text-xs text-smooth-orange">(default)</span>}</div>
            <div className="text-xs text-gray-500 mt-1 max-h-20 overflow-hidden" dangerouslySetInnerHTML={{ __html: t.bodyHtml }} />
          </div>
        ))}
      </Card>
    </div>
  );
}
