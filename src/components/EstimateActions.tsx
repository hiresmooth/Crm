'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function EstimateActions({
  estimateId,
  status,
  approvalRequired,
}: {
  estimateId: string;
  status: string;
  approvalRequired: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState('');

  async function submit() {
    setLoading('submit');
    const res = await fetch(`/api/v1/estimates/${estimateId}/submit`, { method: 'POST' });
    const json = await res.json();
    setLoading('');
    if (json.success) router.refresh();
    else alert(json.errors?.[0]?.message ?? 'Submit failed');
  }

  async function approve() {
    setLoading('approve');
    const res = await fetch(`/api/v1/estimates/${estimateId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Approved' }),
    });
    const json = await res.json();
    setLoading('');
    if (json.success) router.refresh();
    else alert(json.errors?.[0]?.message ?? 'Approve failed');
  }

  return (
    <div className="flex gap-2">
      {['draft', 'revision_requested'].includes(status) && (
        <button onClick={submit} disabled={!!loading} className="border border-smooth-orange text-smooth-orange px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
          {loading === 'submit' ? '...' : 'Submit for Review'}
        </button>
      )}
      {status === 'in_review' && (
        <button onClick={approve} disabled={!!loading} className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
          {loading === 'approve' ? '...' : 'Manager Approve'}
        </button>
      )}
      {approvalRequired && status === 'draft' && (
        <span className="text-xs text-yellow-700 self-center">⚠ Margin review needed</span>
      )}
    </div>
  );
}
