import { apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';

const STAGES = [
  'new_lead', 'contacted', 'estimate_in_progress', 'proposal_sent', 'follow_up_needed', 'won', 'lost',
] as const;

export async function GET() {
  const stages = await Promise.all(
    STAGES.map(async (stage) => {
      const leads = await prisma.lead.findMany({ where: { stage }, include: { estimates: { where: { status: 'approved' }, orderBy: { createdAt: 'desc' }, take: 1 } } });
      const count = leads.length;
      const totalValue = leads.reduce((s, l) => {
        const val = l.estimatedValue ?? l.estimates[0]?.roundedPrice ?? 0;
        return s + Number(val);
      }, 0);
      const avgDays = count
        ? leads.reduce((s, l) => s + (Date.now() - l.stageEnteredAt.getTime()) / 86400000, 0) / count
        : 0;
      const overdue = leads.filter((l) => {
        const days = (Date.now() - l.stageEnteredAt.getTime()) / 86400000;
        if (stage === 'new_lead') return days > 1;
        if (stage === 'proposal_sent' || stage === 'follow_up_needed') return days > 3;
        return false;
      }).length;

      return { stage, count, total_value: totalValue, avg_days_in_stage: Math.round(avgDays * 10) / 10, overdue_count: overdue };
    })
  );

  return apiSuccess({ stages });
}
