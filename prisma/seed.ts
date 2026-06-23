import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SmoothOS database...');

  const passwordHash = await bcrypt.hash('smooth2025!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@smoothconstruction.com' },
    update: {},
    create: {
      email: 'admin@smoothconstruction.com',
      passwordHash,
      firstName: 'Smooth',
      lastName: 'Admin',
      role: 'admin',
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@smoothconstruction.com' },
    update: {},
    create: {
      email: 'manager@smoothconstruction.com',
      passwordHash,
      firstName: 'Pat',
      lastName: 'Manager',
      role: 'manager',
    },
  });

  const estimator = await prisma.user.upsert({
    where: { email: 'estimator@smoothconstruction.com' },
    update: {},
    create: {
      email: 'estimator@smoothconstruction.com',
      passwordHash,
      firstName: 'James',
      lastName: 'Chen',
      role: 'estimator',
    },
  });

  const overhead = await prisma.overheadProfile.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Boston Standard 2025',
      overheadPct: 0.18,
      isDefault: true,
      active: true,
    },
  });

  const margin = await prisma.marginProfile.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Boston Default 2025',
      greenMinPct: 0.35,
      yellowMinPct: 0.28,
      redMinPct: 0,
      minJobCharge: 850,
      smallJobThreshold: 1200,
      smallJobFee: 150,
      rushMultiplier: 1.15,
      rushMaterialSurchargePct: 0.05,
      repeatLayoutDiscountPct: 0.12,
      repeatLayoutMinUnits: 4,
      highValueThreshold: 25000,
      accessMultipliers: {
        standard: 1.0,
        moderate: 1.1,
        difficult: 1.25,
        extreme: 1.45,
      },
      roundingIncrement: 5,
      isDefault: true,
      active: true,
    },
  });

  const installerLabor = await prisma.laborRate.upsert({
    where: { id: '00000000-0000-4000-8000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000010',
      tradeCode: 'insulation_installer',
      tradeName: 'Insulation Installer',
      burdenedRateHr: 68,
      active: true,
    },
  });

  const finisherLabor = await prisma.laborRate.upsert({
    where: { id: '00000000-0000-4000-8000-000000000011' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000011',
      tradeCode: 'drywall_finisher',
      tradeName: 'Drywall Finisher',
      burdenedRateHr: 68,
      active: true,
    },
  });

  const plasterLabor = await prisma.laborRate.upsert({
    where: { id: '00000000-0000-4000-8000-000000000012' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000012',
      tradeCode: 'plasterer',
      tradeName: 'Plasterer',
      burdenedRateHr: 78,
      active: true,
    },
  });

  const windowLabor = await prisma.laborRate.upsert({
    where: { id: '00000000-0000-4000-8000-000000000013' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000013',
      tradeCode: 'window_installer',
      tradeName: 'Window Installer',
      burdenedRateHr: 72,
      active: true,
    },
  });

  await prisma.equipmentRate.upsert({
    where: { code: 'SPRAY_RIG_DAY' },
    update: {},
    create: {
      code: 'SPRAY_RIG_DAY',
      name: 'Spray Foam Rig (daily)',
      chargeType: 'per_job_allocation',
      rateAmount: 450,
      allocationPct: 0.35,
      serviceCodes: ['closed_cell_foam', 'open_cell_foam', 'basement_insulation', 'crawl_space_insulation'],
      active: true,
    },
  });

  await prisma.equipmentRate.upsert({
    where: { code: 'BLOWER_DAY' },
    update: {},
    create: {
      code: 'BLOWER_DAY',
      name: 'Insulation Blower (daily)',
      chargeType: 'per_job_allocation',
      rateAmount: 175,
      allocationPct: 0.25,
      serviceCodes: ['attic_insulation', 'blow_in_insulation'],
      active: true,
    },
  });

  await prisma.equipmentRate.upsert({
    where: { code: 'MOB_LOCAL' },
    update: {},
    create: {
      code: 'MOB_LOCAL',
      name: 'Local Mobilization',
      chargeType: 'flat',
      rateAmount: 350,
      serviceCodes: [],
      active: true,
    },
  });

  const products = [
    { sku: 'CC-SF-2.0', name: 'Closed Cell 2.0 lb Spray Foam', serviceCode: 'closed_cell_foam' as const, unit: 'board_ft' as const, unitCost: 1.45, waste: 0.08 },
    { sku: 'OC-SF-0.5', name: 'Open Cell 0.5 lb Spray Foam', serviceCode: 'open_cell_foam' as const, unit: 'board_ft' as const, unitCost: 0.62, waste: 0.1 },
    { sku: 'CELL-R49', name: 'Blow-In Cellulose R-49', serviceCode: 'attic_insulation' as const, unit: 'sq_ft' as const, unitCost: 0.42, waste: 0.05, r: 3.7 },
    { sku: 'AIR-SEAL-KIT', name: 'Air Sealing Materials Kit', serviceCode: 'air_sealing' as const, unit: 'sq_ft' as const, unitCost: 0.18, waste: 0.05 },
    { sku: 'DW-L4', name: 'Drywall Level 4 (blended)', serviceCode: 'drywall' as const, unit: 'sq_ft' as const, unitCost: 1.65, waste: 0.15 },
    { sku: 'PLASTER-VENEER', name: 'Veneer Plaster System', serviceCode: 'plastering' as const, unit: 'sq_ft' as const, unitCost: 1.85, waste: 0.05 },
    { sku: 'WIN-MED', name: 'Medium Replacement Window', serviceCode: 'window_replacement' as const, unit: 'each' as const, unitCost: 425, waste: 0.02 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku,
        name: p.name,
        serviceCode: p.serviceCode,
        unit: p.unit,
        unitCost: p.unitCost,
        defaultWastePct: p.waste,
        rValuePerInch: p.r ?? null,
        active: true,
      },
    });
  }

  const productionRates = [
    { serviceCode: 'closed_cell_foam' as const, unit: 'board_ft' as const, unitsPerHour: 120 },
    { serviceCode: 'open_cell_foam' as const, unit: 'board_ft' as const, unitsPerHour: 180 },
    { serviceCode: 'attic_insulation' as const, unit: 'sq_ft' as const, unitsPerHour: 900 },
    { serviceCode: 'basement_insulation' as const, unit: 'sq_ft' as const, unitsPerHour: 85 },
    { serviceCode: 'blow_in_insulation' as const, unit: 'sq_ft' as const, unitsPerHour: 900 },
    { serviceCode: 'air_sealing' as const, unit: 'sq_ft' as const, unitsPerHour: 600 },
    { serviceCode: 'drywall' as const, unit: 'sq_ft' as const, unitsPerHour: 55, finish: 'level_4' as const },
    { serviceCode: 'plastering' as const, unit: 'sq_ft' as const, unitsPerHour: 45 },
    { serviceCode: 'window_replacement' as const, unit: 'each' as const, unitsPerHour: 1 },
  ];

  for (const pr of productionRates) {
    const existing = await prisma.productionRate.findFirst({
      where: { serviceCode: pr.serviceCode, active: true },
    });
    if (!existing) {
      await prisma.productionRate.create({
        data: {
          serviceCode: pr.serviceCode,
          name: `${pr.serviceCode} standard`,
          unit: pr.unit,
          unitsPerHour: pr.unitsPerHour,
          finishLevel: pr.finish ?? null,
          active: true,
        },
      });
    }
  }

  await prisma.termsTemplate.upsert({
    where: { id: '00000000-0000-4000-8000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000020',
      name: 'Residential Standard MA',
      bodyHtml: `<p>This proposal is valid for 30 calendar days. A deposit of {{deposit_pct}}% ({{deposit_amount}}) is required to confirm scheduling. Pricing is subject to field verification if conditions differ materially from assumptions.</p>`,
      isDefault: true,
      active: true,
    },
  });

  const client = await prisma.client.upsert({
    where: { id: '00000000-0000-4000-8000-000000000100' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000100',
      firstName: 'Maria',
      lastName: 'Santos',
      email: 'maria.santos@example.com',
      phone: '+16175551234',
      billingCity: 'Somerville',
      billingState: 'MA',
      billingZip: '02143',
    },
  });

  const lead = await prisma.lead.upsert({
    where: { leadNumber: 'L-2025-00001' },
    update: {},
    create: {
      leadNumber: 'L-2025-00001',
      clientId: client.id,
      source: 'website_organic',
      stage: 'contacted',
      serviceType: 'attic_insulation',
      projectType: 'residential',
      projectStreet: '42 Elm Street',
      projectCity: 'Somerville',
      projectState: 'MA',
      projectZip: '02143',
      description: 'Attic drafty — interested in blow-in cellulose and air sealing.',
      assignedEstimatorUserId: estimator.id,
      assignedSalesUserId: manager.id,
      contactedAt: new Date(),
    },
  });

  console.log('Seed complete:', { admin: admin.email, lead: lead.leadNumber });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
