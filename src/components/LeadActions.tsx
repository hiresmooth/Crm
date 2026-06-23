'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STAGES = [
  'new_lead', 'contacted', 'estimate_in_progress', 'proposal_sent',
  'follow_up_needed', 'won', 'lost',
] as const;

export function LeadStageActions({ leadId, currentStage }: { leadId: string; currentStage: string }) {
  const router = useRouter();
  const [stage, setStage] = useState(currentStage);
  const [loading, setLoading] = useState(false);

  async function updateStage() {
    setLoading(true);
    const res = await fetch(`/api/v1/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    });
    setLoading(false);
    if ((await res.json()).success) router.refresh();
  }

  return (
    <div className="flex gap-2 items-center">
      <select value={stage} onChange={(e) => setStage(e.target.value)} className="border rounded px-2 py-1 text-sm">
        {STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
      </select>
      <button onClick={updateStage} disabled={loading || stage === currentStage} className="border px-3 py-1 rounded text-sm">
        {loading ? '...' : 'Update Stage'}
      </button>
    </div>
  );
}

export function DocumentUpload({ leadId, estimateId }: { leadId: string; estimateId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append('file', file);
    const up = await fetch('/api/v1/upload', { method: 'POST', body: form });
    const upJson = await up.json();
    if (!upJson.success) {
      setLoading(false);
      alert('Upload failed');
      return;
    }
    await fetch('/api/v1/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: leadId,
        estimate_id: estimateId,
        file_name: file.name,
        file_url: `${window.location.origin}${upJson.data.file_url}`,
        mime_type: file.type,
      }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <label className="inline-flex items-center gap-2 border px-3 py-1.5 rounded text-sm cursor-pointer hover:bg-gray-50">
      {loading ? 'Uploading...' : 'Upload Document'}
      <input type="file" className="hidden" onChange={upload} disabled={loading} />
    </label>
  );
}
