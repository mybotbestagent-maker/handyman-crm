/**
 * Embeddable widget script endpoint.
 *
 * GET /api/widget?org=<slug>&color=<hex>&label=<text>
 *
 * Returns a self-contained JavaScript snippet that injects a lead form
 * into the host page. The form POSTs to /api/leads/submit.
 *
 * Usage on any website:
 *   <script src="https://crm.handymangoldhands.com/api/widget?org=handyman-gold-hands"></script>
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const org = searchParams.get('org') ?? '';
  const color = (searchParams.get('color') ?? '#2563eb').replace(/[^#a-fA-F0-9]/g, '');
  const label = (searchParams.get('label') ?? 'Get a Free Quote').slice(0, 60);
  const apiBase = origin;

  // Inline JS — no external deps, works in any browser context
  const script = /* js */ `
(function() {
  var ORG = ${JSON.stringify(org)};
  var API_BASE = ${JSON.stringify(apiBase)};
  var BTN_COLOR = ${JSON.stringify(color)};
  var BTN_LABEL = ${JSON.stringify(label)};

  if (!ORG) { console.warn('[HGH Widget] Missing org param'); return; }

  // ── Styles ──────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#hgh-widget-btn{position:fixed;bottom:24px;right:24px;z-index:99999;background:'+BTN_COLOR+';color:#fff;border:none;border-radius:50px;padding:14px 24px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.25);transition:transform .15s,box-shadow .15s;font-family:system-ui,sans-serif}',
    '#hgh-widget-btn:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,0,0,.3)}',
    '#hgh-widget-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:999998;align-items:center;justify-content:center}',
    '#hgh-widget-overlay.open{display:flex}',
    '#hgh-widget-modal{background:#fff;border-radius:16px;padding:32px;width:100%;max-width:440px;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:system-ui,sans-serif;position:relative}',
    '#hgh-widget-modal h2{margin:0 0 6px;font-size:20px;font-weight:700;color:#111}',
    '#hgh-widget-modal p{margin:0 0 20px;font-size:14px;color:#666}',
    '.hgh-field{margin-bottom:14px}',
    '.hgh-field label{display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:5px}',
    '.hgh-field input,.hgh-field textarea,.hgh-field select{width:100%;padding:10px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;transition:border-color .15s;box-sizing:border-box;font-family:inherit}',
    '.hgh-field input:focus,.hgh-field textarea:focus,.hgh-field select:focus{border-color:'+BTN_COLOR+'}',
    '.hgh-field textarea{resize:vertical;min-height:80px}',
    '#hgh-submit{width:100%;background:'+BTN_COLOR+';color:#fff;border:none;border-radius:8px;padding:13px;font-size:15px;font-weight:600;cursor:pointer;margin-top:4px;transition:opacity .15s}',
    '#hgh-submit:disabled{opacity:.6;cursor:not-allowed}',
    '#hgh-close{position:absolute;top:16px;right:16px;background:none;border:none;font-size:20px;cursor:pointer;color:#9ca3af;line-height:1}',
    '#hgh-success{text-align:center;padding:16px 0}',
    '#hgh-success p{font-size:16px;color:#166534;font-weight:600;margin:12px 0 4px}',
    '#hgh-success small{color:#6b7280;font-size:13px}',
    '#hgh-err{color:#dc2626;font-size:13px;margin-top:8px;display:none}',
  ].join('');
  document.head.appendChild(style);

  // ── Markup ───────────────────────────────────────────────────────────────
  var overlay = document.createElement('div');
  overlay.id = 'hgh-widget-overlay';
  overlay.innerHTML = '<div id="hgh-widget-modal">'
    + '<button id="hgh-close" aria-label="Close">&times;</button>'
    + '<h2>Request a Service</h2>'
    + '<p>Fill out the form and we\'ll get back to you within 1 hour.</p>'
    + '<div id="hgh-form-body">'
    + '<div class="hgh-field"><label>Full Name *</label><input id="hgh-name" type="text" placeholder="John Smith" required></div>'
    + '<div class="hgh-field"><label>Phone *</label><input id="hgh-phone" type="tel" placeholder="(305) 555-0100" required></div>'
    + '<div class="hgh-field"><label>Email</label><input id="hgh-email" type="email" placeholder="john@example.com"></div>'
    + '<div class="hgh-field"><label>Service Needed *</label>'
    + '<select id="hgh-service"><option value="">Select...</option>'
    + '<option>Drywall Repair</option><option>TV Mounting</option><option>Painting</option>'
    + '<option>Furniture Assembly</option><option>Plumbing (minor)</option>'
    + '<option>Electrical (minor)</option><option>Door / Lock</option>'
    + '<option>Window / Screen</option><option>Deck / Fence</option><option>Other</option>'
    + '</select></div>'
    + '<div class="hgh-field"><label>ZIP Code *</label><input id="hgh-zip" type="text" placeholder="33101" maxlength="10" required></div>'
    + '<div class="hgh-field"><label>Describe the problem *</label><textarea id="hgh-desc" placeholder="Please describe what needs to be done..." required></textarea></div>'
    + '<div id="hgh-err">Something went wrong. Please try again.</div>'
    + '<button id="hgh-submit">Send Request</button>'
    + '</div>'
    + '<div id="hgh-success" style="display:none">'
    + '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>'
    + '<p>Request Received!</p><small>We\'ll call you within 1 hour during business hours.</small>'
    + '</div>'
    + '</div>';
  document.body.appendChild(overlay);

  var btn = document.createElement('button');
  btn.id = 'hgh-widget-btn';
  btn.textContent = BTN_LABEL;
  document.body.appendChild(btn);

  // ── Logic ────────────────────────────────────────────────────────────────
  function open() { overlay.classList.add('open'); }
  function close() { overlay.classList.remove('open'); }

  btn.addEventListener('click', open);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  overlay.querySelector('#hgh-close').addEventListener('click', close);

  overlay.querySelector('#hgh-submit').addEventListener('click', function() {
    var name    = overlay.querySelector('#hgh-name').value.trim();
    var phone   = overlay.querySelector('#hgh-phone').value.trim();
    var email   = overlay.querySelector('#hgh-email').value.trim();
    var service = overlay.querySelector('#hgh-service').value;
    var zip     = overlay.querySelector('#hgh-zip').value.trim();
    var desc    = overlay.querySelector('#hgh-desc').value.trim();
    var errEl   = overlay.querySelector('#hgh-err');
    var submitBtn = overlay.querySelector('#hgh-submit');

    if (!name || !phone || !service || !zip || desc.length < 5) {
      errEl.textContent = 'Please fill in all required fields.';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    fetch(API_BASE + '/api/leads/submit?org=' + encodeURIComponent(ORG), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, phone: phone, email: email || undefined,
        serviceType: service, description: desc, zip: zip, source: 'web_widget' }),
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        overlay.querySelector('#hgh-form-body').style.display = 'none';
        overlay.querySelector('#hgh-success').style.display = 'block';
        setTimeout(close, 4000);
      } else {
        errEl.textContent = data.error || 'Submission failed. Please call us directly.';
        errEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Request';
      }
    })
    .catch(function() {
      errEl.textContent = 'Network error. Please try again or call us directly.';
      errEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Request';
    });
  });
})();
`;

  return new NextResponse(script, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
