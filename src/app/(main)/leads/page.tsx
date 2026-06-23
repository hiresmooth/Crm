import Link from 'next/link';
import { Card, StatusBadge } from '@/components/AppShell';
import { prisma } from '@/lib/prisma';

export default async function LeadsPage() {
  let leads: Awaited<
    ReturnType<
      typeof prisma.lead.findMany<{
        include: { client: true; estimates: { select: { id: true; roundedPrice: true; status: true } } };
      }>
    >
  > = [];
  try {
    leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      include: { client: true, estimates: { select: { id: true, roundedPrice: true, status: true } } },
    });
  } catch {
    // empty
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>
        <Link href="/leads/new" className="bg-smooth-orange text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-600">
          + New Lead
        </Link>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2">Lead #</th>
              <th className="pb-2">Client</th>
              <th className="pb-2">City</th>
              <th className="pb-2">Service</th>
              <th className="pb-2">Stage</th>
              <th className="pb-2">Source</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {leads.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">No leads — run npm run db:setup</td></tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="py-2 font-medium">{lead.leadNumber}</td>
                <td>{lead.client.firstName} {lead.client.lastName}</td>
                <td>{lead.projectCity}</td>
                <td>{lead.serviceType.replace(/_/g, ' ')}</td>
                <td><StatusBadge status={lead.stage} /></td>
                <td className="text-gray-500">{lead.source.replace(/_/g, ' ')}</td>
                <td>
                  <Link href={`/leads/${lead.id}`} className="text-smooth-orange hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
