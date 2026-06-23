export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const estimators = await prisma.user.findMany({
    where: { role: 'estimator', isActive: true },
  });

  const results = await Promise.all(
    estimators.map(async (user) => {
      const estimates = await prisma.estimate.findMany({
        where: { estimatorUserId: user.id },
        include: { lead: true, proposals: true },
      });
      const created = estimates.length;
      const turnarounds = estimates
        .filter((e) => e.approvedAt)
        .map((e) => (e.approvedAt!.getTime() - e.lead.createdAt.getTime()) / 3600000);
      const won = estimates.filter((e) => e.proposals.some((p) => p.status === 'client_approved')).length;
      const sent = estimates.filter((e) => e.proposals.some((p) => p.sentAt)).length;
      const revisions = estimates.filter((e) => e.version > 1).length;
      const margins = estimates.filter((e) => e.grossMarginPct).map((e) => Number(e.grossMarginPct));
      const approved = estimates.filter((e) => e.status === 'approved' || e.status === 'superseded').length;

      return {
        user_id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        estimates_created: created,
        avg_turnaround_hours: turnarounds.length ? turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length : 0,
        win_rate: sent > 0 ? won / sent : 0,
        revision_rate: created > 0 ? revisions / created : 0,
        avg_margin: margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0,
        approval_rate: created > 0 ? approved / created : 0,
      };
    })
  );

  return apiSuccess({ estimators: results });
}
