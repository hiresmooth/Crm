'use client';

import { useEffect, useState } from 'react';
import { Card, formatCurrency, KpiCard } from '@/components/AppShell';

type Alert = { id: string; alertType: string; severity: string; message: string; isRead: boolean };

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    fetch('/api/v1/dashboard/alerts?unread_only=true')
      .then((r) => r.json())
      .then((j) => j.success && setAlerts(j.data.alerts));
  }, []);

  async function dismiss(id: string) {
    await fetch('/api/v1/dashboard/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismiss: true, id }),
    });
    setAlerts((a) => a.filter((x) => x.id !== id));
  }

  const severityColor: Record<string, string> = {
    critical: 'border-red-400 bg-red-50',
    warning: 'border-yellow-400 bg-yellow-50',
    info: 'border-blue-300 bg-blue-50',
  };

  return (
    <Card title="Alerts">
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {alerts.length === 0 && <p className="text-gray-400 text-sm">No active alerts</p>}
        {alerts.map((a) => (
          <div key={a.id} className={`text-xs p-2 rounded border ${severityColor[a.severity] ?? 'border-gray-200'}`}>
            <div className="font-medium">{a.message}</div>
            <button onClick={() => dismiss(a.id)} className="text-gray-500 hover:text-smooth-orange mt-1">
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function PipelineChart({ stages }: { stages: { stage: string; count: number; total_value: number; overdue_count: number }[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="space-y-2">
      {stages.map((s) => (
        <div key={s.stage} className="flex items-center gap-2 text-sm">
          <div className="w-36 text-xs text-gray-600 truncate">{s.stage.replace(/_/g, ' ')}</div>
          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden relative">
            <div className="bg-smooth-orange h-full rounded-full" style={{ width: `${(s.count / max) * 100}%` }} />
            {s.overdue_count > 0 && (
              <span className="absolute right-1 top-0.5 text-[10px] text-red-600 font-medium">{s.overdue_count} overdue</span>
            )}
          </div>
          <div className="w-8 text-right font-medium">{s.count}</div>
          <div className="w-20 text-right text-xs text-gray-500">{formatCurrency(s.total_value)}</div>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart({ points }: { points: { period: string; booked: number; projected: number }[] }) {
  const max = Math.max(...points.flatMap((p) => [p.booked, p.projected]), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {points.map((p) => (
        <div key={p.period} className="flex-1 flex flex-col items-center gap-0.5" title={p.period}>
          <div className="w-full flex gap-0.5 items-end justify-center h-24">
            <div className="w-2 bg-smooth-orange rounded-t" style={{ height: `${(p.booked / max) * 100}%` }} />
            <div className="w-2 bg-gray-300 rounded-t" style={{ height: `${(p.projected / max) * 100}%` }} />
          </div>
          <span className="text-[9px] text-gray-400 rotate-0 truncate w-full text-center">{p.period.slice(-3)}</span>
        </div>
      ))}
    </div>
  );
}
