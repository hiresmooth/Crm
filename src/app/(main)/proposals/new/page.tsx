'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/AppShell';

export default function NewProposalPage() {
  const searchParams = useSearchParams();
  const estimateId = searchParams.get('estimateId');
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!estimateId) return;
    setLoading(true);
    const res = await fetch('/api/v1/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estimate_id: estimateId, generate_scope_ai: true }),
    });
    const json = await res.json();
    setLoading(false);
    if (json.success) router.push(`/proposals/${json.data.proposal_id}`);
    else alert(json.errors?.[0]?.message ?? 'Failed');
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Generate Proposal</h1>
      <Card title="From Approved Estimate">
        <p className="text-sm text-gray-600 mb-4">Creates proposal with scope text generated from estimate line items (no AI pricing).</p>
        <button onClick={handleCreate} disabled={loading || !estimateId} className="bg-smooth-orange text-white px-4 py-2 rounded-md font-medium disabled:opacity-50">
          {loading ? 'Generating...' : 'Create Proposal'}
        </button>
      </Card>
    </div>
  );
}
