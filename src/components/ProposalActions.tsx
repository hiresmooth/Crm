'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ProposalActions({
  proposalId,
  status,
  hasPdf,
}: {
  proposalId: string;
  status: string;
  hasPdf: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState('');

  async function generatePdf() {
    setLoading('pdf');
    const res = await fetch(`/api/v1/proposals/${proposalId}/generate-pdf`, { method: 'POST' });
    const json = await res.json();
    setLoading('');
    if (json.success) router.refresh();
    else alert(json.errors?.[0]?.message ?? 'PDF failed');
  }

  async function internalApprove() {
    setLoading('approve');
    const res = await fetch(`/api/v1/proposals/${proposalId}/internal-approve`, { method: 'POST' });
    const json = await res.json();
    setLoading('');
    if (json.success) router.refresh();
  }

  async function send() {
    setLoading('send');
    const res = await fetch(`/api/v1/proposals/${proposalId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_email: 'client@example.com' }),
    });
    const json = await res.json();
    setLoading('');
    if (json.success) {
      alert(`Sent! Client URL: ${json.data.client_view_url}`);
      router.refresh();
    } else alert(json.errors?.[0]?.message ?? 'Send failed');
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!hasPdf && (
        <button onClick={generatePdf} disabled={!!loading} className="border px-3 py-2 rounded-md text-sm">
          {loading === 'pdf' ? '...' : 'Generate PDF'}
        </button>
      )}
      {hasPdf && status === 'draft' && (
        <button onClick={internalApprove} disabled={!!loading} className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm">
          {loading === 'approve' ? '...' : 'Internal Approve'}
        </button>
      )}
      {status === 'internal_approved' && hasPdf && (
        <button onClick={send} disabled={!!loading} className="bg-smooth-orange text-white px-3 py-2 rounded-md text-sm">
          {loading === 'send' ? '...' : 'Send Proposal'}
        </button>
      )}
    </div>
  );
}
