'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/AppShell';

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData(e.currentTarget);

    const res = await fetch('/api/v1/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: fd.get('source'),
        client: {
          first_name: fd.get('first_name'),
          last_name: fd.get('last_name'),
          email: fd.get('email'),
          phone: fd.get('phone'),
        },
        project: {
          street: fd.get('street'),
          city: fd.get('city'),
          state: 'MA',
          zip: fd.get('zip'),
          type: 'residential',
        },
        service_type: fd.get('service_type'),
        description: fd.get('description'),
      }),
    });

    const json = await res.json();
    setLoading(false);
    if (!json.success) {
      setError(json.errors?.[0]?.message ?? 'Failed to create lead');
      return;
    }
    router.push(`/leads/${json.data.lead_id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">New Lead</h1>
      <Card title="Lead Intake">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
              <input name="first_name" required className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
              <input name="last_name" required className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input name="email" type="email" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input name="phone" className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Street</label>
            <input name="street" className="w-full border rounded px-3 py-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input name="city" required defaultValue="Somerville" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Zip</label>
              <input name="zip" className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Service</label>
            <select name="service_type" className="w-full border rounded px-3 py-2">
              <option value="attic_insulation">Attic Insulation</option>
              <option value="closed_cell_foam">Closed Cell Foam</option>
              <option value="open_cell_foam">Open Cell Foam</option>
              <option value="air_sealing">Air Sealing</option>
              <option value="drywall">Drywall</option>
              <option value="window_replacement">Window Replacement</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
            <select name="source" className="w-full border rounded px-3 py-2">
              <option value="website_organic">Website Organic</option>
              <option value="google_business">Google Business</option>
              <option value="referral">Referral</option>
              <option value="direct_call">Direct Call</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea name="description" rows={3} className="w-full border rounded px-3 py-2" />
          </div>
          <button type="submit" disabled={loading} className="bg-smooth-orange text-white px-4 py-2 rounded-md font-medium disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Lead'}
          </button>
        </form>
      </Card>
    </div>
  );
}
