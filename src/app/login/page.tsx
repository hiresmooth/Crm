'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    });
    const json = await res.json();
    setLoading(false);
    if (!json.success) {
      setError(json.errors?.[0]?.message ?? 'Login failed');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white border rounded-lg shadow-sm p-6">
        <div className="w-10 h-10 bg-smooth-orange rounded mb-4" />
        <h1 className="text-xl font-bold text-smooth-black">SmoothOS Estimate</h1>
        <p className="text-sm text-gray-500 mb-6">Smooth Construction Services</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input name="email" type="email" required defaultValue="estimator@smoothconstruction.com" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
            <input name="password" type="password" required defaultValue="smooth2025!" className="w-full border rounded px-3 py-2" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-smooth-orange text-white py-2 rounded-md font-medium disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
