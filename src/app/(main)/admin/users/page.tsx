'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/AppShell';

type User = { id: string; email: string; firstName: string; lastName: string; role: string; isActive: boolean };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', role: 'estimator' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/v1/admin/users').then((r) => r.json()).then((j) => { if (j.success) setUsers(j.data); });
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const j = await res.json();
    if (j.success) {
      setUsers((u) => [j.data, ...u]);
      setMsg('User created');
      setForm({ email: '', password: '', first_name: '', last_name: '', role: 'estimator' });
    } else setMsg(j.errors?.[0]?.message ?? 'Failed');
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch('/api/v1/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !isActive }),
    });
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, isActive: !isActive } : x)));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">User Management</h1>
      <Card title="Create User">
        <form onSubmit={createUser} className="grid md:grid-cols-2 gap-3 text-sm">
          <input required placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border rounded px-2 py-1" />
          <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="border rounded px-2 py-1" />
          <input required placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="border rounded px-2 py-1" />
          <input required placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="border rounded px-2 py-1" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="border rounded px-2 py-1">
            {['admin', 'manager', 'estimator', 'sales', 'office'].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="submit" className="bg-smooth-orange text-white rounded px-4 py-1">Create</button>
        </form>
        {msg && <p className="text-sm mt-2 text-green-700">{msg}</p>}
      </Card>
      <Card title="Users">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Name</th><th>Email</th><th>Role</th><th>Active</th><th></th></tr></thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-2">{u.firstName} {u.lastName}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.isActive ? 'Yes' : 'No'}</td>
                <td><button onClick={() => toggleActive(u.id, u.isActive)} className="text-xs border px-2 py-0.5 rounded">{u.isActive ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
