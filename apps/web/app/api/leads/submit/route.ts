/**
 * Public web form endpoint — no auth required.
 * Receives lead submissions from the embeddable widget and external forms.
 *
 * POST /api/leads/submit
 *
 * Query params:
 *   ?org=<org-slug>   — identifies which tenant receives the lead
 *
 * Rate-limited by IP via Upstash (when UPSTASH_REDIS_URL is set).
 * CORS: allowed from any origin (embed use case).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@handyman-crm/db';

const submitSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(10).max(20),
  email: z.string().email().optional(),
  serviceType: z.string().min(2).max(100),
  description: z.string().min(5).max(2000),
  zip: z.string().min(5).max(10),
  source: z.string().default('web_form'),
});

// CORS headers for embeddable use
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    // Identify org by slug from query param
    const { searchParams } = new URL(req.url);
    const orgSlug = searchParams.get('org');
    if (!orgSlug) {
      return NextResponse.json(
        { error: 'Missing org parameter' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const org = await db.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Parse + validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422, headers: CORS_HEADERS },
      );
    }

    const { name, phone, email, serviceType, description, zip, source } = parsed.data;

    // Phone normalization + dedupe
    const normalizedPhone = phone.replace(/\D/g, '');
    const last10 = normalizedPhone.slice(-10);
    const e164 = normalizedPhone.startsWith('1') ? `+${normalizedPhone}` : `+1${normalizedPhone}`;

    let customerId: string | undefined;
    const existingCustomer = await db.customer.findFirst({
      where: {
        orgId: org.id,
        OR: [
          { phone: { contains: last10 } },
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Create minimal customer record (dispatcher will complete it)
      const newCustomer = await db.customer.create({
        data: {
          orgId: org.id,
          billingName: name,
          phone: e164,
          email,
          billingAddress: JSON.stringify({ line1: '', city: '', state: '', zip, country: 'US' }),
          tags: JSON.stringify([]),
          source,
        },
      });
      customerId = newCustomer.id;
    }

    // Create lead
    const lead = await db.lead.create({
      data: {
        orgId: org.id,
        source,
        sourceMeta: JSON.stringify({
          submittedAt: new Date().toISOString(),
          ip: req.headers.get('x-forwarded-for') ?? 'unknown',
          userAgent: req.headers.get('user-agent') ?? '',
          referer: req.headers.get('referer') ?? '',
        }),
        customerId,
        serviceType,
        description,
        zip,
        status: 'new',
        score: 50, // default score for web form leads
      },
    });

    return NextResponse.json(
      {
        success: true,
        leadId: lead.id,
        message: 'Your request has been received. We will contact you shortly.',
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error('[leads/submit] unexpected error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
