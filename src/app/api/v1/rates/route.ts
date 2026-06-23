import { apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const [products, laborRates, productionRates, equipmentRates, marginProfiles, overheadProfiles] =
    await Promise.all([
      prisma.product.findMany({ where: { active: true }, orderBy: { serviceCode: 'asc' } }),
      prisma.laborRate.findMany({ where: { active: true } }),
      prisma.productionRate.findMany({ where: { active: true } }),
      prisma.equipmentRate.findMany({ where: { active: true } }),
      prisma.marginProfile.findMany({ where: { active: true } }),
      prisma.overheadProfile.findMany({ where: { active: true } }),
    ]);

  return apiSuccess({
    products,
    labor_rates: laborRates,
    production_rates: productionRates,
    equipment_rates: equipmentRates,
    margin_profiles: marginProfiles,
    overhead_profiles: overheadProfiles,
  });
}
