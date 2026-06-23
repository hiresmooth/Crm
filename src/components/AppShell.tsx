import Link from 'next/link';
import { clsx } from 'clsx';

const nav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/estimates', label: 'Estimates' },
  { href: '/proposals', label: 'Proposals' },
  { href: '/admin/rates', label: 'Rate Tables' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-smooth-black text-white border-b-4 border-smooth-orange">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-smooth-orange rounded" />
            <div>
              <div className="font-bold text-lg leading-tight">SmoothOS Estimate</div>
              <div className="text-xs text-gray-400">Smooth Construction Services · Boston, MA</div>
            </div>
          </div>
          <div className="text-xs text-gray-400">Phase 1 — Core Revenue Engine</div>
        </div>
      </header>
      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        <aside className="w-52 shrink-0 border-r bg-white p-4 hidden md:block">
          <nav className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'block px-3 py-2 rounded-md text-sm font-medium',
                  'text-gray-700 hover:bg-orange-50 hover:text-smooth-orange'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white rounded-lg border shadow-sm', className)}>
      {title && (
        <div className="px-4 py-3 border-b font-semibold text-smooth-black">{title}</div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function MarginBadge({ status, gm }: { status: string; gm?: number }) {
  const colors: Record<string, string> = {
    green: 'bg-green-100 text-green-800 border-green-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    red: 'bg-red-100 text-red-800 border-red-300',
    min_job_adjusted: 'bg-orange-100 text-orange-800 border-orange-300',
  };
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', colors[status] ?? 'bg-gray-100')}>
      {status.replace(/_/g, ' ').toUpperCase()}
      {gm !== undefined && ` · ${(gm * 100).toFixed(1)}% GM`}
    </span>
  );
}

export function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-smooth-black mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export function formatCurrency(n: number | string | { toString(): string } | null | undefined) {
  const val = Number(n ?? 0);
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border">
      {status.replace(/_/g, ' ')}
    </span>
  );
}
