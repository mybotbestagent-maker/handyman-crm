/**
 * One-time Workiz CSV import script.
 *
 * Usage:
 *   npx tsx packages/db/scripts/import-workiz-csv.ts \
 *     --org handyman-gold-hands \
 *     --customers ./workiz-clients.csv \
 *     --jobs ./workiz-jobs.csv \
 *     --leads ./workiz-leads.csv \
 *     --dry-run
 *
 * Expected CSV column names (Workiz export format):
 *
 * clients.csv:
 *   "Client ID","First Name","Last Name","Company","Email","Phone","Alt Phone",
 *   "Address","City","State","Zip","Type","Tags","Created Date"
 *
 * jobs.csv:
 *   "Job ID","Job Number","Client Phone","Service Type","Category","Description",
 *   "Status","Priority","Technician","Scheduled","Address","City","State","Zip",
 *   "Revenue","Created Date","Completed Date"
 *
 * leads.csv (optional):
 *   "Lead ID","Client Phone","Client Name","Source","Service Type","Description",
 *   "Zip","Status","Created Date"
 *
 * Dedup rules:
 *   - Customers: by normalized phone (last 10 digits), fallback email
 *   - Jobs: by jobNumber (J-YYYY-XXXX) — skip if exists
 *   - Leads: always import (no dedup — historical record)
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// ── CSV parser (no external deps) ────────────────────────────────────────────

function parseCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseRow(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim().replace(/^"|"$/g, '')] = (values[i] ?? '').trim().replace(/^"|"$/g, ''); });
    return row;
  });
}

function parseRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inQuotes) { inQuotes = true; continue; }
    if (ch === '"' && inQuotes) {
      if (line[i + 1] === '"') { current += '"'; i++; continue; }
      inQuotes = false; continue;
    }
    if (ch === ',' && !inQuotes) { cells.push(current); current = ''; continue; }
    current += ch;
  }
  cells.push(current);
  return cells;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length < 10) return '';
  return `+1${last10}`;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const has = (flag: string) => args.includes(flag);

  const orgSlug = get('--org');
  const customersFile = get('--customers');
  const jobsFile = get('--jobs');
  const leadsFile = get('--leads');
  const dryRun = has('--dry-run');

  if (!orgSlug) { console.error('ERROR: --org <slug> required'); process.exit(1); }

  const db = new PrismaClient({ log: ['warn', 'error'] });

  try {
    const org = await db.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) { console.error(`ERROR: org '${orgSlug}' not found in DB`); process.exit(1); }

    console.log(`\nImporting into org: ${org.name} (${org.id})`);
    console.log(dryRun ? '-- DRY RUN (no writes) --\n' : '-- LIVE RUN --\n');

    const stats = {
      customers: { created: 0, skipped: 0, errors: 0 },
      jobs: { created: 0, skipped: 0, errors: 0 },
      leads: { created: 0, skipped: 0, errors: 0 },
    };

    // ── Import Customers ─────────────────────────────────────────────────────
    if (customersFile && fs.existsSync(customersFile)) {
      console.log(`\nImporting customers from: ${customersFile}`);
      const rows = parseCsv(customersFile);
      console.log(`  Found ${rows.length} rows`);

      for (const row of rows) {
        try {
          const phone = normalizePhone(row['Phone'] ?? '');
          const email = (row['Email'] ?? '').toLowerCase().trim() || undefined;
          const name = `${row['First Name'] ?? ''} ${row['Last Name'] ?? ''}`.trim() || (row['Company'] ?? 'Unknown');

          if (!phone) {
            console.log(`  SKIP: no phone — "${name}"`);
            stats.customers.skipped++;
            continue;
          }

          // Dedupe
          const existing = await db.customer.findFirst({
            where: {
              orgId: org.id,
              OR: [
                { phone: { contains: phone.slice(-10) } },
                ...(email ? [{ email }] : []),
              ],
            },
          });

          if (existing) {
            stats.customers.skipped++;
            continue;
          }

          const zip = (row['Zip'] ?? '').trim();
          const billingAddress = JSON.stringify({
            line1: row['Address'] ?? '',
            city: row['City'] ?? '',
            state: row['State'] ?? '',
            zip,
            country: 'US',
          });

          if (!dryRun) {
            const customer = await db.customer.create({
              data: {
                orgId: org.id,
                billingName: name,
                companyName: row['Company'] || undefined,
                phone,
                email,
                alternatePhone: normalizePhone(row['Alt Phone'] ?? '') || undefined,
                type: (row['Type'] ?? '').toLowerCase().includes('commercial') ? 'commercial' : 'residential',
                billingAddress,
                tags: JSON.stringify((row['Tags'] ?? '').split(',').map((t: string) => t.trim()).filter(Boolean)),
                createdAt: parseDate(row['Created Date'] ?? '') ?? undefined,
              },
            });

            // Create primary property if address present
            if (row['Address'] && row['City'] && row['State']) {
              await db.property.create({
                data: {
                  orgId: org.id,
                  customerId: customer.id,
                  addressLine1: row['Address'],
                  city: row['City'],
                  state: row['State'],
                  zip,
                  isPrimary: true,
                },
              });
            }
          }

          stats.customers.created++;
          if (stats.customers.created % 50 === 0) console.log(`  ... ${stats.customers.created} customers created`);
        } catch (err: any) {
          console.error(`  ERROR on row: ${JSON.stringify(row)} — ${err.message}`);
          stats.customers.errors++;
        }
      }
    }

    // ── Import Jobs ──────────────────────────────────────────────────────────
    if (jobsFile && fs.existsSync(jobsFile)) {
      console.log(`\nImporting jobs from: ${jobsFile}`);
      const rows = parseCsv(jobsFile);
      console.log(`  Found ${rows.length} rows`);

      for (const row of rows) {
        try {
          const jobNumber = row['Job Number'] ?? `WZ-${row['Job ID']}`;

          // Dedup by job number
          const existing = await db.job.findFirst({ where: { orgId: org.id, jobNumber } });
          if (existing) { stats.jobs.skipped++; continue; }

          // Find customer by phone
          const phone = normalizePhone(row['Client Phone'] ?? '');
          const customer = phone ? await db.customer.findFirst({
            where: { orgId: org.id, phone: { contains: phone.slice(-10) } },
          }) : null;

          if (!customer) {
            console.log(`  SKIP job ${jobNumber}: customer not found for phone ${phone}`);
            stats.jobs.skipped++;
            continue;
          }

          // Find or create property
          let property = await db.property.findFirst({
            where: { orgId: org.id, customerId: customer.id },
          });

          if (!property && !dryRun) {
            property = await db.property.create({
              data: {
                orgId: org.id,
                customerId: customer.id,
                addressLine1: row['Address'] ?? '',
                city: row['City'] ?? '',
                state: row['State'] ?? '',
                zip: row['Zip'] ?? '',
                isPrimary: false,
              },
            });
          }

          if (!property) { stats.jobs.skipped++; continue; }

          // Status mapping from Workiz
          const statusMap: Record<string, string> = {
            'new': 'new', 'pending': 'new', 'scheduled': 'scheduled',
            'dispatched': 'dispatched', 'on the way': 'en_route',
            'in progress': 'in_progress', 'completed': 'completed',
            'invoiced': 'invoiced', 'paid': 'paid', 'closed': 'closed',
            'cancelled': 'canceled', 'canceled': 'canceled',
          };
          const rawStatus = (row['Status'] ?? 'completed').toLowerCase();
          const status = statusMap[rawStatus] ?? 'completed';

          if (!dryRun) {
            await db.job.create({
              data: {
                orgId: org.id,
                jobNumber,
                customerId: customer.id,
                propertyId: property.id,
                jobType: row['Service Type'] ?? 'general',
                category: row['Category'] ?? 'general',
                description: row['Description'] ?? '',
                status: status as any,
                priority: 'normal',
                scheduledStart: parseDate(row['Scheduled'] ?? '') ?? undefined,
                actualRevenue: row['Revenue'] ? parseFloat(row['Revenue'].replace(/[^0-9.]/g, '')) : undefined,
                createdAt: parseDate(row['Created Date'] ?? '') ?? undefined,
                actualEnd: parseDate(row['Completed Date'] ?? '') ?? undefined,
              },
            });
          }

          stats.jobs.created++;
          if (stats.jobs.created % 50 === 0) console.log(`  ... ${stats.jobs.created} jobs created`);
        } catch (err: any) {
          console.error(`  ERROR on job row: ${err.message}`);
          stats.jobs.errors++;
        }
      }
    }

    // ── Import Leads ─────────────────────────────────────────────────────────
    if (leadsFile && fs.existsSync(leadsFile)) {
      console.log(`\nImporting leads from: ${leadsFile}`);
      const rows = parseCsv(leadsFile);
      console.log(`  Found ${rows.length} rows`);

      for (const row of rows) {
        try {
          const phone = normalizePhone(row['Client Phone'] ?? '');
          let customerId: string | undefined;

          if (phone) {
            const customer = await db.customer.findFirst({
              where: { orgId: org.id, phone: { contains: phone.slice(-10) } },
            });
            customerId = customer?.id;
          }

          const statusMap: Record<string, string> = {
            'new': 'new', 'contacted': 'contacted', 'qualified': 'qualified',
            'converted': 'converted', 'dead': 'dead', 'lost': 'dead', 'closed': 'dead',
          };
          const rawStatus = (row['Status'] ?? 'new').toLowerCase();
          const status = statusMap[rawStatus] ?? 'new';

          if (!dryRun) {
            await db.lead.create({
              data: {
                orgId: org.id,
                source: (row['Source'] ?? 'workiz_import').toLowerCase().replace(/\s+/g, '_'),
                sourceMeta: JSON.stringify({ workizLeadId: row['Lead ID'], importedAt: new Date().toISOString() }),
                customerId,
                serviceType: row['Service Type'] ?? 'general',
                description: row['Description'] ?? '',
                zip: row['Zip'] ?? '',
                status: status as any,
                receivedAt: parseDate(row['Created Date'] ?? '') ?? new Date(),
              },
            });
          }

          stats.leads.created++;
        } catch (err: any) {
          console.error(`  ERROR on lead row: ${err.message}`);
          stats.leads.errors++;
        }
      }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n════════════════════════════════');
    console.log('Import complete' + (dryRun ? ' (DRY RUN — no changes written)' : ''));
    console.log(`Customers: ${stats.customers.created} created, ${stats.customers.skipped} skipped, ${stats.customers.errors} errors`);
    console.log(`Jobs:      ${stats.jobs.created} created, ${stats.jobs.skipped} skipped, ${stats.jobs.errors} errors`);
    console.log(`Leads:     ${stats.leads.created} created, ${stats.leads.skipped} skipped, ${stats.leads.errors} errors`);
    console.log('════════════════════════════════\n');

  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
