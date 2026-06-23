'use client';

import { useState } from 'react';
import { formatCurrency } from '@/components/AppShell';

export function ClientProposalActions({
  token,
  amount,
}: {
  token: string;
  amount: number;
}) {
  const [signerName, setSignerName] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'approved' | 'declined'>('idle');
  const [error, setError] = useState('');

  async function approve() {
    if (!signerName.trim()) {
      setError('Please type your full name to sign');
      return;
    }
    const res = await fetch(`/api/v1/public/proposals/${token}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signer_name: signerName,
        accepted_terms: true,
        signature_data: { type: 'typed', value: signerName },
      }),
    });
    if (res.redirected) {
      window.location.href = res.url;
      return;
    }
    const json = await res.json();
    if (json.success !== false) setStatus('approved');
    else setError('Approval failed');
  }

  async function decline() {
    const res = await fetch(`/api/v1/public/proposals/${token}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: declineReason || 'Declined by client' }),
    });
    const json = await res.json();
    if (json.success) setStatus('declined');
  }

  if (status === 'approved') {
    return <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg text-center font-medium">Proposal approved. We will contact you to schedule.</div>;
  }
  if (status === 'declined') {
    return <div className="bg-gray-50 border p-4 rounded-lg text-center">Proposal declined.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-2">E-Sign & Approve</h3>
        <p className="text-xs text-gray-500 mb-3">Type your full legal name as electronic signature.</p>
        <input
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Full name"
          className="w-full border rounded px-3 py-2 mb-3"
        />
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <button onClick={approve} className="w-full bg-smooth-orange text-white py-3 rounded-md font-medium">
          Approve — {formatCurrency(amount)}
        </button>
      </div>
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-gray-600">Decline</h3>
        <input
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          placeholder="Reason (optional)"
          className="w-full border rounded px-3 py-2 mb-2 text-sm"
        />
        <button onClick={decline} className="w-full border text-gray-600 py-2 rounded-md text-sm">
          Decline Proposal
        </button>
      </div>
    </div>
  );
}
