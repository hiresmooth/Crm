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
  const [rejectNotes, setRejectNotes] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverride, setShowOverride] = useState(false);

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

  async function reject() {
    if (!rejectNotes.trim()) return alert('Revision notes required');
    setLoading('reject');
    const res = await fetch(`/api/v1/estimates/${estimateId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: rejectNotes }),
    });
    const json = await res.json();
    setLoading('');
    if (json.success) {
      setShowReject(false);
      router.refresh();
    } else alert(json.errors?.[0]?.message ?? 'Reject failed');
  }

  async function marginOverride() {
    if (overrideReason.length < 5) return alert('Reason required (min 5 chars)');
    setLoading('override');
    const res = await fetch(`/api/v1/estimates/${estimateId}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: overrideReason, approved_to_send: true }),
    });
    const json = await res.json();
    setLoading('');
    if (json.success) {
      setShowOverride(false);
      router.refresh();
    } else alert(json.errors?.[0]?.message ?? 'Override failed');
  }

  async function createRevision() {
    setLoading('revision');
    const res = await fetch(`/api/v1/estimates/${estimateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ create_revision: true }),
    });
    const json = await res.json();
    setLoading('');
    if (json.success) router.push(`/estimates/${json.data.estimate_id}`);
    else alert(json.errors?.[0]?.message ?? 'Revision failed');
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex flex-wrap gap-2 justify-end">
        {['draft', 'revision_requested'].includes(status) && (
          <button onClick={submit} disabled={!!loading} className="border border-smooth-orange text-smooth-orange px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
            {loading === 'submit' ? '...' : 'Submit for Review'}
          </button>
        )}
        {status === 'in_review' && (
          <>
            <button onClick={approve} disabled={!!loading} className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
              {loading === 'approve' ? '...' : 'Approve'}
            </button>
            <button onClick={() => setShowReject(!showReject)} disabled={!!loading} className="border border-red-400 text-red-600 px-4 py-2 rounded-md text-sm font-medium">
              Request Revision
            </button>
            {approvalRequired && (
              <button onClick={() => setShowOverride(!showOverride)} disabled={!!loading} className="border border-yellow-500 text-yellow-700 px-4 py-2 rounded-md text-sm font-medium">
                Margin Override
              </button>
            )}
          </>
        )}
        {status === 'approved' && (
          <button onClick={createRevision} disabled={!!loading} className="border px-4 py-2 rounded-md text-sm font-medium">
            {loading === 'revision' ? '...' : 'Create Revision'}
          </button>
        )}
        {approvalRequired && status === 'draft' && (
          <span className="text-xs text-yellow-700 self-center">Margin review needed</span>
        )}
      </div>
      {showReject && (
        <div className="flex gap-2 items-center">
          <input value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} placeholder="Revision notes..." className="border rounded px-2 py-1 text-sm w-64" />
          <button onClick={reject} className="bg-red-600 text-white px-3 py-1 rounded text-sm">Send Back</button>
        </div>
      )}
      {showOverride && (
        <div className="flex gap-2 items-center">
          <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Override reason..." className="border rounded px-2 py-1 text-sm w-64" />
          <button onClick={marginOverride} className="bg-yellow-600 text-white px-3 py-1 rounded text-sm">Apply Override</button>
        </div>
      )}
    </div>
  );
}
