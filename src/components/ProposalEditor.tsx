'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ScopeSection = { heading: string; bullets: string[] };

export function ProposalEditor({
  proposalId,
  initialScope,
  clientEmail,
}: {
  proposalId: string;
  initialScope: {
    project_summary?: string;
    scope_of_work?: ScopeSection[];
    assumptions?: string[];
    exclusions?: string[];
  } | null;
  clientEmail?: string | null;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialScope?.project_summary ?? '');
  const [sections, setSections] = useState<ScopeSection[]>(initialScope?.scope_of_work ?? []);
  const [assumptions, setAssumptions] = useState((initialScope?.assumptions ?? []).join('\n'));
  const [exclusions, setExclusions] = useState((initialScope?.exclusions ?? []).join('\n'));
  const [loading, setLoading] = useState('');

  async function save() {
    setLoading('save');
    const res = await fetch(`/api/v1/proposals/${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope_json: {
          project_summary: summary,
          scope_of_work: sections,
          assumptions: assumptions.split('\n').filter(Boolean),
          exclusions: exclusions.split('\n').filter(Boolean),
        },
      }),
    });
    setLoading('');
    if ((await res.json()).success) router.refresh();
  }

  async function regenerateAi() {
    setLoading('ai');
    const res = await fetch(`/api/v1/proposals/${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regenerate_scope_ai: true }),
    });
    const json = await res.json();
    setLoading('');
    if (json.success) {
      const scope = json.data.scopeJson as typeof initialScope;
      setSummary(scope?.project_summary ?? '');
      setSections(scope?.scope_of_work ?? []);
      setAssumptions((scope?.assumptions ?? []).join('\n'));
      setExclusions((scope?.exclusions ?? []).join('\n'));
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={regenerateAi} disabled={!!loading} className="border px-3 py-1.5 rounded text-sm">
          {loading === 'ai' ? 'Generating...' : 'Generate Scope (AI)'}
        </button>
        <button onClick={save} disabled={!!loading} className="bg-smooth-orange text-white px-3 py-1.5 rounded text-sm">
          {loading === 'save' ? 'Saving...' : 'Save Scope'}
        </button>
      </div>
      <div>
        <label className="text-xs text-gray-500 uppercase">Project Summary</label>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="w-full border rounded p-2 text-sm mt-1" />
      </div>
      {sections.map((sec, i) => (
        <div key={i}>
          <input value={sec.heading} onChange={(e) => {
            const next = [...sections];
            next[i] = { ...sec, heading: e.target.value };
            setSections(next);
          }} className="font-semibold text-sm w-full border-b pb-1 mb-1" />
          <textarea
            value={sec.bullets.join('\n')}
            onChange={(e) => {
              const next = [...sections];
              next[i] = { ...sec, bullets: e.target.value.split('\n').filter(Boolean) };
              setSections(next);
            }}
            rows={4}
            className="w-full border rounded p-2 text-sm"
          />
        </div>
      ))}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 uppercase">Assumptions</label>
          <textarea value={assumptions} onChange={(e) => setAssumptions(e.target.value)} rows={4} className="w-full border rounded p-2 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase">Exclusions</label>
          <textarea value={exclusions} onChange={(e) => setExclusions(e.target.value)} rows={4} className="w-full border rounded p-2 text-sm mt-1" />
        </div>
      </div>
      {clientEmail && <p className="text-xs text-gray-400">Client email: {clientEmail}</p>}
    </div>
  );
}
