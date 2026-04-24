/**
 * Seed: realistic Phase 1 data — org, users, technicians, customers, leads, jobs
 * Run: pnpm db:seed  (from packages/db)
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });

const ORG_ID = 'org-handyman-gold-hands';
const ADMIN_ID = 'user-farrukh-admin';
const DISPATCHER_ID = 'user-david-dispatcher';

async function main() {
  console.log('Seeding database...');

  // ── Organization ──────────────────────────────────────────────────────────
  await db.organization.upsert({
    where: { id: ORG_ID },
    create: {
      id: ORG_ID,
      name: 'Handyman Gold Hands',
      slug: 'handyman-gold-hands',
      plan: 'starter',
      brandColor: '#F59E0B',
      phone: '+13055550100',
      email: 'ops@handymangoldhands.com',
      timezone: 'America/New_York',
      address: JSON.stringify({ line1: '100 SE 1st Ave', city: 'Miami', state: 'FL', zip: '33131', country: 'US' }),
    },
    update: {},
  });
  console.log('  org: OK');

  // ── Users ─────────────────────────────────────────────────────────────────
  await db.user.upsert({
    where: { id: ADMIN_ID },
    create: { id: ADMIN_ID, orgId: ORG_ID, email: 'farrukh@handymangoldhands.com', fullName: 'Farrukh Rakhimov', role: 'admin', phone: '+13055550001' },
    update: {},
  });

  await db.user.upsert({
    where: { id: DISPATCHER_ID },
    create: { id: DISPATCHER_ID, orgId: ORG_ID, email: 'david@handymangoldhands.com', fullName: 'David (Dispatcher)', role: 'dispatcher' },
    update: {},
  });

  const techUsers = [
    { id: 'user-tech-miguel', email: 'miguel@hgh.com', fullName: 'Miguel Rodriguez' },
    { id: 'user-tech-carlos', email: 'carlos@hgh.com', fullName: 'Carlos Rivera' },
    { id: 'user-tech-diego', email: 'diego@hgh.com', fullName: 'Diego Mendez' },
    { id: 'user-tech-alex', email: 'alex@hgh.com', fullName: 'Alex Kim' },
    { id: 'user-tech-jose', email: 'jose@hgh.com', fullName: 'Jose Hernandez' },
  ];
  for (const u of techUsers) {
    await db.user.upsert({
      where: { id: u.id },
      create: { ...u, orgId: ORG_ID, role: 'tech' },
      update: {},
    });
  }
  console.log('  users: OK');

  // ── Technicians ───────────────────────────────────────────────────────────
  const technicians = [
    { id: 'tech-miguel', userId: 'user-tech-miguel', skills: { plumbing: 'advanced', general: 'intermediate', electrical: 'basic' }, rating: 4.8, totalJobs: 42, hourlyCost: 35, employmentType: 'w2' },
    { id: 'tech-carlos', userId: 'user-tech-carlos', skills: { electrical: 'advanced', hvac: 'intermediate', general: 'advanced' }, rating: 4.6, totalJobs: 38, hourlyCost: 40, employmentType: 'w2' },
    { id: 'tech-diego', userId: 'user-tech-diego', skills: { carpentry: 'advanced', painting: 'advanced', general: 'intermediate' }, rating: 4.9, totalJobs: 51, hourlyCost: 38, employmentType: 'contractor_1099' },
    { id: 'tech-alex', userId: 'user-tech-alex', skills: { plumbing: 'intermediate', general: 'advanced', tiling: 'intermediate' }, rating: 4.7, totalJobs: 29, hourlyCost: 36, employmentType: 'w2' },
    { id: 'tech-jose', userId: 'user-tech-jose', skills: { electrical: 'intermediate', general: 'advanced', painting: 'basic' }, rating: 4.5, totalJobs: 33, hourlyCost: 32, employmentType: 'contractor_1099' },
  ];
  for (const t of technicians) {
    await db.technician.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        orgId: ORG_ID,
        userId: t.userId,
        hireDate: new Date('2024-03-01'),
        hourlyCost: t.hourlyCost,
        skills: JSON.stringify(t.skills),
        certifications: JSON.stringify([]),
        rating: t.rating,
        totalJobs: t.totalJobs,
        isActive: true,
        employmentType: t.employmentType,
      },
      update: {},
    });
  }
  console.log('  technicians: OK');

  // ── Customers + Properties ────────────────────────────────────────────────
  const customers = [
    { id: 'cust-001', billingName: 'John Martinez', email: 'john.martinez@gmail.com', phone: '+13055551001', type: 'residential', source: 'google_lsa', lifetimeValue: 2450, addr: { line1: '1234 SW 8th St', city: 'Miami', state: 'FL', zip: '33135' } },
    { id: 'cust-002', billingName: 'Sarah Johnson', email: 'sarah.johnson@yahoo.com', phone: '+13055551002', type: 'residential', source: 'thumbtack', lifetimeValue: 890, addr: { line1: '5678 NW 36th Ave', city: 'Miami', state: 'FL', zip: '33142' } },
    { id: 'cust-003', billingName: 'Mike Thompson', email: 'mike.t@outlook.com', phone: '+17135551003', type: 'residential', source: 'referral', lifetimeValue: 3200, addr: { line1: '9 Bayou Bend', city: 'Houston', state: 'TX', zip: '77019' } },
    { id: 'cust-004', billingName: 'Emma Wilson', email: 'emma.wilson@gmail.com', phone: '+14045551004', type: 'residential', source: 'google_lsa', lifetimeValue: 0, addr: { line1: '321 Peachtree Rd', city: 'Atlanta', state: 'GA', zip: '30308' } },
    { id: 'cust-005', billingName: 'Robert Brown', email: 'rbrown@gmail.com', phone: '+12155551005', type: 'residential', source: 'yelp', lifetimeValue: 1750, addr: { line1: '456 Market St', city: 'Philadelphia', state: 'PA', zip: '19106' } },
    { id: 'cust-006', billingName: 'Sunrise Property Mgmt', companyName: 'Sunrise Property Management LLC', email: 'ops@sunriseprop.com', phone: '+13055551006', type: 'commercial', source: 'direct', lifetimeValue: 12800, addr: { line1: '800 Brickell Ave', city: 'Miami', state: 'FL', zip: '33131' } },
    { id: 'cust-007', billingName: 'Lisa Chen', email: 'lisa.chen@hotmail.com', phone: '+17045551007', type: 'residential', source: 'google_lsa', lifetimeValue: 560, addr: { line1: '222 Trade St', city: 'Charlotte', state: 'NC', zip: '28202' } },
    { id: 'cust-008', billingName: 'David Park', email: 'dpark@gmail.com', phone: '+17735551008', type: 'residential', source: 'thumbtack', lifetimeValue: 980, addr: { line1: '100 N Michigan Ave', city: 'Chicago', state: 'IL', zip: '60601' } },
    { id: 'cust-009', billingName: 'Angela Torres', email: 'angelat@gmail.com', phone: '+12025551009', type: 'residential', source: 'referral', lifetimeValue: 1200, addr: { line1: '1600 K St NW', city: 'Washington', state: 'DC', zip: '20006' } },
    { id: 'cust-010', billingName: 'Kevin Hall', email: 'kevin.hall@gmail.com', phone: '+18135551010', type: 'residential', source: 'web_form', lifetimeValue: 0, addr: { line1: '444 N Ashley Dr', city: 'Tampa', state: 'FL', zip: '33602' } },
  ];

  for (const c of customers) {
    await db.customer.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        orgId: ORG_ID,
        type: c.type,
        billingName: c.billingName,
        companyName: (c as any).companyName ?? null,
        email: c.email,
        phone: c.phone,
        billingAddress: JSON.stringify({ ...c.addr, country: 'US' }),
        tags: JSON.stringify([]),
        source: c.source,
        lifetimeValue: c.lifetimeValue,
        firstServiceAt: c.lifetimeValue > 0 ? new Date('2025-01-10') : null,
        lastServiceAt: c.lifetimeValue > 0 ? new Date('2026-03-15') : null,
      },
      update: {},
    });

    const propId = `prop-${c.id}`;
    await db.property.upsert({
      where: { id: propId },
      create: {
        id: propId,
        orgId: ORG_ID,
        customerId: c.id,
        addressLine1: c.addr.line1,
        city: c.addr.city,
        state: c.addr.state,
        zip: c.addr.zip,
        isPrimary: true,
      },
      update: {},
    });
  }
  console.log('  customers + properties: OK');

  // ── Leads ─────────────────────────────────────────────────────────────────
  const now = new Date('2026-04-18T10:00:00');
  const h = (n: number) => new Date(now.getTime() - n * 3600000);

  const leads = [
    { id: 'lead-001', source: 'google_lsa', serviceType: 'plumbing', description: 'Kitchen sink leaking under cabinet, water damage starting. Need ASAP.', zip: '33135', status: 'new', score: 82, customerId: 'cust-001', receivedAt: h(2) },
    { id: 'lead-002', source: 'thumbtack', serviceType: 'electrical', description: 'Install 4 ceiling fans in bedrooms. House built 2005.', zip: '33142', status: 'contacted', score: 65, customerId: 'cust-002', receivedAt: h(5) },
    { id: 'lead-003', source: 'web_form', serviceType: 'general', description: "Fix 3 doors that don't close properly, door frames warped.", zip: '33602', status: 'new', score: 50, customerId: null, receivedAt: h(0.5) },
    { id: 'lead-004', source: 'google_lsa', serviceType: 'carpentry', description: 'Build built-in shelving unit in home office. Custom, floor to ceiling.', zip: '28202', status: 'qualified', score: 91, customerId: 'cust-007', receivedAt: h(24) },
    { id: 'lead-005', source: 'referral', serviceType: 'plumbing', description: 'Bathroom remodel — replace toilet, vanity, re-tile shower floor.', zip: '20006', status: 'new', score: 78, customerId: 'cust-009', receivedAt: h(1) },
    { id: 'lead-006', source: 'yelp', serviceType: 'painting', description: 'Interior painting of 3-bedroom apartment. Walls + ceilings.', zip: '19106', status: 'dead', score: 20, customerId: 'cust-005', receivedAt: h(72) },
    { id: 'lead-007', source: 'phone', serviceType: 'electrical', description: 'Breaker keeps tripping. Smell of burning from panel. URGENT.', zip: '30308', status: 'converted', score: 95, customerId: 'cust-004', receivedAt: h(48), convertedAt: h(46) },
    { id: 'lead-008', source: 'google_lsa', serviceType: 'general', description: 'Pressure washing — driveway, patio, pool deck. 3000 sqft total.', zip: '33131', status: 'contacted', score: 60, customerId: 'cust-006', receivedAt: h(12) },
  ];

  for (const l of leads) {
    await db.lead.upsert({
      where: { id: l.id },
      create: {
        id: l.id,
        orgId: ORG_ID,
        source: l.source,
        sourceMeta: JSON.stringify({}),
        customerId: l.customerId,
        serviceType: l.serviceType,
        description: l.description,
        zip: l.zip,
        status: l.status,
        score: l.score,
        receivedAt: l.receivedAt,
        convertedAt: (l as any).convertedAt ?? null,
      },
      update: {},
    });
  }
  console.log('  leads: OK');

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const jobs = [
    { id: 'job-001', jobNumber: 'J-2026-0001', customerId: 'cust-001', propertyId: 'prop-cust-001', leadId: null, jobType: 'repair', category: 'plumbing', description: 'Kitchen faucet dripping constantly. Replace cartridge or full faucet.', status: 'in_progress', priority: 'normal', techId: 'tech-miguel', scheduledStart: new Date('2026-04-18T09:00:00'), scheduledEnd: new Date('2026-04-18T11:00:00'), actualStart: new Date('2026-04-18T09:15:00'), estimatedRevenue: 280 },
    { id: 'job-002', jobNumber: 'J-2026-0002', customerId: 'cust-002', propertyId: 'prop-cust-002', leadId: null, jobType: 'install', category: 'electrical', description: 'Install 4 ceiling fans in master bedroom, 2 kids rooms, and guest room.', status: 'scheduled', priority: 'normal', techId: 'tech-carlos', scheduledStart: new Date('2026-04-18T13:00:00'), scheduledEnd: new Date('2026-04-18T17:00:00'), estimatedRevenue: 680 },
    { id: 'job-003', jobNumber: 'J-2026-0003', customerId: 'cust-003', propertyId: 'prop-cust-003', leadId: null, jobType: 'repair', category: 'general', description: 'Repair 3 interior doors — hinges, frames, alignment. One door needs new handle.', status: 'completed', priority: 'normal', techId: 'tech-diego', scheduledStart: new Date('2026-04-18T08:00:00'), scheduledEnd: new Date('2026-04-18T11:00:00'), actualStart: new Date('2026-04-18T08:05:00'), actualEnd: new Date('2026-04-18T10:45:00'), estimatedRevenue: 320, actualRevenue: 340, customerRating: 5 },
    { id: 'job-004', jobNumber: 'J-2026-0004', customerId: 'cust-004', propertyId: 'prop-cust-004', leadId: null, jobType: 'repair', category: 'plumbing', description: 'Kitchen sink drain clogged, slow draining. Check for grease buildup.', status: 'new', priority: 'normal', techId: null, estimatedRevenue: 180 },
    { id: 'job-005', jobNumber: 'J-2026-0005', customerId: 'cust-005', propertyId: 'prop-cust-005', leadId: null, jobType: 'repair', category: 'plumbing', description: 'Replace water heater — current unit 15 years old, leaking at base.', status: 'dispatched', priority: 'high', techId: 'tech-miguel', scheduledStart: new Date('2026-04-18T14:00:00'), scheduledEnd: new Date('2026-04-18T17:30:00'), estimatedRevenue: 1200 },
    { id: 'job-006', jobNumber: 'J-2026-0006', customerId: 'cust-006', propertyId: 'prop-cust-006', leadId: null, jobType: 'maintenance', category: 'general', description: 'Monthly maintenance — 8 units. HVAC filters, caulk bathrooms, smoke detectors.', status: 'invoiced', priority: 'normal', techId: 'tech-alex', scheduledStart: new Date('2026-04-17T09:00:00'), scheduledEnd: new Date('2026-04-17T17:00:00'), actualStart: new Date('2026-04-17T09:10:00'), actualEnd: new Date('2026-04-17T16:50:00'), estimatedRevenue: 2400, actualRevenue: 2400, customerRating: 4 },
    { id: 'job-007', jobNumber: 'J-2026-0007', customerId: 'cust-007', propertyId: 'prop-cust-007', leadId: 'lead-004', jobType: 'install', category: 'carpentry', description: 'Custom built-in shelving unit — floor to ceiling home office. White oak finish.', status: 'scheduled', priority: 'normal', techId: 'tech-diego', scheduledStart: new Date('2026-04-19T09:00:00'), scheduledEnd: new Date('2026-04-19T17:00:00'), estimatedRevenue: 1800 },
    { id: 'job-008', jobNumber: 'J-2026-0008', customerId: 'cust-008', propertyId: 'prop-cust-008', leadId: null, jobType: 'repair', category: 'plumbing', description: 'Fix leaking bathroom faucet and replace toilet fill valve.', status: 'paid', priority: 'normal', techId: 'tech-miguel', scheduledStart: new Date('2026-04-16T10:00:00'), scheduledEnd: new Date('2026-04-16T12:00:00'), actualStart: new Date('2026-04-16T10:05:00'), actualEnd: new Date('2026-04-16T11:55:00'), estimatedRevenue: 260, actualRevenue: 260, customerRating: 5 },
    { id: 'job-009', jobNumber: 'J-2026-0009', customerId: 'cust-009', propertyId: 'prop-cust-009', leadId: null, jobType: 'install', category: 'electrical', description: 'Install 2 outdoor security lights with motion sensors.', status: 'en_route', priority: 'normal', techId: 'tech-jose', scheduledStart: new Date('2026-04-18T11:00:00'), scheduledEnd: new Date('2026-04-18T13:00:00'), estimatedRevenue: 380 },
    { id: 'job-010', jobNumber: 'J-2026-0010', customerId: 'cust-010', propertyId: 'prop-cust-010', leadId: null, jobType: 'install', category: 'general', description: 'Install TV wall mount (75") in living room, run HDMI cable through wall.', status: 'canceled', priority: 'low', techId: 'tech-alex', scheduledStart: new Date('2026-04-17T14:00:00'), scheduledEnd: new Date('2026-04-17T16:00:00'), estimatedRevenue: 220 },
  ];

  for (const j of jobs) {
    await db.job.upsert({
      where: { id: j.id },
      create: {
        id: j.id,
        orgId: ORG_ID,
        jobNumber: j.jobNumber,
        customerId: j.customerId,
        propertyId: j.propertyId,
        leadId: j.leadId ?? null,
        jobType: j.jobType,
        category: j.category,
        description: j.description,
        status: j.status,
        priority: j.priority,
        assignedTechnicianId: j.techId ?? null,
        dispatcherId: DISPATCHER_ID,
        scheduledStart: (j as any).scheduledStart ?? null,
        scheduledEnd: (j as any).scheduledEnd ?? null,
        actualStart: (j as any).actualStart ?? null,
        actualEnd: (j as any).actualEnd ?? null,
        estimatedRevenue: (j as any).estimatedRevenue ?? null,
        actualRevenue: (j as any).actualRevenue ?? null,
        customerRating: (j as any).customerRating ?? null,
      },
      update: {},
    });
  }
  console.log('  jobs: OK');

  // ── Job Items ─────────────────────────────────────────────────────────────
  const jobItemSets = [
    { jobId: 'job-003', items: [
      { id: 'ji-003-1', itemType: 'labor', name: 'Door alignment & hinge repair (3 doors)', qty: 2.5, unitPrice: 85, sortOrder: 0 },
      { id: 'ji-003-2', itemType: 'part', name: 'Door hinges (set of 3)', qty: 3, unitPrice: 12, sortOrder: 1 },
      { id: 'ji-003-3', itemType: 'part', name: 'Door handle set', qty: 1, unitPrice: 45, sortOrder: 2 },
    ]},
    { jobId: 'job-006', items: [
      { id: 'ji-006-1', itemType: 'service', name: 'Monthly maintenance — 8 units', qty: 8, unitPrice: 280, sortOrder: 0 },
      { id: 'ji-006-2', itemType: 'part', name: 'HVAC filters (16x)', qty: 16, unitPrice: 12, sortOrder: 1 },
      { id: 'ji-006-3', itemType: 'part', name: 'Caulk & supplies', qty: 1, unitPrice: 48, sortOrder: 2 },
      { id: 'ji-006-4', itemType: 'discount', name: 'Contract discount (5%)', qty: 1, unitPrice: -160, sortOrder: 3 },
    ]},
    { jobId: 'job-008', items: [
      { id: 'ji-008-1', itemType: 'labor', name: 'Faucet repair & toilet fill valve', qty: 1.5, unitPrice: 85, sortOrder: 0 },
      { id: 'ji-008-2', itemType: 'part', name: 'Toilet fill valve assembly', qty: 1, unitPrice: 28, sortOrder: 1 },
      { id: 'ji-008-3', itemType: 'part', name: 'Faucet cartridge', qty: 1, unitPrice: 35, sortOrder: 2 },
      { id: 'ji-008-4', itemType: 'service', name: 'Service call fee', qty: 1, unitPrice: 69.5, sortOrder: 3 },
    ]},
  ];

  for (const set of jobItemSets) {
    for (const item of set.items) {
      await db.jobItem.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          orgId: ORG_ID,
          jobId: set.jobId,
          itemType: item.itemType,
          name: item.name,
          qty: item.qty,
          unitPrice: item.unitPrice,
          total: item.qty * item.unitPrice,
          sortOrder: item.sortOrder,
        },
        update: {},
      });
    }
  }
  console.log('  job items: OK');

  // ── Invoices ──────────────────────────────────────────────────────────────
  await db.invoice.upsert({
    where: { id: 'inv-001' },
    create: {
      id: 'inv-001', orgId: ORG_ID, jobId: 'job-006', customerId: 'cust-006',
      invoiceNumber: 'INV-2026-0001', status: 'sent',
      subtotal: 2560, tax: 0, total: 2560, amountPaid: 0,
      dueDate: new Date('2026-05-17'), sentAt: new Date('2026-04-17T18:00:00'),
    },
    update: {},
  });

  await db.invoice.upsert({
    where: { id: 'inv-002' },
    create: {
      id: 'inv-002', orgId: ORG_ID, jobId: 'job-008', customerId: 'cust-008',
      invoiceNumber: 'INV-2026-0002', status: 'paid',
      subtotal: 260, tax: 0, total: 260, amountPaid: 260,
      dueDate: new Date('2026-04-30'),
      sentAt: new Date('2026-04-16T14:00:00'),
      paidAt: new Date('2026-04-16T15:30:00'),
    },
    update: {},
  });
  console.log('  invoices: OK');

  console.log('\nSeed complete!');
  console.log(`  Org ID    : ${ORG_ID}`);
  console.log(`  Admin ID  : ${ADMIN_ID}`);
  console.log(`  Customers : ${customers.length}`);
  console.log(`  Leads     : ${leads.length}`);
  console.log(`  Jobs      : ${jobs.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
