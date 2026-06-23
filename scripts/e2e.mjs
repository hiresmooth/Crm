#!/usr/bin/env node
/**
 * E2E golden-path test for SmoothOS Estimate API
 * Run: npm run e2e (requires server + db running)
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

let cookie = '';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const json = await res.json().catch(() => ({}));
  if (!res.ok && !json.success) {
    throw new Error(`${method} ${path} failed (${res.status}): ${JSON.stringify(json.errors ?? json)}`);
  }
  return json;
}

async function main() {
  console.log('E2E: login...');
  const login = await req('POST', '/api/auth/login', {
    email: 'estimator@smoothconstruction.com',
    password: 'smooth2025!',
  });
  if (!login.success) throw new Error('Login failed');

  console.log('E2E: create lead...');
  const lead = await req('POST', '/api/v1/leads', {
    client: { first_name: 'E2E', last_name: 'Test', email: 'e2e@test.com', phone: '6175550100' },
    project: { street: '1 Test St', city: 'Boston', state: 'MA', zip: '02118' },
    service_type: 'attic_insulation',
    source: 'website_organic',
    description: 'E2E test lead',
  });
  const leadId = lead.data.lead_id;

  console.log('E2E: get rates...');
  const rates = await req('GET', '/api/v1/rates');
  const product = rates.data.products.find((p) => p.serviceCode === 'attic_insulation');
  if (!product) throw new Error('No attic product');

  console.log('E2E: create estimate...');
  const estimate = await req('POST', '/api/v1/estimates', {
    lead_id: leadId,
    estimate_name: 'E2E Attic Test',
    service_type: 'attic_insulation',
    project: { city: 'Boston', state: 'MA', zip: '02118' },
    line_items: [{
      service_code: 'attic_insulation',
      assembly_name: 'Attic blow-in',
      quantity_type: 'sq_ft',
      quantity_raw: 1200,
      thickness_inches: 13.2,
      r_value_target: 49,
      product_id: product.id,
      sort_order: 1,
    }],
  });
  const estimateId = estimate.data.estimate_id;

  console.log('E2E: submit estimate...');
  await req('POST', `/api/v1/estimates/${estimateId}/submit`);

  console.log('E2E: manager login...');
  cookie = '';
  await req('POST', '/api/auth/login', {
    email: 'manager@smoothconstruction.com',
    password: 'smooth2025!',
  });

  console.log('E2E: approve estimate...');
  await req('POST', `/api/v1/estimates/${estimateId}/approve`, { notes: 'E2E approved' });

  console.log('E2E: create proposal...');
  const proposal = await req('POST', '/api/v1/proposals', {
    estimate_id: estimateId,
    generate_scope_ai: false,
  });
  const proposalId = proposal.data.proposal_id;

  console.log('E2E: generate PDF...');
  await req('POST', `/api/v1/proposals/${proposalId}/generate-pdf`);

  console.log('E2E: internal approve...');
  await req('POST', `/api/v1/proposals/${proposalId}/internal-approve`);

  console.log('E2E: send proposal...');
  const sent = await req('POST', `/api/v1/proposals/${proposalId}/send`, {
    to_email: 'e2e@test.com',
  });

  console.log('E2E: client approve...');
  const token = sent.data.view_token;
  cookie = '';
  await req('POST', `/api/v1/public/proposals/${token}/approve`, {
    client_name: 'E2E Test',
    signer_name: 'E2E Test',
    accepted_terms: true,
    signature_data: { type: 'typed', value: 'E2E Test' },
  });

  console.log('E2E: verify job created...');
  cookie = '';
  await req('POST', '/api/auth/login', {
    email: 'manager@smoothconstruction.com',
    password: 'smooth2025!',
  });
  const jobs = await req('GET', '/api/v1/jobs');
  const job = jobs.data.find((j) => j.leadId === leadId);
  if (!job) throw new Error('Job not created after client approval');

  console.log('✅ E2E golden path PASSED');
  console.log({ leadId, estimateId, proposalId, jobId: job.id });
}

main().catch((e) => {
  console.error('❌ E2E FAILED:', e.message);
  process.exit(1);
});
