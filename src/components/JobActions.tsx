'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STATUSES = [
  'pending_schedule', 'scheduled', 'in_progress', 'substantially_complete', 'closed', 'cancelled',
] as const;

export function JobStatusSelect({ jobId, currentStatus }: { jobId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function update() {
    setLoading(true);
    const res = await fetch(`/api/v1/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    if ((await res.json()).success) router.refresh();
  }

  return (
    <div className="flex gap-2 items-center">
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1 text-xs">
        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
      </select>
      <button onClick={update} disabled={loading || status === currentStatus} className="text-xs border px-2 py-1 rounded">
        {loading ? '...' : 'Update'}
      </button>
    </div>
  );
}
