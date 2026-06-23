import { AppShell } from '@/components/AppShell';
import { getSession } from '@/lib/auth';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return <AppShell user={session}>{children}</AppShell>;
}
