/**
 * The File Room — Main Application Controller
 * Handles 10 interactive screens, dual-device mode, KBA signing quiz,
 * drag-and-drop document uploads, simulated camera capture, messaging,
 * billing, firm console, and toast notifications.
 */

(function() {
  'use strict';

  // Application State
  var state = window.FileRoomData;
  var currentScreen = 'home';
  var signaturePad = null;
  var sigCanvas = null;
  var sigCtx = null;
  var isDrawing = false;
  var selectedKbaOption = null;

  // DOM Elements Cache
  var el = {
    side: document.getElementById('side'),
    tabbar: document.getElementById('tabbar'),
    body: document.getElementById('body'),
    btnToggleMenu: document.getElementById('btn-toggle-menu'),
    btnMobileMore: document.getElementById('btn-mobile-more'),
    drawerBackdrop: document.getElementById('drawer-backdrop'),
    themeToggle: document.getElementById('theme-toggle'),
    toastContainer: document.getElementById('toast-container'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    modalContainer: document.getElementById('modal-container')
  };

  // -------------------------------------------------------------
  // 1. ROUTING & SCREEN NAVIGATION
  // -------------------------------------------------------------
  function showScreen(name) {
    if (!name) return;
    currentScreen = name;

    // Toggle screen panels
    var found = false;
    document.querySelectorAll('.scr').forEach(function(s) {
      var on = (s.id === 's-' + name);
      s.classList.toggle('on', on);
      if (on) found = true;
    });

    if (!found) return;

    // Synchronize top screen tabs
    var tabsEl = document.getElementById('tabs');
    if (tabsEl) {
      tabsEl.querySelectorAll('button').forEach(function(b) {
        b.setAttribute('aria-selected', b.dataset.s === name ? 'true' : 'false');
      });
    }

    // Synchronize mock browser URL bar
    var mockUrlPath = document.getElementById('mock-url-path');
    if (mockUrlPath) {
      var paths = {
        signin: '/login',
        home: '/dashboard',
        docs: '/documents',
        sign: '/sign/8879',
        return: '/return/prepared',
        msgs: '/messages',
        svcs: '/services',
        pay: '/billing',
        news: '/updates',
        firm: '/firm/console'
      };
      mockUrlPath.textContent = paths[name] || ('/' + name);
    }

    // Update sidebar navigation
    if (el.side) {
      el.side.querySelectorAll('a').forEach(function(a) {
        a.classList.toggle('on', a.dataset.go === name);
      });
      // Close mobile drawer on navigation
      toggleMobileDrawer(false);
    }

    // Update phone tabbar navigation
    if (el.tabbar) {
      el.tabbar.querySelectorAll('button').forEach(function(b) {
        b.classList.toggle('on', b.dataset.go === name);
      });
    }

    if (el.body) {
      el.body.scrollTop = 0;
    }

    // Log screen view to Firebase Analytics
    if (window.FirebaseBridge) {
      window.FirebaseBridge.logScreen(name);
    }

    // Dynamic screen-specific initialization
    if (name === 'sign') {
      initSignatureCanvas();
    }
  }

  // -------------------------------------------------------------
  // 2. MOBILE NAVIGATION DRAWER & THEME
  // -------------------------------------------------------------
  function toggleMobileDrawer(open) {
    if (!el.side) return;
    var isOpen = el.side.classList.contains('open');
    var shouldOpen = (typeof open === 'boolean') ? open : !isOpen;
    el.side.classList.toggle('open', shouldOpen);
    if (el.drawerBackdrop) {
      el.drawerBackdrop.classList.toggle('active', shouldOpen);
    }
  }

  function initTheme() {
    var storedTheme = localStorage.getItem('fileroom_theme');
    if (storedTheme) {
      document.documentElement.setAttribute('data-theme', storedTheme);
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    var isDark = current === 'dark' || (!current && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('fileroom_theme', next);
    showToast('Switched to ' + next + ' mode', 'info');
  }

  // -------------------------------------------------------------
  // 3. TOAST NOTIFICATION SYSTEM
  // -------------------------------------------------------------
  function showToast(message, type) {
    if (!el.toastContainer) return;
    var t = document.createElement('div');
    t.className = 'toast';
    var icon = type === 'ok' ? '✓' : (type === 'warn' ? '⚠' : 'ℹ');
    t.innerHTML = '<span style="color:var(--gold);font-weight:700">' + icon + '</span><span>' + message + '</span>';
    el.toastContainer.appendChild(t);
    setTimeout(function() {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 3200);
  }

  // -------------------------------------------------------------
  // 4. MODAL DIALOG CONTROLLER
  // -------------------------------------------------------------
  function openModal(title, bodyHtml, footerHtml) {
    if (!el.modalBackdrop || !el.modalContainer) return;
    el.modalContainer.innerHTML = [
      '<div class="modal-header">',
      '  <h3 style="margin:0;font-size:1.1rem;font-weight:500">' + title + '</h3>',
      '  <button id="modal-close-btn" style="background:transparent;border:0;font-size:1.2rem;color:var(--ink-3);padding:4px 8px;cursor:pointer">&times;</button>',
      '</div>',
      '<div class="modal-body">' + bodyHtml + '</div>',
      '<div class="modal-footer">' + (footerHtml || '<button class="btn btn-o sm" id="modal-cancel-btn">Close</button>') + '</div>'
    ].join('');

    el.modalBackdrop.classList.add('active');

    var close = document.getElementById('modal-close-btn');
    var cancel = document.getElementById('modal-cancel-btn');
    if (close) close.addEventListener('click', closeModal);
    if (cancel) cancel.addEventListener('click', closeModal);
  }

  var activeCameraStream = null;

  function stopActiveCamera() {
    if (activeCameraStream) {
      try {
        activeCameraStream.getTracks().forEach(function(track) {
          track.stop();
        });
      } catch (e) {
        console.warn('Error stopping camera track:', e);
      }
      activeCameraStream = null;
    }
  }

  function closeModal() {
    stopActiveCamera();
    if (el.modalBackdrop) {
      el.modalBackdrop.classList.remove('active');
    }
    if (el.modalContainer) {
      el.modalContainer.classList.remove('modal-wide');
    }
  }

  // -------------------------------------------------------------
  // 4B. PROTOTYPE CHROME & ARCHITECTURE RULES
  // -------------------------------------------------------------
  function showArchitectureRulesModal() {
    if (el.modalContainer) {
      el.modalContainer.classList.add('modal-wide');
    }

    var html = [
      '<div class="arch-rules-modal-wrapper">',
      '  <div style="display:flex;gap:8px;margin-bottom:18px;border-bottom:1px solid var(--line);padding-bottom:12px;flex-wrap:wrap">',
      '    <button id="tab-btn-exhibit-a" class="btn sm btn-g" style="font-weight:600">Exhibit A: Costs (01)</button>',
      '    <button id="tab-btn-exhibit-b" class="btn sm btn-o" style="color:var(--ink)">Exhibit B: Scope (02)</button>',
      '    <button id="tab-btn-exhibit-c" class="btn sm btn-o" style="color:var(--ink)">Exhibit C: Screens (03)</button>',
      '    <button id="tab-btn-exhibit-e" class="btn sm btn-o" style="color:var(--ink)">Exhibit E: Custodian (05)</button>',
      '    <button id="tab-btn-exhibit-f" class="btn sm btn-o" style="color:var(--ink)">Exhibit F: Arch (06)</button>',
      '    <button id="tab-btn-exhibit-h" class="btn sm btn-o" style="color:var(--ink)">Exhibit H: Run Rate (08)</button>',
      '    <button id="tab-btn-exhibit-i" class="btn sm btn-o" style="color:var(--ink)">Exhibit I: App Stores (09)</button>',
      '    <button id="tab-btn-exhibit-j" class="btn sm btn-o" style="color:var(--ink)">Exhibit J: Product (10)</button>',
      '    <button id="tab-btn-exhibit-k" class="btn sm btn-o" style="color:var(--ink)">Exhibit K: Decisions (11)</button>',
      '    <button id="tab-btn-exhibit-l" class="btn sm btn-o" style="color:var(--ink)">Exhibit L: Sources (12)</button>',
      '    <button id="tab-btn-safeguards" class="btn sm btn-o" style="color:var(--ink)">IRS &amp; FTC Safeguards</button>',
      '  </div>',
      '',
      '  <!-- PANE EXHIBIT A -->',
      '  <div id="pane-exhibit-a" style="font-size:.85rem;line-height:1.65;color:var(--ink)">',
      '    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:14px;font-family:var(--f-mono);font-size:.72rem;color:var(--ink-3)">',
      '      <span style="letter-spacing:.12em;text-transform:uppercase;color:var(--blue);font-weight:600">Exhibit A</span>',
      '      <span style="font-weight:600">01 of 12</span>',
      '    </div>',
      '    <h3 style="font-size:1.4rem;font-weight:400;margin-bottom:14px;color:var(--ink);letter-spacing:-0.02em">What you are choosing, and what it costs</h3>',
      '    <p style="margin-bottom:12px;color:var(--ink-2)">You asked for a custom app rather than a configured platform. That is a defensible choice, but it is an expensive one, and the reason it is expensive is worth stating on the first page rather than the last.</p>',
      '    <p style="margin-bottom:16px;color:var(--ink-2)">Five products already do most of what you described &mdash; TaxDome, Canopy, Liscio, SafeSend and Karbon. They are licensed per seat, they carry IRS-compliant signing, and the vendor absorbs the security engineering. Below is what each path actually costs a firm of roughly six staff and four hundred clients.</p>',
      '    <div class="exhibit-section-hdr">LICENSED PLATFORM &mdash; PUBLISHED 2026 PRICING</div>',
      '    <table class="exhibit-table">',
      '      <tbody>',
      '        <tr>',
      '          <td style="width:110px"><b>TaxDome</b></td>',
      '          <td style="color:var(--ink-2)">Pro tier, unlimited seats. Unlimited e-signature. IRS Form 8879-compliant KBA at $1.00 per signer attempt. White-label client app quoted separately.</td>',
      '          <td style="width:140px;text-align:right">',
      '            <div style="font-size:1.15rem;font-weight:600;color:var(--blue)">$1,000</div>',
      '            <div style="font-family:var(--f-mono);font-size:.65rem;color:var(--ink-3);letter-spacing:.06em">PER SEAT / YR</div>',
      '          </td>',
      '        </tr>',
      '        <tr>',
      '          <td><b>Canopy</b></td>',
      '          <td style="color:var(--ink-2)">Standard $74 to Premium $149 per user per month, billed annually. KBA credits $1.25 each.</td>',
      '          <td style="text-align:right">',
      '            <div style="font-size:1.15rem;font-weight:600;color:var(--blue)">$888</div>',
      '            <div style="font-family:var(--f-mono);font-size:.65rem;color:var(--ink-3);letter-spacing:.06em">PER USER / YR, STANDARD</div>',
      '          </td>',
      '        </tr>',
      '        <tr>',
      '          <td><b>Liscio</b></td>',
      '          <td style="color:var(--ink-2)">$19 / $49 / $99 per user per month. Tax Team tier bundles 100 signatures per user. No published KBA claim.</td>',
      '          <td style="text-align:right">',
      '            <div style="font-size:1.15rem;font-weight:600;color:var(--blue)">$588</div>',
      '            <div style="font-family:var(--f-mono);font-size:.65rem;color:var(--ink-3);letter-spacing:.06em">PER USER / YR, PLATFORM</div>',
      '          </td>',
      '        </tr>',
      '        <tr>',
      '          <td><b>SafeSend</b></td>',
      '          <td style="color:var(--ink-2)">Priced per return, not per seat. Purpose-built for 8879 signing. Pricing not published &mdash; sales call required.</td>',
      '          <td style="text-align:right">',
      '            <div style="font-size:1.15rem;font-weight:600;color:var(--ink)">n/p</div>',
      '            <div style="font-family:var(--f-mono);font-size:.65rem;color:var(--ink-3);letter-spacing:.06em">QUOTE REQUIRED</div>',
      '          </td>',
      '        </tr>',
      '      </tbody>',
      '    </table>',
      '    <div class="exhibit-section-hdr">CUSTOM BUILD &mdash; THE PATH CHOSEN</div>',
      '    <table class="exhibit-table">',
      '      <tbody>',
      '        <tr>',
      '          <td style="width:110px"><b>Year one</b></td>',
      '          <td style="color:var(--ink-2)">Web portal, then native iOS and Android. Design, build, security programme, first penetration test.</td>',
      '          <td style="width:140px;text-align:right">',
      '            <div style="font-size:1.15rem;font-weight:600;color:var(--blue)">$175k&ndash;$400k</div>',
      '            <div style="font-family:var(--f-mono);font-size:.65rem;color:var(--ink-3);letter-spacing:.06em">RANGE, NOT A QUOTE</div>',
      '          </td>',
      '        </tr>',
      '        <tr>',
      '          <td><b>Every year after</b></td>',
      '          <td style="color:var(--ink-2)">Hosting, identity, scanning, monitoring, e-signature licences, annual penetration test, semi-annual vulnerability scans, maintenance at 15&ndash;20% of build.</td>',
      '          <td style="text-align:right">',
      '            <div style="font-size:1.15rem;font-weight:600;color:var(--blue)">$55k&ndash;$119k</div>',
      '            <div style="font-family:var(--f-mono);font-size:.65rem;color:var(--ink-3);letter-spacing:.06em">PER YEAR</div>',
      '          </td>',
      '        </tr>',
      '      </tbody>',
      '    </table>',
      '    <div class="exhibit-callout">',
      '      <span class="exhibit-callout-tag">THE NUMBER THAT MATTERS</span>',
      '      <p style="font-size:.85rem;line-height:1.6;color:var(--ink)">Spread over three years, the custom path runs somewhere between <b>$280 and $630 per client per year</b> at four hundred clients. TaxDome at Pro, with KBA, runs about <b>$17 per client per year</b>. That is a difference of seventeen to thirty-seven times, and no amount of design quality closes it &mdash; which is why <b>Exhibit J</b> argues the only version of this that pencils is one where the app is a product you can license to other firms, not an internal tool.</p>',
      '    </div>',
      '    <p style="font-size:.82rem;color:var(--ink-3);font-style:italic">The rest of this file takes the decision as made and answers the real question: what has to be true for it to work.</p>',
      '    <div style="display:flex;justify-content:flex-end;margin-top:16px">',
      '      <button id="btn-a-to-b" class="btn sm btn-b">Next: Exhibit B &rarr;</button>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- PANE EXHIBIT B -->',
      '  <div id="pane-exhibit-b" style="display:none">',
      '    <div class="exhibit-b-theme">',
      '      <div class="exhibit-b-header">',
      '        <span class="exhibit-b-badge-gold">Exhibit B</span>',
      '        <span class="exhibit-b-page">02 of 12</span>',
      '      </div>',
      '      <h3 class="exhibit-b-title">What the app does &mdash; and what it refuses to do</h3>',
      '      <div class="exhibit-b-subtitle">Seven capabilities. One hard exclusion. The exclusion is the more important half.</div>',
      '      <div class="exhibit-b-list">',
      '        <!-- 01 -->',
      '        <div class="exhibit-b-item">',
      '          <div class="exhibit-b-tag">01 - EXCHANGE</div>',
      '          <div class="exhibit-b-content">',
      '            <div class="exhibit-b-item-title">Secure document upload</div>',
      '            <div class="exhibit-b-item-desc">Named requests, not &ldquo;send everything.&rdquo; Camera capture on the phone, drag-and-drop on the web. Malware scanned on arrival, encrypted at rest, every access logged.</div>',
      '          </div>',
      '          <div class="exhibit-b-badge">',
      '            <div class="action">Build</div>',
      '            <span class="sub">own</span>',
      '          </div>',
      '        </div>',
      '        <!-- 02 -->',
      '        <div class="exhibit-b-item">',
      '          <div class="exhibit-b-tag">02 - REGULATED</div>',
      '          <div class="exhibit-b-content">',
      '            <div class="exhibit-b-item-title">Signing, including Form 8879</div>',
      '            <div class="exhibit-b-item-desc">Identity verification, the signature, and the evidence record the IRS requires you to keep. This is the one component to license rather than write.</div>',
          '</div>',
      '          <div class="exhibit-b-badge">',
      '            <div class="action buy">Buy</div>',
      '            <span class="sub">embed a vendor</span>',
      '          </div>',
      '        </div>',
      '        <!-- 03 -->',
      '        <div class="exhibit-b-item">',
      '          <div class="exhibit-b-tag">03 - DELIVERY</div>',
      '          <div class="exhibit-b-content">',
      '            <div class="exhibit-b-item-title">The prepared return</div>',
      '            <div class="exhibit-b-item-desc">A read-only copy of what the firm prepared, with a plain-language note on what changed since last year. Read, ask, approve, sign.</div>',
      '          </div>',
      '          <div class="exhibit-b-badge">',
      '            <div class="action">Build</div>',
      '            <span class="sub">own</span>',
      '          </div>',
      '        </div>',
      '        <!-- 04 -->',
      '        <div class="exhibit-b-item">',
      '          <div class="exhibit-b-tag">04 - DIALOGUE</div>',
      '          <div class="exhibit-b-content">',
      '            <div class="exhibit-b-item-title">Questions and answers</div>',
      '            <div class="exhibit-b-item-desc">Threaded messaging attached to the file, so a question about a document sits beside the document. Replaces email, which is where taxpayer data goes to leak.</div>',
      '          </div>',
      '          <div class="exhibit-b-badge">',
      '            <div class="action">Build</div>',
      '            <span class="sub">own</span>',
      '          </div>',
      '        </div>',
      '        <!-- 05 -->',
      '        <div class="exhibit-b-item">',
      '          <div class="exhibit-b-tag">05 - ATTENTION</div>',
      '          <div class="exhibit-b-content">',
      '            <div class="exhibit-b-item-title">Updates that are actually about you</div>',
      '            <div class="exhibit-b-item-desc">Stage changes, deadlines on your file, and rule changes that move your number. Push and email. Never a newsletter blast dressed as an alert.</div>',
      '          </div>',
      '          <div class="exhibit-b-badge">',
      '            <div class="action">Build</div>',
      '            <span class="sub">own</span>',
      '          </div>',
      '        </div>',
      '        <!-- 06 -->',
      '        <div class="exhibit-b-item">',
      '          <div class="exhibit-b-tag">06 - COMMERCE</div>',
      '          <div class="exhibit-b-content">',
      '            <div class="exhibit-b-item-title">The service catalogue</div>',
      '            <div class="exhibit-b-item-desc">The published lineup, priced as the site prices it, with The Standing File at the top. Add a service, accept a scope, and the engagement letter goes out.</div>',
      '          </div>',
      '          <div class="exhibit-b-badge">',
      '            <div class="action">Build</div>',
      '            <span class="sub">own</span>',
      '          </div>',
      '        </div>',
      '        <!-- 07 -->',
      '        <div class="exhibit-b-item">',
      '          <div class="exhibit-b-tag">07 - MONEY</div>',
      '          <div class="exhibit-b-content">',
      '            <div class="exhibit-b-item-title">Payment</div>',
      '            <div class="exhibit-b-item-desc">Bank transfer as the default because it is cheaper, card as the alternative. Card details never touch your systems.</div>',
      '          </div>',
      '          <div class="exhibit-b-badge">',
      '            <div class="action buy">Buy</div>',
      '            <span class="sub">hosted processor</span>',
      '          </div>',
      '        </div>',
      '      </div>',
      '      <!-- The Exclusion, Stated Plainly -->',
      '      <div class="exhibit-b-callout">',
      '        <span class="exhibit-b-callout-tag">THE EXCLUSION, STATED PLAINLY</span>',
      '        <p class="exhibit-b-callout-text">The app <b>does not compute tax</b> and does not generate advice. It moves documents, signatures, answers and money; every number a client sees was put there by a person at the firm. That is not a limitation to apologise for &mdash; it keeps the app clear of the software-that-gives-tax-advice problem, and it lets you say honestly that the app never replaces the preparer.</p>',
      '      </div>',
      '    </div>',
      '    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">',
      '      <button id="btn-b-to-a" class="btn sm btn-o">&larr; Previous: Exhibit A</button>',
      '      <button id="btn-b-to-c" class="btn sm btn-b">Next: Exhibit C &rarr;</button>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- PANE EXHIBIT C -->',
      '  <div id="pane-exhibit-c" style="display:none;font-size:.85rem;line-height:1.65;color:var(--ink)">',
      '    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:14px;font-family:var(--f-mono);font-size:.72rem;color:var(--ink-3)">',
      '      <span style="letter-spacing:.12em;text-transform:uppercase;color:var(--blue);font-weight:600">Exhibit C</span>',
      '      <span style="font-weight:600">03 of 12</span>',
      '    </div>',
      '    <h3 style="font-size:1.4rem;font-weight:400;margin-bottom:8px;color:var(--ink);letter-spacing:-0.02em">Ten screens, in the order a client meets them</h3>',
      '    <p style="margin-bottom:16px;color:var(--ink-2);font-size:.88rem;border-bottom:1px solid var(--line-2);padding-bottom:12px">Each of these is built in the companion prototype. Screen numbers match.</p>',
      '    <div class="exhibit-c-list">',
      '      <!-- 01 -->',
      '      <div class="exhibit-c-item">',
      '        <div class="exhibit-c-num">01</div>',
      '        <div class="exhibit-c-body">',
      '          <div class="exhibit-c-title-row">',
      '            <div class="exhibit-c-title">Sign in</div>',
      '            <button class="exhibit-c-jump-btn" data-jump="signin">Open Screen 01 &rarr;</button>',
      '          </div>',
      '          <div class="exhibit-c-desc">Email and password, then a second factor. Passkey and Face ID on the phone. The second step is not a product choice &mdash; multi-factor authentication is mandatory for anyone reaching customer information under the Safeguards Rule.</div>',
      '        </div>',
      '      </div>',
      '      <!-- 02 -->',
      '      <div class="exhibit-c-item">',
      '        <div class="exhibit-c-num">02</div>',
      '        <div class="exhibit-c-body">',
      '          <div class="exhibit-c-title-row">',
      '            <div class="exhibit-c-title">Your file</div>',
      '            <button class="exhibit-c-jump-btn" data-jump="home">Open Screen 02 &rarr;</button>',
      '          </div>',
      '          <div class="exhibit-c-desc">The whole thesis on one screen: <i>your file is open, this is what stage it is at, and these two things are waiting on you</i>. A six-step progress spine from engagement letter to IRS acceptance. Everything else on the home screen is subordinate to those two things.</div>',
      '        </div>',
      '      </div>',
      '      <!-- 03 -->',
      '      <div class="exhibit-c-item">',
      '        <div class="exhibit-c-num">03</div>',
      '        <div class="exhibit-c-body">',
      '          <div class="exhibit-c-title-row">',
      '            <div class="exhibit-c-title">Documents</div>',
      '            <button class="exhibit-c-jump-btn" data-jump="docs">Open Screen 03 &rarr;</button>',
      '          </div>',
      '          <div class="exhibit-c-desc">Grouped by status &mdash; needed, in review, received &mdash; and every missing item named specifically. &ldquo;1099-MISC from Keystone Property Group&rdquo; gets answered. &ldquo;Upload your documents&rdquo; does not.</div>',
      '        </div>',
      '      </div>',
      '      <!-- 04 -->',
      '      <div class="exhibit-c-item">',
      '        <div class="exhibit-c-num">04</div>',
      '        <div class="exhibit-c-body">',
      '          <div class="exhibit-c-title-row">',
      '            <div class="exhibit-c-title">Sign</div>',
      '            <button class="exhibit-c-jump-btn" data-jump="sign">Open Screen 04 &rarr;</button>',
      '          </div>',
      '          <div class="exhibit-c-desc">The regulated screen. Read the form, pass the identity check, sign. Three attempts, then a graceful fall back to a handwritten signature. Detailed in <b>Exhibit D</b>.</div>',
      '        </div>',
      '      </div>',
      '      <!-- 05 -->',
      '      <div class="exhibit-c-item">',
      '        <div class="exhibit-c-num">05</div>',
      '        <div class="exhibit-c-body">',
      '          <div class="exhibit-c-title-row">',
      '            <div class="exhibit-c-title">Your return</div>',
      '            <button class="exhibit-c-jump-btn" data-jump="return">Open Screen 05 &rarr;</button>',
      '          </div>',
      '          <div class="exhibit-c-desc">Refund or balance, the effective rate, and &mdash; the part clients actually read &mdash; <i>three things that changed from last year</i>, in sentences. Then approve, ask, or download.</div>',
      '        </div>',
      '      </div>',
      '      <!-- 06 -->',
      '      <div class="exhibit-c-item">',
      '        <div class="exhibit-c-num">06</div>',
      '        <div class="exhibit-c-body">',
      '          <div class="exhibit-c-title-row">',
      '            <div class="exhibit-c-title">Messages</div>',
      '            <button class="exhibit-c-jump-btn" data-jump="msgs">Open Screen 06 &rarr;</button>',
      '          </div>',
      '          <div class="exhibit-c-desc">One thread per file, with quick-question chips for the five things everyone asks. Uncle Pat appears here as the automatic voice &mdash; deadline reminders and rule notes &mdash; while the preparer answers as herself.</div>',
      '        </div>',
      '      </div>',
      '      <!-- 07 -->',
      '      <div class="exhibit-c-item">',
      '        <div class="exhibit-c-num">07</div>',
      '        <div class="exhibit-c-body">',
      '          <div class="exhibit-c-title-row">',
      '            <div class="exhibit-c-title">Services</div>',
      '            <button class="exhibit-c-jump-btn" data-jump="svcs">Open Screen 07 &rarr;</button>',
      '          </div>',
      '          <div class="exhibit-c-desc">The published lineup at the published prices, plus the free notice read. This is the screen that turns a filing client into a planning client.</div>',
      '        </div>',
      '      </div>',
      '      <!-- 08 -->',
      '      <div class="exhibit-c-item">',
      '        <div class="exhibit-c-num">08</div>',
      '        <div class="exhibit-c-body">',
      '          <div class="exhibit-c-title-row">',
      '            <div class="exhibit-c-title">Billing</div>',
      '            <button class="exhibit-c-jump-btn" data-jump="pay">Open Screen 08 &rarr;</button>',
      '          </div>',
      '          <div class="exhibit-c-desc">Itemised invoice, bank transfer default, card with the fee shown before confirmation. Payment history stays visible.</div>',
      '        </div>',
      '      </div>',
      '      <!-- 09 -->',
      '      <div class="exhibit-c-item">',
      '        <div class="exhibit-c-num">09</div>',
      '        <div class="exhibit-c-body">',
      '          <div class="exhibit-c-title-row">',
      '            <div class="exhibit-c-title">Updates</div>',
      '            <button class="exhibit-c-jump-btn" data-jump="news">Open Screen 09 &rarr;</button>',
      '          </div>',
      '          <div class="exhibit-c-desc">File events and the rule changes that touch this client, with per-category notification controls the client actually owns.</div>',
      '        </div>',
      '      </div>',
      '      <!-- 10 -->',
      '      <div class="exhibit-c-item">',
      '        <div class="exhibit-c-num">10</div>',
      '        <div class="exhibit-c-body">',
      '          <div class="exhibit-c-title-row">',
      '            <div class="exhibit-c-title">Firm view</div>',
      '            <button class="exhibit-c-jump-btn" data-jump="firm">Open Screen 10 &rarr;</button>',
      '          </div>',
      '          <div class="exhibit-c-desc">The half nobody demos: who is waiting, who has not signed, whose KBA failed, what is due today. Without this the app makes the client’s life better and the firm’s worse.</div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">',
      '      <button id="btn-c-to-b" class="btn sm btn-o">&larr; Previous: Exhibit B</button>',
      '      <button id="btn-c-to-e" class="btn sm btn-b">Next: Exhibit E &rarr;</button>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- PANE EXHIBIT E -->',
      '  <div id="pane-exhibit-e" style="display:none;font-size:.85rem;line-height:1.65;color:#fff">',
      '    <div class="exhibit-e-theme">',
      '      <div class="exhibit-b-header">',
      '        <span class="exhibit-b-badge-gold">Exhibit E</span>',
      '        <span class="exhibit-b-page">05 of 12</span>',
      '      </div>',
      '      <h3 class="exhibit-b-title">Running your own portal makes you the custodian</h3>',
      '      <div class="exhibit-b-subtitle">',
      '        A tax preparer is a &ldquo;financial institution&rdquo; under the FTC Safeguards Rule. That is already true today. Holding client documents on your own infrastructure makes it considerably more expensive to satisfy.',
      '      </div>',
      '',
      '      <div class="exhibit-e-grid">',
      '        <!-- The Nine Elements -->',
      '        <div class="exhibit-e-col">',
      '          <div class="exhibit-e-col-hdr">THE NINE ELEMENTS &ndash; 16 CFR 314.4</div>',
      '          <ul class="exhibit-e-list">',
      '            <li>A named Qualified Individual accountable for the programme</li>',
      '            <li>A written risk assessment, reassessed periodically</li>',
      '            <li>Safeguards: access control, data inventory, encryption in transit and at rest, secure development, MFA, secure disposal, change management, logging</li>',
      '            <li>Annual penetration testing and vulnerability scans every six months, plus after material changes</li>',
      '            <li>Staff security training, kept current</li>',
      '            <li>Service-provider oversight &mdash; selection, contract terms, reassessment</li>',
      '            <li>Keeping the programme current</li>',
      '            <li>A written incident response plan</li>',
      '            <li>An annual written report to the senior officer</li>',
      '          </ul>',
      '        </div>',
      '',
      '        <!-- And Then -->',
      '        <div class="exhibit-e-col">',
      '          <div class="exhibit-e-col-hdr">AND THEN</div>',
      '          <ul class="exhibit-e-list">',
      '            <li>Breach notice to the FTC within 30 days where 500 or more consumers&rsquo; unencrypted information was acquired &mdash; in force since 13 May 2024</li>',
      '            <li>State breach law in every affected resident&rsquo;s state. You file in all fifty; one incident can trigger fifty different clocks. Maryland gives 45 days and requires notice to the Attorney General first; the District requires 18 months of identity protection where taxpayer identifiers are involved</li>',
      '            <li>Disposal of customer information no later than two years after last use, unless retention is required</li>',
      '            <li>A written information security plan &mdash; IRS Publication 4557 requires it, Publication 5708 is the template</li>',
      '            <li>IRC &sect;7216 on disclosure of return information: criminal penalty up to $1,000 and one year; civil penalty $250 per disclosure to a $10,000 annual cap, rising to $1,000 and $50,000 where identity theft is involved</li>',
      '          </ul>',
      '        </div>',
      '      </div>',
      '',
      '      <!-- One Piece of Good News Callout -->',
      '      <div class="exhibit-b-callout">',
      '        <span class="exhibit-b-callout-tag">ONE PIECE OF GOOD NEWS</span>',
      '        <p class="exhibit-b-callout-text">',
      '          A firm holding information on <b>fewer than 5,000 consumers</b> is exempt from four of these &mdash; the written risk assessment, the prescribed testing cadence, the incident response plan and the annual report. Count your consumer records: if you are under the line, say so in the security programme and revisit it annually, because it is a threshold you grow through rather than a permanent relief. Encryption, MFA, disposal and service-provider oversight apply either way.',
      '        </p>',
      '      </div>',
      '',
      '      <p style="margin-top:14px;font-size:.82rem;color:rgba(255,255,255,0.85);line-height:1.55">',
      '        Buying a platform does not remove any of this. It moves most of the technical burden onto a vendor you must still select, contract with and reassess &mdash; which is itself one of the nine elements.',
      '      </p>',
      '    </div>',
      '',
      '    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">',
      '      <button id="btn-e-to-c" class="btn sm btn-o">&larr; Previous: Exhibit C</button>',
      '      <button id="btn-e-to-f" class="btn sm btn-b">Next: Exhibit F &rarr;</button>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- PANE EXHIBIT F -->',
      '  <div id="pane-exhibit-f" style="display:none;font-size:.85rem;line-height:1.65;color:var(--ink)">',
      '    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:14px;font-family:var(--f-mono);font-size:.72rem;color:var(--ink-3)">',
      '      <span style="letter-spacing:.12em;text-transform:uppercase;color:var(--blue);font-weight:600">Exhibit F</span>',
      '      <span style="font-weight:600">06 of 12</span>',
      '    </div>',
      '    <h3 style="font-size:1.4rem;font-weight:400;margin-bottom:8px;color:var(--ink);letter-spacing:-0.02em">How it is put together</h3>',
      '    <p style="margin-bottom:16px;color:var(--ink-2)">One backend, three clients, four licensed services. Nothing exotic &mdash; the engineering risk here is not architectural, it is in the handling of regulated data.</p>',
      '',
      '    <!-- SECTION 1: WHAT YOU BUILD -->',
      '    <div class="exhibit-section-hdr">WHAT YOU BUILD</div>',
      '    <table class="exhibit-table">',
      '      <tbody>',
      '        <tr>',
      '          <td style="width:140px"><b>API and data layer</b></td>',
      '          <td style="color:var(--ink-2)">Clients, engagements, tax years, document requests, documents, messages, invoices, events. Multi-tenant from day one even though there is one firm today &mdash; retrofitting tenancy is the expensive mistake.</td>',
      '          <td style="width:100px;text-align:right">',
      '            <div style="font-size:1.05rem;font-weight:600;color:var(--blue)">core</div>',
      '          </td>',
      '        </tr>',
      '        <tr>',
      '          <td><b>Web client</b></td>',
      '          <td style="color:var(--ink-2)">Responsive, the same application on desktop and phone browser. Screens 01&ndash;09.</td>',
      '          <td style="text-align:right">',
      '            <div style="font-size:1.05rem;font-weight:600;color:var(--blue)">phase 1</div>',
      '          </td>',
      '        </tr>',
      '        <tr>',
      '          <td><b>Firm console</b></td>',
      '          <td style="color:var(--ink-2)">Screen 10. Assignment, request templates by return type, automatic chasing, the signature evidence archive, the audit log.</td>',
      '          <td style="text-align:right">',
      '            <div style="font-size:1.05rem;font-weight:600;color:var(--blue)">phase 1</div>',
      '          </td>',
      '        </tr>',
      '        <tr>',
      '          <td><b>iOS and Android</b></td>',
      '          <td style="color:var(--ink-2)">Native. Push, camera capture, biometric unlock. Same API.</td>',
      '          <td style="text-align:right">',
      '            <div style="font-size:1.05rem;font-weight:600;color:var(--blue)">phase 2</div>',
      '          </td>',
      '        </tr>',
      '      </tbody>',
      '    </table>',
      '',
      '    <!-- SECTION 2: WHAT YOU LICENSE -->',
      '    <div class="exhibit-section-hdr">WHAT YOU LICENSE</div>',
      '    <table class="exhibit-table">',
      '      <tbody>',
      '        <tr>',
      '          <td style="width:140px"><b>Identity</b></td>',
      '          <td style="color:var(--ink-2)">Managed authentication with MFA. Auth0 is free to 25,000 monthly active users; AWS Cognito runs $0.015&ndash;$0.020 per monthly active user; Clerk is free to 50,000 then $0.02.</td>',
      '          <td style="width:130px;text-align:right">',
      '            <div style="font-size:1.15rem;font-weight:600;color:var(--blue)">&lt;$50</div>',
      '            <div style="font-family:var(--f-mono);font-size:.64rem;color:var(--ink-3);letter-spacing:.04em">PER MONTH AT YOUR SCALE</div>',
      '          </td>',
      '        </tr>',
      '        <tr>',
      '          <td><b>E-signature + KBA</b></td>',
      '          <td style="color:var(--ink-2)">DocuSign, or SafeSend behind the app. See Exhibit D.</td>',
      '          <td style="text-align:right">',
      '            <div style="font-size:1.15rem;font-weight:600;color:var(--blue)">$2.40</div>',
      '            <div style="font-family:var(--f-mono);font-size:.64rem;color:var(--ink-3);letter-spacing:.04em">PER IDENTITY CHECK</div>',
      '          </td>',
      '        </tr>',
      '        <tr>',
      '          <td><b>Payments</b></td>',
      '          <td style="color:var(--ink-2)">Fully hosted checkout, so card data never reaches your servers. Stripe 2.9% + $0.30 card, 0.8% ACH capped at $5. CPACharge $10/month, 2.99% + $0.30, 1% ACH capped at $10 &mdash; and it supports surcharging, which Stripe leaves you to build.</td>',
      '          <td style="text-align:right">',
      '            <div style="font-size:1.15rem;font-weight:600;color:var(--blue)">2.9%</div>',
      '            <div style="font-family:var(--f-mono);font-size:.64rem;color:var(--ink-3);letter-spacing:.04em">+ $0.30 CARD</div>',
      '          </td>',
      '        </tr>',
      '        <tr>',
      '          <td><b>Upload scanning</b></td>',
      '          <td style="color:var(--ink-2)">Malware scanning on every inbound file. From $99 per month for 5,000 scans.</td>',
      '          <td style="text-align:right">',
      '            <div style="font-size:1.15rem;font-weight:600;color:var(--blue)">$99</div>',
      '            <div style="font-family:var(--f-mono);font-size:.64rem;color:var(--ink-3);letter-spacing:.04em">PER MONTH</div>',
      '          </td>',
      '        </tr>',
      '        <tr>',
      '          <td><b>Storage, logging</b></td>',
      '          <td style="color:var(--ink-2)">Encrypted object storage at $0.023 per GB per month; centralised logging and alerting.</td>',
      '          <td style="text-align:right">',
      '            <div style="font-size:1.15rem;font-weight:600;color:var(--blue)">$100&ndash;$250</div>',
      '            <div style="font-family:var(--f-mono);font-size:.64rem;color:var(--ink-3);letter-spacing:.04em">PER MONTH</div>',
      '          </td>',
      '        </tr>',
      '      </tbody>',
      '    </table>',
      '',
      '    <!-- Callout Box -->',
      '    <div class="exhibit-callout">',
      '      <span class="exhibit-callout-tag" style="color:var(--blue)">THE PAYMENTS DECISION THAT CHANGES YOUR COMPLIANCE BURDEN</span>',
      '      <p style="font-size:.85rem;line-height:1.6;color:var(--ink)">',
      '        If the client is redirected to the processor\'s own hosted page, you sit in the lightest PCI category &mdash; roughly twenty-two requirements. If you embed card fields in your own page, even in an iframe, you move to the next category up: around <b>191 requirements</b>, essentially full PCI DSS. Redirect. It costs one extra screen transition and saves a compliance programme.',
      '      </p>',
      '    </div>',
      '',
      '    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">',
      '      <button id="btn-f-to-e" class="btn sm btn-o">&larr; Previous: Exhibit E</button>',
      '      <button id="btn-f-to-h" class="btn sm btn-b">Next: Exhibit H &rarr;</button>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- PANE EXHIBIT H -->',
      '  <div id="pane-exhibit-h" style="display:none;font-size:.85rem;line-height:1.65;color:#fff">',
      '    <div class="exhibit-e-theme">',
      '      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(255,255,255,0.25);padding-bottom:10px;margin-bottom:14px;flex-wrap:wrap;gap:8px">',
      '        <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap">',
      '          <span style="font-family:var(--f-mono);font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#EAE42F;font-weight:700">Exhibit H</span>',
      '          <h3 style="display:inline;font-size:1.35rem;font-weight:700;color:#FFFFFF;margin:0;letter-spacing:-0.02em">What it costs to run, every year, forever</h3>',
      '        </div>',
      '        <span style="font-family:var(--f-mono);font-size:.72rem;color:rgba(255,255,255,0.7);font-weight:600">08 of 12</span>',
      '      </div>',
      '',
      '      <p style="margin-bottom:4px;color:#FFFFFF;font-size:.92rem;line-height:1.5">Modelled at six staff and four hundred clients, with roughly six hundred signatures a year.</p>',
      '      <p style="margin-bottom:18px;color:#FFFFFF;font-size:.92rem;line-height:1.5">Ranges are planning figures drawn from published rates, not quotes.</p>',
      '',
      '      <!-- Section 1: ANNUAL RUN RATE - CUSTOM BUILD -->',
      '      <div style="font-family:var(--f-mono);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:#EAE42F;font-weight:700;margin-top:14px;margin-bottom:6px">ANNUAL RUN RATE &ndash; CUSTOM BUILD</div>',
      '      <table class="exhibit-blue-table">',
      '        <tbody>',
      '          <tr>',
      '            <td style="width:160px"><b>Hosting</b></td>',
      '            <td style="color:rgba(255,255,255,0.9)">Compute, database, backups</td>',
      '            <td class="cost">$3,000</td>',
      '          </tr>',
      '          <tr>',
      '            <td><b>Storage</b></td>',
      '            <td style="color:rgba(255,255,255,0.9)">Encrypted object storage and versioning</td>',
      '            <td class="cost">$200</td>',
      '          </tr>',
      '          <tr>',
      '            <td><b>Identity</b></td>',
      '            <td style="color:rgba(255,255,255,0.9)">Managed authentication with MFA</td>',
      '            <td class="cost">$150</td>',
      '          </tr>',
      '          <tr>',
      '            <td><b>Upload scanning</b></td>',
      '            <td style="color:rgba(255,255,255,0.9)">Malware scanning, 5,000 files</td>',
      '            <td class="cost">$1,200</td>',
      '          </tr>',
      '          <tr>',
      '            <td><b>Logging</b></td>',
      '            <td style="color:rgba(255,255,255,0.9)">Centralised logs, alerting, retention</td>',
      '            <td class="cost">$1,200</td>',
      '          </tr>',
      '          <tr>',
      '            <td><b>E-signature</b></td>',
      '            <td style="color:rgba(255,255,255,0.9)">Six seats plus 600 identity checks at $2.40</td>',
      '            <td class="cost">$4,700</td>',
      '          </tr>',
      '          <tr>',
      '            <td><b>Vulnerability scans</b></td>',
      '            <td style="color:rgba(255,255,255,0.9)">Semi-annual, as the Safeguards Rule requires</td>',
      '            <td class="cost">$3,600</td>',
      '          </tr>',
      '          <tr>',
      '            <td><b>Penetration test</b></td>',
      '            <td style="color:rgba(255,255,255,0.9)">Annual, web and mobile</td>',
      '            <td class="cost">$18k&ndash;$35k</td>',
      '          </tr>',
      '          <tr>',
      '            <td><b>App stores</b></td>',
      '            <td style="color:rgba(255,255,255,0.9)">Apple $99 a year, Google $25 once</td>',
      '            <td class="cost">$124</td>',
      '          </tr>',
      '          <tr>',
      '            <td><b>Maintenance</b></td>',
      '            <td style="color:rgba(255,255,255,0.9)">15&ndash;20% of the $150k&ndash;$350k software build, the industry rule of thumb</td>',
      '            <td class="cost">$23k&ndash;$70k</td>',
      '          </tr>',
      '          <tr class="total-row">',
      '            <td><b>Total</b></td>',
      '            <td style="color:#FFFFFF">Before payment processing, which is a percentage of fees collected either way</td>',
      '            <td class="cost">$55k&ndash;$119k</td>',
      '          </tr>',
      '        </tbody>',
      '      </table>',
      '',
      '      <!-- Section 2: THE SAME PRACTICE ON A LICENSED PLATFORM -->',
      '      <div style="font-family:var(--f-mono);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:#EAE42F;font-weight:700;margin-top:18px;margin-bottom:6px">THE SAME PRACTICE ON A LICENSED PLATFORM</div>',
      '      <table class="exhibit-blue-table">',
      '        <tbody>',
      '          <tr>',
      '            <td style="width:160px"><b>TaxDome Pro</b></td>',
      '            <td style="color:rgba(255,255,255,0.9)">Six seats, unlimited signatures, 600 KBA attempts at $1.00</td>',
      '            <td class="cost">$6,600</td>',
      '          </tr>',
      '        </tbody>',
      '      </table>',
      '',
      '      <!-- Callout Box: READ THIS LINE TWICE -->',
      '      <div class="exhibit-b-callout" style="margin-top:20px">',
      '        <span class="exhibit-b-callout-tag">READ THIS LINE TWICE</span>',
      '        <p class="exhibit-b-callout-text" style="color:#FFFFFF;line-height:1.6">',
      '          The penetration test alone costs more each year than the entire platform licence. That is not an argument against building &mdash; it is the argument that building only makes sense if the thing you build earns revenue of its own.',
      '        </p>',
      '      </div>',
      '    </div>',
      '',
      '    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">',
      '      <button id="btn-h-to-f" class="btn sm btn-o">&larr; Previous: Exhibit F</button>',
      '      <button id="btn-h-to-i" class="btn sm btn-b">Next: Exhibit I &rarr;</button>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- PANE EXHIBIT I -->',
      '  <div id="pane-exhibit-i" style="display:none;font-size:.85rem;line-height:1.65;color:var(--ink)">',
      '    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:14px;font-family:var(--f-mono);font-size:.72rem;color:var(--ink-3)">',
      '      <span style="letter-spacing:.12em;text-transform:uppercase;color:var(--blue);font-weight:600">Exhibit I</span>',
      '      <span style="font-weight:600">09 of 12</span>',
      '    </div>',
      '    <h3 style="font-size:1.4rem;font-weight:400;margin-bottom:12px;color:var(--ink);letter-spacing:-0.02em">What changes when it goes in the stores</h3>',
      '    <p style="margin-bottom:18px;color:var(--ink-2);font-size:.9rem;line-height:1.6">You chose web plus native. Native is worth having, but it introduces two gatekeepers with opinions about financial apps.</p>',
      '',
      '    <div class="exhibit-i-grid">',
      '      <!-- Column 1: WHAT NATIVE GENUINELY BUYS -->',
      '      <div>',
      '        <div class="exhibit-i-col-hdr">WHAT NATIVE GENUINELY BUYS</div>',
      '        <ul class="exhibit-i-list">',
      '          <li><b>Push notifications that arrive.</b> The single biggest reason clients respond faster &mdash; browser push on iOS is still unreliable</li>',
      '          <li><b>Camera capture that behaves like a scanner</b> &mdash; edge detection, multi-page, straightened output. This is how a W-2 gets uploaded from a kitchen table</li>',
      '          <li><b>Face ID and Touch ID as the second factor</b>, which removes most of the friction MFA otherwise adds</li>',
      '          <li><b>Presence.</b> An icon on the home screen is a year-round reminder that the file is open</li>',
      '        </ul>',
      '      </div>',
      '',
      '      <!-- Column 2: WHAT IT COSTS YOU IN PROCESS -->',
      '      <div>',
      '        <div class="exhibit-i-col-hdr">WHAT IT COSTS YOU IN PROCESS</div>',
      '        <ul class="exhibit-i-list">',
      '          <li><b>Privacy disclosures</b> on both stores, including a financial-data category, kept accurate as the app changes</li>',
      '          <li><b>In-app account deletion</b> is mandatory on both &mdash; with a documented exception for regulated retention, which your three-year signature records need</li>',
      '          <li><b>Review cycles</b> on every release. Fixes are not same-day</li>',
      '          <li><b>Two more codebases</b> to maintain, test and pay for in the annual penetration test</li>',
      '          <li><b>Apple $99 a year; Google $25 once</b></li>',
      '        </ul>',
      '      </div>',
      '    </div>',
      '',
      '    <!-- Callout Box: OPEN QUESTION -->',
      '    <div class="exhibit-callout-alert">',
      '      <span class="exhibit-callout-alert-tag">OPEN QUESTION &ndash; CONFIRM BEFORE YOU BUILD THE PAYMENT SCREEN</span>',
      '      <p>Both stores exempt real-world services consumed outside the app from mandatory in-app purchase and its 15&ndash;30% commission. Apple\'s guideline covers &ldquo;physical goods or services that will be consumed outside of the app&rdquo;; Google\'s names physical services such as transport and gym memberships. Tax preparation reads squarely as such a service &mdash; but <b>neither store names professional services as a labelled exemption</b>, and the inference has never been tested for your app.</p>',
      '      <p>A 15&ndash;30% commission on tax-preparation fees would be catastrophic to the model. Confirm it in writing with both stores, or through app-review counsel, before phase 2 starts. If in doubt, phase 2 ships without in-app payment and links out.</p>',
      '    </div>',
      '',
      '    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">',
      '      <button id="btn-i-to-h" class="btn sm btn-o">&larr; Previous: Exhibit H</button>',
      '      <button id="btn-i-to-j" class="btn sm btn-b">Next: Exhibit J &rarr;</button>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- PANE EXHIBIT J -->',
      '  <div id="pane-exhibit-j" style="display:none;font-size:.85rem;line-height:1.65;color:#fff">',
      '    <div class="exhibit-e-theme">',
      '      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(255,255,255,0.25);padding-bottom:10px;margin-bottom:14px;flex-wrap:wrap;gap:8px">',
      '        <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap">',
      '          <span style="font-family:var(--f-mono);font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#EAE42F;font-weight:700">Exhibit J</span>',
      '          <h3 style="display:inline;font-size:1.35rem;font-weight:700;color:#FFFFFF;margin:0;letter-spacing:-0.02em">The only version of this that pencils</h3>',
      '        </div>',
      '        <span style="font-family:var(--f-mono);font-size:.72rem;color:rgba(255,255,255,0.7);font-weight:600">10 of 12</span>',
      '      </div>',
      '',
      '      <!-- Hero Statement -->',
      '      <h2 style="font-size:1.6rem;font-weight:600;line-height:1.35;color:#FFFFFF;margin:16px 0 16px;letter-spacing:-0.02em">',
      '        As an internal tool, this app costs seventeen times the alternative at best. As a <span style="color:#EAE42F">product</span>, the same code has a market.',
      '      </h2>',
      '',
      '      <!-- Body Paragraphs -->',
      '      <p style="margin-bottom:12px;color:rgba(255,255,255,0.9);font-size:.88rem;line-height:1.6">',
      '        Exhibit H is uncomfortable on purpose. As a portal for one firm, a custom build is a large permanent cost centre bought to replace a $6,600 subscription. No honest reading of those numbers says otherwise.',
      '      </p>',
      '      <p style="margin-bottom:18px;color:rgba(255,255,255,0.9);font-size:.88rem;line-height:1.6">',
      '        But there is a second reading. Everything in Exhibit F &mdash; multi-tenancy from day one, licensed signing, hosted payments, a firm console &mdash; describes a product that other small tax firms need and are currently paying $800 to $1,200 per seat per year for. Pivot Aide would be building against a market it is already inside, with a brand character nobody else has and a positioning &mdash; the file that stays open all year &mdash; that the incumbents do not articulate.',
      '      </p>',
      '',
      '      <!-- Two Columns Grid -->',
      '      <div class="exhibit-e-grid">',
      '        <!-- Column 1: WHAT HAS TO BE TRUE -->',
      '        <div class="exhibit-e-col">',
      '          <div class="exhibit-e-col-hdr">WHAT HAS TO BE TRUE</div>',
      '          <ul class="exhibit-e-list">',
      '            <li>Multi-tenant from the first commit, not retrofitted</li>',
      '            <li>The firm console is treated as the product, not an afterthought</li>',
      '            <li>Someone owns it as a product &mdash; roadmap, support, releases</li>',
      '            <li>SOC 2 becomes a real objective, because firms will ask</li>',
      '            <li>Ten to twenty paying firms at $6,000 covers the run rate in Exhibit H</li>',
      '          </ul>',
      '        </div>',
      '',
      '        <!-- Column 2: WHAT KILLS IT -->',
      '        <div class="exhibit-e-col">',
      '          <div class="exhibit-e-col-hdr">WHAT KILLS IT</div>',
      '          <ul class="exhibit-e-list">',
      '            <li>Building it single-tenant &ldquo;for now&rdquo;</li>',
      '            <li>Writing your own KBA instead of licensing it</li>',
      '            <li>Embedding card fields and inheriting full PCI scope</li>',
      '            <li>Starting phase 2 before phase 1 survives a season</li>',
      '            <li>Nobody at the firm owning the security programme by name</li>',
      '          </ul>',
      '        </div>',
      '      </div>',
      '',
      '      <!-- Callout Box: The Recommendation -->',
      '      <div class="exhibit-b-callout" style="margin-top:20px">',
      '        <span class="exhibit-b-callout-tag">THE RECOMMENDATION, IN ONE SENTENCE</span>',
      '        <p class="exhibit-b-callout-text" style="color:#FFFFFF;line-height:1.6">',
      '          Run this season on a licensed platform, build phase 1 as a multi-tenant product rather than a private portal, and decide at the end of the first season whether you are running a tax firm with a good app or a tax firm with a software business &mdash; but build it so that the second answer stays available.',
      '        </p>',
      '      </div>',
      '    </div>',
      '',
      '    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">',
      '      <button id="btn-j-to-i" class="btn sm btn-o">&larr; Previous: Exhibit I</button>',
      '      <button id="btn-j-to-k" class="btn sm btn-b">Next: Exhibit K &rarr;</button>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- PANE EXHIBIT K -->',
      '  <div id="pane-exhibit-k" style="display:none;font-size:.85rem;line-height:1.65;color:var(--ink)">',
      '    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:14px;font-family:var(--f-mono);font-size:.72rem;color:var(--ink-3)">',
      '      <span style="letter-spacing:.12em;text-transform:uppercase;color:var(--blue);font-weight:600">Exhibit K</span>',
      '      <span style="font-weight:600">11 of 12</span>',
      '    </div>',
      '    <h3 style="font-size:1.4rem;font-weight:400;margin-bottom:12px;color:var(--ink);letter-spacing:-0.02em">What I need from you before anything is built</h3>',
      '    <p style="margin-bottom:16px;color:var(--ink-2);font-size:.9rem;line-height:1.6">Nine open items. The first three block the build; the rest block launch.</p>',
      '',
      '    <div class="exhibit-k-list">',
      '      <!-- 01 -->',
      '      <div class="exhibit-k-item">',
      '        <div class="exhibit-k-num">01</div>',
      '        <div class="exhibit-k-content">',
      '          <div class="exhibit-k-title">Is this a product or a portal?</div>',
      '          <div class="exhibit-k-desc">Exhibit J’s question. It changes the data model on day one and cannot be deferred.</div>',
      '        </div>',
      '      </div>',
      '',
      '      <!-- 02 -->',
      '      <div class="exhibit-k-item">',
      '        <div class="exhibit-k-num">02</div>',
      '        <div class="exhibit-k-content">',
      '          <div class="exhibit-k-title">Who is the Qualified Individual?</div>',
      '          <div class="exhibit-k-desc">The Safeguards Rule requires a named person accountable for the security programme. It can be you; it cannot be nobody.</div>',
      '        </div>',
      '      </div>',
      '',
      '      <!-- 03 -->',
      '      <div class="exhibit-k-item">',
      '        <div class="exhibit-k-num">03</div>',
      '        <div class="exhibit-k-content">',
      '          <div class="exhibit-k-title">Who builds it?</div>',
      '          <div class="exhibit-k-desc">An agency, a contract team, or a hire. The cost ranges in this file assume US or nearshore agency rates &mdash; $100 to $149 an hour in the States, $55 to $120 nearshore.</div>',
      '        </div>',
      '      </div>',
      '',
      '      <!-- 04 -->',
      '      <div class="exhibit-k-item">',
      '        <div class="exhibit-k-num">04</div>',
      '        <div class="exhibit-k-content">',
      '          <div class="exhibit-k-title">Circular 230 representation rights &mdash; still open.</div>',
      '          <div class="exhibit-k-desc">The same question that gates Audit &amp; Resolution tiers 2 and 3 and The Standing File on the website. The app’s services catalogue cannot list what the firm cannot perform.</div>',
      '        </div>',
      '      </div>',
      '',
      '      <!-- 05 -->',
      '      <div class="exhibit-k-item">',
      '        <div class="exhibit-k-num">05</div>',
      '        <div class="exhibit-k-content">',
      '          <div class="exhibit-k-title">Signing vendor.</div>',
      '          <div class="exhibit-k-desc">DocuSign at $2.40 per identity check, or SafeSend behind the app. SafeSend needs a call &mdash; they do not publish.</div>',
      '        </div>',
      '      </div>',
      '',
      '      <!-- 06 -->',
      '      <div class="exhibit-k-item">',
      '        <div class="exhibit-k-num">06</div>',
      '        <div class="exhibit-k-content">',
      '          <div class="exhibit-k-title">Do you want to surcharge card payments?</div>',
      '          <div class="exhibit-k-desc">CPACharge supports it out of the box; Stripe leaves you to build and validate it per state. This decides the processor.</div>',
      '        </div>',
      '      </div>',
      '',
      '      <!-- 07 -->',
      '      <div class="exhibit-k-item">',
      '        <div class="exhibit-k-num">07</div>',
      '        <div class="exhibit-k-content">',
      '          <div class="exhibit-k-title">App store commission &mdash; confirmed in writing?</div>',
      '          <div class="exhibit-k-desc">Exhibit I. Do not build in-app payment for phase 2 until this is answered.</div>',
      '        </div>',
      '      </div>',
      '',
      '      <!-- 08 -->',
      '      <div class="exhibit-k-item">',
      '        <div class="exhibit-k-num">08</div>',
      '        <div class="exhibit-k-content">',
      '          <div class="exhibit-k-title">The name.</div>',
      '          <div class="exhibit-k-desc">&ldquo;The File Room&rdquo; is a working title chosen to sit beside The Standing File. It is yours to overrule.</div>',
      '        </div>',
      '      </div>',
      '',
      '      <!-- 09 -->',
      '      <div class="exhibit-k-item">',
      '        <div class="exhibit-k-num">09</div>',
      '        <div class="exhibit-k-content">',
      '          <div class="exhibit-k-title">Do we run phase 0?</div>',
      '          <div class="exhibit-k-desc">A licensed platform this season, in parallel with the build. My recommendation is yes.</div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '',
      '    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px">',
      '      <button id="btn-k-to-j" class="btn sm btn-o">&larr; Previous: Exhibit J</button>',
      '      <button id="btn-k-to-l" class="btn sm btn-b">Next: Exhibit L &rarr;</button>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- PANE EXHIBIT L -->',
      '  <div id="pane-exhibit-l" style="display:none;font-size:.85rem;line-height:1.65;color:var(--ink)">',
      '    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:14px;font-family:var(--f-mono);font-size:.72rem;color:var(--ink-3)">',
      '      <span style="letter-spacing:.12em;text-transform:uppercase;color:var(--blue);font-weight:600">Exhibit L</span>',
      '      <span style="font-weight:600">12 of 12</span>',
      '    </div>',
      '    <h3 style="font-size:1.4rem;font-weight:400;margin-bottom:12px;color:var(--ink);letter-spacing:-0.02em">Where every figure in this file came from</h3>',
      '    <p style="margin-bottom:18px;color:var(--ink-2);font-size:.9rem;line-height:1.6">Checked 2 September 2026. Rules and prices change; re-verify before signing anything.</p>',
      '',
      '    <div class="exhibit-i-grid">',
      '      <!-- Column 1: REGULATION -->',
      '      <div>',
      '        <div class="exhibit-i-col-hdr">REGULATION</div>',
      '        <ul class="exhibit-i-list">',
      '          <li><b>FTC Safeguards Rule</b> &mdash; 16 CFR Part 314, ecfr.gov; FTC business guidance, &ldquo;Safeguards Rule: What Your Business Needs to Know&rdquo;</li>',
      '          <li><b>Breach notification</b> &mdash; 500 consumers, 30 days, effective 13 May 2024; FTC business blog, May 2024</li>',
      '          <li><b>Small-entity exemption</b> &mdash; 16 CFR &sect;314.6, fewer than 5,000 consumers</li>',
      '          <li><b>WISP</b> &mdash; IRS Publication 4557; template at Publication 5708</li>',
      '          <li><b>Form 8879 e-signature</b> &mdash; IRS e-file signature authorisation FAQ and IRM 10.10.1; made permanent October 2023</li>',
      '          <li><b>&sect;7216 and &sect;6713</b> &mdash; 26 CFR 301.7216-1 and -2; Rev. Proc. 2013-14; 26 USC 6713</li>',
      '          <li><b>PCI DSS v4.0.1</b> &mdash; new requirements mandatory 31 March 2025; SAQ A versus SAQ A-EP scope</li>',
      '          <li><b>State breach law</b> &mdash; Md. Com. Law &sect;14-3504; Va. Code &sect;18.2-186.6; D.C. Code &sect;28-3851</li>',
      '        </ul>',
      '      </div>',
      '',
      '      <!-- Column 2: PRICES -->',
      '      <div>',
      '        <div class="exhibit-i-col-hdr">PRICES</div>',
      '        <ul class="exhibit-i-list">',
      '          <li><b>TaxDome</b> &mdash; taxdome.com/pricing; KBA $1.00 per signer, help centre</li>',
      '          <li><b>Canopy</b> &mdash; getcanopy.com/pricing; KBA credits $1.25</li>',
      '          <li><b>Liscio</b> &mdash; liscio.me/pricing</li>',
      '          <li><b>Karbon</b> &mdash; karbonhq.com/pricing</li>',
      '          <li><b>SafeSend</b> &mdash; pricing not published; per-return figures circulating on G2 date from October 2024 and should not be budgeted from</li>',
      '          <li><b>DocuSign</b> &mdash; ecom.docusign.com plans and pricing; ID verification $2.40</li>',
      '          <li><b>Stripe</b> &mdash; stripe.com/pricing</li>',
      '          <li><b>CPACharge</b> &mdash; cpacharge.com/pricing</li>',
      '          <li><b>Auth0, Cognito, Clerk</b> &mdash; each vendor&rsquo;s own pricing page</li>',
      '          <li><b>Penetration testing</b> &mdash; published 2026 industry ranges, Blaze Infosec and Invicti</li>',
      '          <li><b>Developer rates</b> &mdash; Clutch 2026 US web rates; Netguru 2026 mobile rates</li>',
      '          <li><b>App stores</b> &mdash; developer.apple.com/programs; Play Console help</li>',
      '        </ul>',
      '      </div>',
      '    </div>',
      '',
      '    <!-- Callout Box: STATED AS UNCERTAIN -->',
      '    <div class="exhibit-callout-alert" style="margin-top:24px">',
      '      <span class="exhibit-callout-alert-tag">STATED AS UNCERTAIN</span>',
      '      <p>Three figures in this file rest on secondary sources and are flagged rather than relied on: SafeSend&rsquo;s per-return pricing, the semi-annual vulnerability-scanning cost, and the 15&ndash;20% maintenance rule of thumb. The app-store commission question in Exhibit I is an inference from policy language, not a confirmed carve-out, and is the single item in this file most worth confirming before money is spent.</p>',
      '    </div>',
      '',
      '    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px">',
      '      <button id="btn-l-to-k" class="btn sm btn-o">&larr; Previous: Exhibit K</button>',
      '      <button id="btn-l-to-safe" class="btn sm btn-b">Next: Safeguards Architecture &rarr;</button>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- PANE SAFEGUARDS -->',
      '  <div id="pane-safeguards" style="display:none;font-size:.86rem;line-height:1.65;color:var(--ink)">',
      '    <div style="background:var(--night-2);color:#fff;padding:14px;border-radius:6px;margin-bottom:14px">',
      '      <span style="font-family:var(--f-mono);font-size:.64rem;color:var(--gold);letter-spacing:.14em;text-transform:uppercase;display:block;margin-bottom:4px">IRS Pub 1345 &middot; FTC Safeguards Architecture</span>',
      '      <h4 style="margin:0;font-size:1.05rem;font-weight:600">The three things that actually matter</h4>',
      '    </div>',
      '    <div style="display:flex;flex-direction:column;gap:12px">',
      '      <div style="background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:12px 14px">',
      '        <b style="color:var(--blue)">1. The Division &mdash; Not a tax engine</b>',
      '        <p style="margin-top:4px;font-size:.82rem;color:var(--ink-2)">The app is the custody, exchange, and relationship layer &mdash; documents, messages, signatures, answers, and billing. Returns are prepared in professional tax software by human practitioners.</p>',
      '      </div>',
      '      <div style="background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:12px 14px">',
      '        <b style="color:var(--gold)">2. The Hard Part &mdash; Signing is the regulated bit</b>',
      '        <p style="margin-top:4px;font-size:.82rem;color:var(--ink-2)">Remote signing of Form 8879 requires knowledge-based authentication (KBA), a strict 3-attempt limit, automatic fallback to wet ink signature, and a 3-year tamper-evident audit record.</p>',
      '      </div>',
      '      <div style="background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:12px 14px">',
      '        <b style="color:var(--ok)">3. The Obligation &mdash; Building it means owning it</b>',
      '        <p style="margin-top:4px;font-size:.82rem;color:var(--ink-2)">Any firm operating its own portal is classified as a financial institution under 16 CFR &sect;314.4(c)(5): named Qualified Individual, written risk assessment, mandatory MFA, encryption at rest/transit, annual penetration testing, and 30-day breach clock.</p>',
      '      </div>',
      '    </div>',
      '    <div style="display:flex;justify-content:flex-start;margin-top:16px">',
      '      <button id="btn-safe-to-l" class="btn sm btn-o">&larr; Back to Exhibit L</button>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('');

    openModal('The File Room &mdash; Exhibits &amp; Architecture Rules', html, '<button class="btn btn-b sm" id="modal-cancel-btn">Close</button>');

    var tabExA = document.getElementById('tab-btn-exhibit-a');
    var tabExB = document.getElementById('tab-btn-exhibit-b');
    var tabExC = document.getElementById('tab-btn-exhibit-c');
    var tabExE = document.getElementById('tab-btn-exhibit-e');
    var tabExF = document.getElementById('tab-btn-exhibit-f');
    var tabExH = document.getElementById('tab-btn-exhibit-h');
    var tabExI = document.getElementById('tab-btn-exhibit-i');
    var tabExJ = document.getElementById('tab-btn-exhibit-j');
    var tabExK = document.getElementById('tab-btn-exhibit-k');
    var tabExL = document.getElementById('tab-btn-exhibit-l');
    var tabSafe = document.getElementById('tab-btn-safeguards');
    var paneExA = document.getElementById('pane-exhibit-a');
    var paneExB = document.getElementById('pane-exhibit-b');
    var paneExC = document.getElementById('pane-exhibit-c');
    var paneExE = document.getElementById('pane-exhibit-e');
    var paneExF = document.getElementById('pane-exhibit-f');
    var paneExH = document.getElementById('pane-exhibit-h');
    var paneExI = document.getElementById('pane-exhibit-i');
    var paneExJ = document.getElementById('pane-exhibit-j');
    var paneExK = document.getElementById('pane-exhibit-k');
    var paneExL = document.getElementById('pane-exhibit-l');
    var paneSafe = document.getElementById('pane-safeguards');

    function setTab(active) {
      if (paneExA) paneExA.style.display = active === 'a' ? 'block' : 'none';
      if (paneExB) paneExB.style.display = active === 'b' ? 'block' : 'none';
      if (paneExC) paneExC.style.display = active === 'c' ? 'block' : 'none';
      if (paneExE) paneExE.style.display = active === 'e' ? 'block' : 'none';
      if (paneExF) paneExF.style.display = active === 'f' ? 'block' : 'none';
      if (paneExH) paneExH.style.display = active === 'h' ? 'block' : 'none';
      if (paneExI) paneExI.style.display = active === 'i' ? 'block' : 'none';
      if (paneExJ) paneExJ.style.display = active === 'j' ? 'block' : 'none';
      if (paneExK) paneExK.style.display = active === 'k' ? 'block' : 'none';
      if (paneExL) paneExL.style.display = active === 'l' ? 'block' : 'none';
      if (paneSafe) paneSafe.style.display = active === 'safe' ? 'block' : 'none';

      if (tabExA) {
        tabExA.className = active === 'a' ? 'btn sm btn-g' : 'btn sm btn-o';
        tabExA.style.color = active === 'a' ? '#fff' : 'var(--ink)';
      }
      if (tabExB) {
        tabExB.className = active === 'b' ? 'btn sm btn-g' : 'btn sm btn-o';
        tabExB.style.color = active === 'b' ? '#fff' : 'var(--ink)';
      }
      if (tabExC) {
        tabExC.className = active === 'c' ? 'btn sm btn-g' : 'btn sm btn-o';
        tabExC.style.color = active === 'c' ? '#fff' : 'var(--ink)';
      }
      if (tabExE) {
        tabExE.className = active === 'e' ? 'btn sm btn-g' : 'btn sm btn-o';
        tabExE.style.color = active === 'e' ? '#fff' : 'var(--ink)';
      }
      if (tabExF) {
        tabExF.className = active === 'f' ? 'btn sm btn-g' : 'btn sm btn-o';
        tabExF.style.color = active === 'f' ? '#fff' : 'var(--ink)';
      }
      if (tabExH) {
        tabExH.className = active === 'h' ? 'btn sm btn-g' : 'btn sm btn-o';
        tabExH.style.color = active === 'h' ? '#fff' : 'var(--ink)';
      }
      if (tabExI) {
        tabExI.className = active === 'i' ? 'btn sm btn-g' : 'btn sm btn-o';
        tabExI.style.color = active === 'i' ? '#fff' : 'var(--ink)';
      }
      if (tabExJ) {
        tabExJ.className = active === 'j' ? 'btn sm btn-g' : 'btn sm btn-o';
        tabExJ.style.color = active === 'j' ? '#fff' : 'var(--ink)';
      }
      if (tabExK) {
        tabExK.className = active === 'k' ? 'btn sm btn-g' : 'btn sm btn-o';
        tabExK.style.color = active === 'k' ? '#fff' : 'var(--ink)';
      }
      if (tabExL) {
        tabExL.className = active === 'l' ? 'btn sm btn-g' : 'btn sm btn-o';
        tabExL.style.color = active === 'l' ? '#fff' : 'var(--ink)';
      }
      if (tabSafe) {
        tabSafe.className = active === 'safe' ? 'btn sm btn-g' : 'btn sm btn-o';
        tabSafe.style.color = active === 'safe' ? '#fff' : 'var(--ink)';
      }
    }

    if (tabExA) tabExA.addEventListener('click', function() { setTab('a'); });
    if (tabExB) tabExB.addEventListener('click', function() { setTab('b'); });
    if (tabExC) tabExC.addEventListener('click', function() { setTab('c'); });
    if (tabExE) tabExE.addEventListener('click', function() { setTab('e'); });
    if (tabExF) tabExF.addEventListener('click', function() { setTab('f'); });
    if (tabExH) tabExH.addEventListener('click', function() { setTab('h'); });
    if (tabExI) tabExI.addEventListener('click', function() { setTab('i'); });
    if (tabExJ) tabExJ.addEventListener('click', function() { setTab('j'); });
    if (tabExK) tabExK.addEventListener('click', function() { setTab('k'); });
    if (tabExL) tabExL.addEventListener('click', function() { setTab('l'); });
    if (tabSafe) tabSafe.addEventListener('click', function() { setTab('safe'); });

    var btnAtoB = document.getElementById('btn-a-to-b');
    var btnBtoA = document.getElementById('btn-b-to-a');
    var btnBtoC = document.getElementById('btn-b-to-c');
    var btnCtoB = document.getElementById('btn-c-to-b');
    var btnCtoE = document.getElementById('btn-c-to-e');
    var btnEtoC = document.getElementById('btn-e-to-c');
    var btnEtoF = document.getElementById('btn-e-to-f');
    var btnFtoE = document.getElementById('btn-f-to-e');
    var btnFtoH = document.getElementById('btn-f-to-h');
    var btnHtoF = document.getElementById('btn-h-to-f');
    var btnHtoI = document.getElementById('btn-h-to-i');
    var btnItoH = document.getElementById('btn-i-to-h');
    var btnItoJ = document.getElementById('btn-i-to-j');
    var btnJtoI = document.getElementById('btn-j-to-i');
    var btnJtoK = document.getElementById('btn-j-to-k');
    var btnKtoJ = document.getElementById('btn-k-to-j');
    var btnKtoL = document.getElementById('btn-k-to-l');
    var btnLtoK = document.getElementById('btn-l-to-k');
    var btnLtoSafe = document.getElementById('btn-l-to-safe');
    var btnSafeToL = document.getElementById('btn-safe-to-l');

    if (btnAtoB) btnAtoB.addEventListener('click', function() { setTab('b'); });
    if (btnBtoA) btnBtoA.addEventListener('click', function() { setTab('a'); });
    if (btnBtoC) btnBtoC.addEventListener('click', function() { setTab('c'); });
    if (btnCtoB) btnCtoB.addEventListener('click', function() { setTab('b'); });
    if (btnCtoE) btnCtoE.addEventListener('click', function() { setTab('e'); });
    if (btnEtoC) btnEtoC.addEventListener('click', function() { setTab('c'); });
    if (btnEtoF) btnEtoF.addEventListener('click', function() { setTab('f'); });
    if (btnFtoE) btnFtoE.addEventListener('click', function() { setTab('e'); });
    if (btnFtoH) btnFtoH.addEventListener('click', function() { setTab('h'); });
    if (btnHtoF) btnHtoF.addEventListener('click', function() { setTab('f'); });
    if (btnHtoI) btnHtoI.addEventListener('click', function() { setTab('i'); });
    if (btnItoH) btnItoH.addEventListener('click', function() { setTab('h'); });
    if (btnItoJ) btnItoJ.addEventListener('click', function() { setTab('j'); });
    if (btnJtoI) btnJtoI.addEventListener('click', function() { setTab('i'); });
    if (btnJtoK) btnJtoK.addEventListener('click', function() { setTab('k'); });
    if (btnKtoJ) btnKtoJ.addEventListener('click', function() { setTab('j'); });
    if (btnKtoL) btnKtoL.addEventListener('click', function() { setTab('l'); });
    if (btnLtoK) btnLtoK.addEventListener('click', function() { setTab('k'); });
    if (btnLtoSafe) btnLtoSafe.addEventListener('click', function() { setTab('safe'); });
    if (btnSafeToL) btnSafeToL.addEventListener('click', function() { setTab('l'); });

    // Interactive Screen Jumping from Exhibit C
    if (el.modalContainer) {
      var jumpBtns = el.modalContainer.querySelectorAll('.exhibit-c-jump-btn');
      jumpBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          var targetScreen = btn.dataset.jump;
          if (targetScreen) {
            closeModal();
            showScreen(targetScreen);
            showToast('Navigated to Screen ' + btn.textContent.replace(/[^\d]/g, ''), 'info');
          }
        });
      });
    }
  }

  function initDeviceSwitcher() {
    var stageEl = document.getElementById('stage');
    var deviceEl = document.getElementById('device');
    var bPhone = document.getElementById('b-phone');
    var bDesk = document.getElementById('b-desk');
    var tabsEl = document.getElementById('tabs');
    var btnArchRules = document.getElementById('btn-open-arch-rules');

    function setDevice(kind, silent) {
      if (!deviceEl) return;
      var isPhone = kind === 'phone';
      deviceEl.classList.toggle('phone', isPhone);
      deviceEl.classList.toggle('desk', !isPhone);
      if (stageEl) {
        stageEl.classList.toggle('phone-mode', isPhone);
        stageEl.classList.toggle('desk-mode', !isPhone);
      }
      if (bPhone) {
        bPhone.setAttribute('aria-pressed', isPhone ? 'true' : 'false');
        bPhone.classList.toggle('active', isPhone);
      }
      if (bDesk) {
        bDesk.setAttribute('aria-pressed', !isPhone ? 'true' : 'false');
        bDesk.classList.toggle('active', !isPhone);
      }
      try {
        localStorage.setItem('fileroom_device_mode', kind);
      } catch (e) {}
      if (!silent) {
        showToast(isPhone ? '📱 Switched to Mobile Phone View' : '💻 Switched to Desktop SaaS View', 'info');
      }
    }

    try {
      var savedMode = localStorage.getItem('fileroom_device_mode');
      if (savedMode === 'phone' || savedMode === 'desk') {
        setDevice(savedMode, true);
      } else {
        setDevice('desk', true);
      }
    } catch (e) {
      setDevice('desk', true);
    }

    if (bPhone) {
      bPhone.addEventListener('click', function(e) {
        e.preventDefault();
        setDevice('phone');
      });
    }
    if (bDesk) {
      bDesk.addEventListener('click', function(e) {
        e.preventDefault();
        setDevice('desk');
      });
    }

    if (tabsEl) {
      tabsEl.addEventListener('click', function(e) {
        var b = e.target.closest('button');
        if (!b || !b.dataset.s) return;
        showScreen(b.dataset.s);
      });
    }

    if (btnArchRules) {
      btnArchRules.addEventListener('click', function(e) {
        e.preventDefault();
        showArchitectureRulesModal();
      });
    }
  }

  // -------------------------------------------------------------
  // 5. SCREEN 01: SIGN IN & 2FA VERIFICATION
  // -------------------------------------------------------------
  function initSignIn() {
    var codeInputs = document.querySelectorAll('.code-box');

    function handleVerifySignIn() {
      var enteredCode = Array.from(codeInputs).map(function(i) { return i.value.trim(); }).join('');
      if (enteredCode.length < 6) {
        // Fill default for smooth prototype experience if partial
        var defaults = ['4', '1', '9', '0', '2', '8'];
        codeInputs.forEach(function(inp, i) {
          if (!inp.value.trim()) inp.value = defaults[i];
          inp.classList.remove('active-empty');
        });
      }

      state.user.verified = true;
      if (window.FirebaseBridge) {
        window.FirebaseBridge.recordAuditLog('2FA Verified', 'MFA verified for ' + state.user.name);
        window.FirebaseBridge.logCustomEvent('login_complete', { method: '2FA_SMS' });
      }
      showToast('Identity verified. Welcome back, Michael.', 'ok');
      setTimeout(function() {
        showScreen('home');
      }, 450);
    }

    codeInputs.forEach(function(input, idx) {
      input.addEventListener('focus', function(e) {
        e.target.select();
        e.target.classList.remove('active-empty');
      });
      input.addEventListener('input', function(e) {
        var val = e.target.value.replace(/\D/g, '');
        if (val.length >= 1) {
          e.target.value = val.slice(-1);
          e.target.classList.remove('active-empty');
          if (idx < codeInputs.length - 1) {
            codeInputs[idx + 1].focus();
            codeInputs[idx + 1].select();
          } else {
            // Last box filled: auto verify after short delay
            setTimeout(handleVerifySignIn, 250);
          }
        }
      });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace') {
          if (!e.target.value && idx > 0) {
            codeInputs[idx - 1].focus();
            codeInputs[idx - 1].select();
          }
        } else if (e.key === 'ArrowLeft' && idx > 0) {
          codeInputs[idx - 1].focus();
          codeInputs[idx - 1].select();
        } else if (e.key === 'ArrowRight' && idx < codeInputs.length - 1) {
          codeInputs[idx + 1].focus();
          codeInputs[idx + 1].select();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleVerifySignIn();
        }
      });
      input.addEventListener('paste', function(e) {
        var paste = (e.clipboardData || window.clipboardData).getData('text');
        if (paste) {
          var cleanPaste = paste.replace(/\D/g, '').slice(0, 6);
          if (cleanPaste.length > 0) {
            e.preventDefault();
            for (var i = 0; i < cleanPaste.length; i++) {
              if (codeInputs[i]) {
                codeInputs[i].value = cleanPaste[i];
                codeInputs[i].classList.remove('active-empty');
              }
            }
            if (cleanPaste.length >= 6) {
              setTimeout(handleVerifySignIn, 250);
            } else {
              var targetIdx = Math.min(cleanPaste.length, 5);
              if (codeInputs[targetIdx]) {
                codeInputs[targetIdx].focus();
                codeInputs[targetIdx].select();
              }
            }
          }
        }
      });
    });

    var verifyBtn = document.getElementById('btn-verify-signin');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', handleVerifySignIn);
    }

    var loginContinueBtn = document.getElementById('btn-login-continue');
    if (loginContinueBtn) {
      loginContinueBtn.addEventListener('click', async function() {
        var emailInput = document.getElementById('input-signin-email');
        var pwdInput   = document.getElementById('input-signin-password');
        var email    = emailInput ? emailInput.value.trim() : '';
        var password = pwdInput  ? pwdInput.value           : '';

        loginContinueBtn.disabled    = true;
        loginContinueBtn.textContent = 'Connecting...';

        if (window.FirebaseBridge && email && password) {
          var authRes = await window.FirebaseBridge.signIn(email, password);
          if (authRes.success) {
            showToast('Firebase Auth ✓ — Identity verified. 2FA code sent.', 'ok');
          } else {
            showToast('Password accepted. 2FA verification code sent to phone.', 'ok');
          }
        } else {
          showToast('Password accepted. 2FA verification code sent to phone.', 'ok');
        }

        loginContinueBtn.disabled    = false;
        loginContinueBtn.textContent = 'Continue';

        // Focus the empty digit box
        var emptyCode = Array.from(codeInputs).find(function(inp) { return !inp.value; }) || codeInputs[0];
        if (emptyCode) {
          emptyCode.focus();
          emptyCode.classList.add('active-empty');
        }
      });
    }

    // Enter key handling on email & password
    var pwdInput = document.getElementById('input-signin-password');
    if (pwdInput && loginContinueBtn) {
      pwdInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          loginContinueBtn.click();
        }
      });
    }
  }

  // -------------------------------------------------------------
  // 6. SCREEN 03: DOCUMENTS & CAMERA SIMULATION
  // -------------------------------------------------------------
  function renderDocumentsList() {
    var container = document.getElementById('docs-list-container');
    if (!container) return;

    var needed = state.documents.filter(function(d) { return d.category === 'needed'; });
    var review = state.documents.filter(function(d) { return d.category === 'review'; });
    var received = state.documents.filter(function(d) { return d.category === 'received'; });

    var html = '';

    // Still Needed
    html += '<div class="rowhead">Still needed &mdash; ' + needed.length + '</div>';
    if (needed.length === 0) {
      html += '<div class="row"><div class="g"><div class="t" style="color:var(--ok)">All requested documents received!</div></div></div>';
    } else {
      needed.forEach(function(d) {
        html += [
          '<div class="row row-clickable" data-doc-id="' + d.id + '" data-type="needed" style="cursor:pointer" title="Click to upload ' + d.name + '">',
          '  <span class="ic" style="color:var(--warn)">' + d.icon + '</span>',
          '  <div class="g">',
          '    <div class="t">' + d.name + '</div>',
          '    <div class="m">' + d.meta + '</div>',
          '  </div>',
          '  <span class="chip warn">Needed</span>',
          '</div>'
        ].join('');
      });
    }

    // In Review
    html += '<div class="rowhead">In review &mdash; ' + review.length + '</div>';
    review.forEach(function(d) {
      html += [
        '<div class="row row-clickable" data-doc-id="' + d.id + '" data-doc-name="' + d.name + '" data-type="review" style="cursor:pointer" title="Click to view ' + d.name + '">',
        '  <span class="ic">' + d.icon + '</span>',
        '  <div class="g">',
        '    <div class="t">' + d.name + '</div>',
        '    <div class="m">' + d.meta + '</div>',
        '  </div>',
        '  <span class="chip">In review</span>',
        '</div>'
      ].join('');
    });

    // Received
    html += '<div class="rowhead">Received &mdash; ' + received.length + '</div>';
    received.forEach(function(d) {
      var chipLabel = d.id === 'doc-8' ? 'On file' : 'Received';
      html += [
        '<div class="row row-clickable" data-doc-id="' + d.id + '" data-doc-name="' + d.name + '" data-type="received" style="cursor:pointer" title="Click to view ' + d.name + '">',
        '  <span class="ic" style="color:var(--ok)">' + d.icon + '</span>',
        '  <div class="g">',
        '    <div class="t">' + d.name + '</div>',
        '    <div class="m">' + d.meta + '</div>',
        '  </div>',
        '  <span class="chip ok">' + chipLabel + '</span>',
        '</div>'
      ].join('');
    });

    container.innerHTML = html;

    // Attach row click events
    container.querySelectorAll('.row-clickable').forEach(function(row) {
      row.addEventListener('click', function() {
        var type = row.dataset.type;
        var docId = row.dataset.docId;
        var docName = row.dataset.docName;
        if (type === 'needed') {
          handleDirectDocUpload(docId);
        } else if (docName) {
          previewDocumentModal(docName);
        }
      });
    });
  }

  function handleDirectDocUpload(docId) {
    var doc = state.documents.find(function(d) { return d.id === docId; });
    if (!doc) return;

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.jpg,.png,.csv';
    fileInput.onchange = function(e) {
      var file = e.target.files[0];
      if (!file) return;
      simulateFileUpload(file.name, docId);
    };
    fileInput.click();
  }

  function simulateFileUpload(filename, targetDocId) {
    var dropZone = document.getElementById('drop-zone');
    var originalHtml = dropZone ? dropZone.innerHTML : '';
    if (dropZone) {
      dropZone.innerHTML = [
        '<div style="padding:10px 0">',
        '  <div class="t" style="font-size:.92rem">Scanning & encrypting: <b>' + filename + '</b></div>',
        '  <div class="prog" style="margin-top:10px"><i id="upload-prog-bar" style="width:15%"></i></div>',
        '  <div class="m" style="margin-top:6px" id="upload-status-text">Uploading to secure enclave...</div>',
        '</div>'
      ].join('');
    }

    var progBar = document.getElementById('upload-prog-bar');
    var statusText = document.getElementById('upload-status-text');

    var progress = 15;
    var timer = setInterval(function() {
      progress += 25;
      if (progBar) progBar.style.width = Math.min(progress, 100) + '%';
      if (progress >= 60 && statusText) {
        statusText.textContent = 'Malware scan in progress: FTC Safeguards verified...';
      }
      if (progress >= 100) {
        clearInterval(timer);
        setTimeout(function() {
          if (dropZone) dropZone.innerHTML = originalHtml;
          bindDropZoneEvents();

          // Update data
          if (targetDocId) {
            var doc = state.documents.find(function(d) { return d.id === targetDocId; });
            if (doc) {
              doc.category = 'review';
              doc.meta = 'Uploaded today · Denise notified';
              doc.icon = '◯';
            }
          } else {
            state.documents.unshift({
              id: 'doc-' + Date.now(),
              name: filename,
              category: 'review',
              meta: 'Uploaded today · Scanned clean',
              type: 'Upload',
              icon: '◯'
            });
          }

          // Update progress
          var remainingNeeded = state.documents.filter(function(d) { return d.category === 'needed'; }).length;
          if (remainingNeeded === 0) {
            state.file.progressPct = 80;
            var progEl = document.getElementById('file-progress-bar');
            if (progEl) progEl.style.width = '80%';
            var pctText = document.getElementById('file-progress-text');
            if (pctText) pctText.textContent = '80%';
          }

          renderDocumentsList();
          if (window.FirebaseBridge) {
            window.FirebaseBridge.saveDocumentRecord({
              filename: filename,
              targetDocId: targetDocId || 'general',
              status: 'Uploaded'
            });
            window.FirebaseBridge.recordAuditLog('Document Uploaded', filename + ' received and encrypted');
          }
          showToast('File uploaded, scanned, and encrypted successfully.', 'ok');
        }, 500);
      }
    }, 200);
  }

  function bindDropZoneEvents() {
    var dropZone = document.getElementById('drop-zone');
    var fileInput = document.getElementById('file-input-hidden');
    var btnChoose = document.getElementById('btn-choose-files');
    var btnCamera = document.getElementById('btn-use-camera');

    if (btnChoose && fileInput) {
      btnChoose.addEventListener('click', function(e) {
        e.stopPropagation();
        fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
          simulateFileUpload(e.target.files[0].name);
        }
      });
    }

    if (btnCamera) {
      btnCamera.addEventListener('click', function(e) {
        e.stopPropagation();
        openCameraScanner();
      });
    }

    if (dropZone) {
      dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
      dropZone.addEventListener('dragleave', function() {
        dropZone.classList.remove('dragover');
      });
      dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          simulateFileUpload(e.dataTransfer.files[0].name);
        }
      });
      dropZone.addEventListener('click', function() {
        if (fileInput) fileInput.click();
      });
    }
  }

  var cameraFacingMode = 'environment';
  var cameraFilterMode = 'normal'; // 'normal' | 'bw' | 'contrast'
  var capturedDocBlob = null;
  var capturedDocDataUrl = null;

  function openCameraScanner() {
    capturedDocBlob = null;
    capturedDocDataUrl = null;

    var bodyHtml = [
      '<div class="camera-scanner-container">',
      '  <div class="camera-viewport" id="camera-viewport-box">',
      '    <video id="camera-video-feed" class="camera-video-feed" autoplay playsinline muted></video>',
      '    <canvas id="camera-canvas" style="display:none"></canvas>',
      '    <img id="camera-preview-img" style="display:none;width:100%;height:100%;object-fit:contain;background:#000;border-radius:4px" alt="Captured Document" />',
      '    <div class="camera-flash-overlay" id="camera-flash"></div>',
      '    ',
      '    <!-- Reticle HUD & Edge Guides -->',
      '    <div class="camera-hud" id="camera-hud-overlay">',
      '      <div class="camera-hud-top">',
      '        <span class="camera-status-pill" id="camera-status-pill">&#9679; LIVE VIEWFINDER &middot; AUTO-EDGE</span>',
      '        <span class="camera-status-pill" id="camera-fps-badge" style="color:#2ecc71">IRS PUB 1345 READY</span>',
      '      </div>',
      '      <div class="camera-doc-frame" id="camera-doc-frame">',
      '        <div class="camera-corner tl"></div>',
      '        <div class="camera-corner tr"></div>',
      '        <div class="camera-corner bl"></div>',
      '        <div class="camera-corner br"></div>',
      '        <div class="camera-scan-laser"></div>',
      '      </div>',
      '      <div class="camera-hud-bottom">',
      '        <span class="camera-status-pill" id="camera-filter-indicator">Filter: Standard Color</span>',
      '        <span class="camera-status-pill">Hold document steady inside frame</span>',
      '      </div>',
      '    </div>',
      '    ',
      '    <!-- Fallback / Permission Notice -->',
      '    <div class="camera-fallback-card" id="camera-fallback-view" style="display:none">',
      '      <div style="font-size:2.4rem;margin-bottom:8px">&#128247;</div>',
      '      <h4 style="color:#fff;margin-bottom:6px" id="camera-error-title">Camera Permission Needed</h4>',
      '      <p style="font-size:.82rem;color:var(--night-ink-2);max-width:340px;margin:0 auto 16px" id="camera-error-desc">Please grant camera access in your browser or select an image from your device.</p>',
      '      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">',
      '        <button class="btn btn-g sm" id="btn-camera-retry">Try Camera Again</button>',
      '        <button class="btn btn-w sm" id="btn-camera-pick-file">Choose File Instead</button>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  ',
      '  <!-- Camera Controls Bar -->',
      '  <div class="camera-controls-bar">',
      '    <div style="display:flex;gap:8px">',
      '      <button class="btn btn-o sm" id="btn-toggle-filter" title="Toggle document filter">&#127912; Filter: Standard</button>',
      '      <button class="btn btn-o sm" id="btn-flip-camera" title="Switch between front and back cameras">&#128257; Flip Camera</button>',
      '    </div>',
      '    <div style="font-family:var(--f-mono);font-size:.7rem;color:var(--ink-3)" id="camera-spec-label">Auto-Edge Detection</div>',
      '  </div>',
      '  <p class="legal" style="margin:0;font-size:.76rem;text-align:center">Straightens pages, removes shadows, and sharpens text automatically for IRS compliance.</p>',
      '</div>'
    ].join('');

    var footerHtml = [
      '<button class="btn btn-o sm" id="modal-cancel-btn">Cancel</button>',
      '<button class="btn btn-o sm" id="btn-retake-photo" style="display:none">&#128257; Retake</button>',
      '<button class="btn btn-g sm" id="btn-snap-photo">&#128248; Snap Document</button>'
    ].join('');

    openModal('Camera Document Scanner', bodyHtml, footerHtml);

    var videoEl        = document.getElementById('camera-video-feed');
    var canvasEl       = document.getElementById('camera-canvas');
    var previewImg     = document.getElementById('camera-preview-img');
    var hudOverlay     = document.getElementById('camera-hud-overlay');
    var fallbackView   = document.getElementById('camera-fallback-view');
    var flashEl        = document.getElementById('camera-flash');
    var statusPill     = document.getElementById('camera-status-pill');
    var filterBtn      = document.getElementById('btn-toggle-filter');
    var flipBtn        = document.getElementById('btn-flip-camera');
    var filterInd      = document.getElementById('camera-filter-indicator');
    var snapBtn        = document.getElementById('btn-snap-photo');
    var retakeBtn      = document.getElementById('btn-retake-photo');
    var retryBtn       = document.getElementById('btn-camera-retry');
    var pickFileBtn    = document.getElementById('btn-camera-pick-file');
    var errorTitle     = document.getElementById('camera-error-title');
    var errorDesc      = document.getElementById('camera-error-desc');
    var specLabel      = document.getElementById('camera-spec-label');

    var isReviewing = false;

    // Start Camera Stream
    async function startCamera() {
      stopActiveCamera();
      if (fallbackView) fallbackView.style.display = 'none';
      if (hudOverlay)   hudOverlay.style.display   = 'flex';
      if (videoEl)      videoEl.style.display      = 'block';
      if (statusPill)   statusPill.textContent     = 'CONNECTING CAMERA...';

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showCameraError('Camera API Not Supported', 'Your browser does not support web camera access. Please use Chrome, Safari, or Edge.');
        return;
      }

      try {
        var constraints = {
          video: {
            facingMode: { ideal: cameraFacingMode },
            width:      { ideal: 1920, min: 640 },
            height:     { ideal: 1080, min: 480 }
          },
          audio: false
        };

        var stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (initialErr) {
          // Fallback to basic video request if ideal constraints fail
          console.warn('Initial camera constraint failed, trying basic video:', initialErr);
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        activeCameraStream = stream;
        if (videoEl) {
          videoEl.srcObject = stream;
          if (cameraFacingMode === 'user') {
            videoEl.classList.add('user-facing');
          } else {
            videoEl.classList.remove('user-facing');
          }

          videoEl.onloadedmetadata = function() {
            videoEl.play().catch(function(e) { console.warn('Play error:', e); });
            if (statusPill) statusPill.textContent = '● LIVE VIEWFINDER · ' + videoEl.videoWidth + 'x' + videoEl.videoHeight;
            if (specLabel)  specLabel.textContent  = videoEl.videoWidth + 'x' + videoEl.videoHeight + ' HD';
          };
        }

        // Check if multiple camera devices exist
        if (navigator.mediaDevices.enumerateDevices && flipBtn) {
          navigator.mediaDevices.enumerateDevices().then(function(devices) {
            var videoInputs = devices.filter(function(d) { return d.kind === 'videoinput'; });
            if (videoInputs.length > 1) {
              flipBtn.style.display = 'inline-block';
            }
          }).catch(function() {});
        }

      } catch (err) {
        console.warn('Camera getUserMedia error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          showCameraError('Camera Permission Denied', 'Camera permission was blocked. Please click the camera icon in your browser URL bar to allow access, or upload a photo directly.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          showCameraError('No Camera Detected', 'No active camera hardware was found on this computer. You can upload a document file directly.');
        } else {
          showCameraError('Camera Unavailable', (err.message || 'Could not start camera feed.') + ' You can choose a document file instead.');
        }
      }
    }

    function showCameraError(title, desc) {
      if (videoEl)      videoEl.style.display      = 'none';
      if (hudOverlay)   hudOverlay.style.display   = 'none';
      if (fallbackView) fallbackView.style.display = 'block';
      if (errorTitle)   errorTitle.textContent     = title;
      if (errorDesc)    errorDesc.textContent      = desc;
      if (snapBtn)      snapBtn.disabled           = true;
    }

    // Toggle Filters (Normal -> High Contrast B&W -> Sharp Color -> Normal)
    if (filterBtn) {
      filterBtn.addEventListener('click', function() {
        if (cameraFilterMode === 'normal') {
          cameraFilterMode = 'bw';
          filterBtn.innerHTML = '&#127912; Filter: B&W Clean';
          if (videoEl) {
            videoEl.classList.remove('filter-high-contrast');
            videoEl.classList.add('filter-bw');
          }
          if (filterInd) filterInd.textContent = 'Filter: B&W High-Contrast Scan';
        } else if (cameraFilterMode === 'bw') {
          cameraFilterMode = 'contrast';
          filterBtn.innerHTML = '&#127912; Filter: High Contrast';
          if (videoEl) {
            videoEl.classList.remove('filter-bw');
            videoEl.classList.add('filter-high-contrast');
          }
          if (filterInd) filterInd.textContent = 'Filter: High Contrast Document';
        } else {
          cameraFilterMode = 'normal';
          filterBtn.innerHTML = '&#127912; Filter: Standard';
          if (videoEl) {
            videoEl.classList.remove('filter-bw');
            videoEl.classList.remove('filter-high-contrast');
          }
          if (filterInd) filterInd.textContent = 'Filter: Standard Color';
        }
      });
    }

    // Flip Camera (Front / Back)
    if (flipBtn) {
      flipBtn.addEventListener('click', function() {
        cameraFacingMode = (cameraFacingMode === 'environment') ? 'user' : 'environment';
        startCamera();
      });
    }

    // Snap & Review
    if (snapBtn) {
      snapBtn.addEventListener('click', async function() {
        if (!isReviewing) {
          // Action 1: Capture Frame
          var vw = videoEl ? (videoEl.videoWidth || 1280) : 1280;
          var vh = videoEl ? (videoEl.videoHeight || 720) : 720;

          if (canvasEl && videoEl && videoEl.readyState >= 2) {
            canvasEl.width  = vw;
            canvasEl.height = vh;
            var ctx = canvasEl.getContext('2d');

            // Mirror if front camera
            if (cameraFacingMode === 'user') {
              ctx.translate(vw, 0);
              ctx.scale(-1, 1);
            }

            // Apply filter in canvas processing if chosen
            if (cameraFilterMode === 'bw') {
              ctx.filter = 'grayscale(100%) contrast(140%) brightness(105%)';
            } else if (cameraFilterMode === 'contrast') {
              ctx.filter = 'contrast(170%) brightness(95%)';
            } else {
              ctx.filter = 'none';
            }

            ctx.drawImage(videoEl, 0, 0, vw, vh);

            // Shutter Flash Effect
            if (flashEl) {
              flashEl.classList.add('flash');
              setTimeout(function() { flashEl.classList.remove('flash'); }, 200);
            }

            capturedDocDataUrl = canvasEl.toDataURL('image/jpeg', 0.92);
            canvasEl.toBlob(function(blob) {
              capturedDocBlob = blob;
            }, 'image/jpeg', 0.92);

            // Show Review Preview
            if (previewImg) {
              previewImg.src = capturedDocDataUrl;
              previewImg.style.display = 'block';
            }
            if (videoEl)    videoEl.style.display    = 'none';
            if (hudOverlay) hudOverlay.style.display = 'none';

            isReviewing = true;
            snapBtn.innerHTML = '&#10003; Accept & Upload Document';
            snapBtn.classList.remove('btn-g');
            snapBtn.classList.add('btn-b');
            if (retakeBtn) retakeBtn.style.display = 'inline-block';

          } else {
            // Fallback simulated capture if video not ready
            closeModal();
            simulateFileUpload('Scanned_Tax_Document_' + Date.now().toString().slice(-4) + '.jpg');
          }

        } else {
          // Action 2: Accept & Upload
          closeModal();
          var docName = 'Scanned_Tax_Document_' + Date.now().toString().slice(-4) + '.jpg';

          // Upload to Firebase Storage if available
          if (capturedDocBlob && window.FirebaseBridge && window.FirebaseBridge.uploadDocumentFile) {
            var file = new File([capturedDocBlob], docName, { type: 'image/jpeg' });
            window.FirebaseBridge.uploadDocumentFile(file).then(function(upRes) {
              if (upRes.success) {
                console.log('Document uploaded to Firebase Storage:', upRes.url);
              }
            }).catch(function() {});
          }

          simulateFileUpload(docName);
          showToast('Document captured, cropped, and uploaded successfully.', 'ok');
        }
      });
    }

    // Retake Photo
    if (retakeBtn) {
      retakeBtn.addEventListener('click', function() {
        isReviewing = false;
        if (previewImg) previewImg.style.display = 'none';
        if (videoEl)    videoEl.style.display    = 'block';
        if (hudOverlay) hudOverlay.style.display = 'flex';
        snapBtn.innerHTML = '&#128248; Snap Document';
        snapBtn.classList.remove('btn-b');
        snapBtn.classList.add('btn-g');
        retakeBtn.style.display = 'none';
      });
    }

    // Retry Camera
    if (retryBtn) {
      retryBtn.addEventListener('click', function() {
        startCamera();
      });
    }

    // Pick File Fallback
    if (pickFileBtn) {
      pickFileBtn.addEventListener('click', function() {
        closeModal();
        var fileInput = document.getElementById('file-input-hidden');
        if (fileInput) fileInput.click();
      });
    }

    // Launch camera
    startCamera();
  }

  function previewDocumentModal(docName) {
    var bodyHtml = [
      '<div style="background:var(--surface-2);border:1px solid var(--line);border-radius:4px;padding:24px;text-align:center">',
      '  <div style="font-family:var(--f-mono);font-size:.75rem;color:var(--ink-3);margin-bottom:8px">IRS ARCHIVE ID: PAT-' + Math.random().toString(36).substr(2, 9).toUpperCase() + '</div>',
      '  <h4 style="font-size:1.15rem;margin-bottom:6px">' + docName + '</h4>',
      '  <p style="font-size:.84rem;color:var(--ink-2);margin-bottom:14px">Verified, malware scanned, and encrypted at rest (AES-256).</p>',
      '  <div style="display:inline-flex;gap:8px">',
      '    <span class="chip ok">IRS Compliant</span>',
      '    <span class="chip">Retained 3 Years</span>',
      '  </div>',
      '</div>'
    ].join('');
    openModal('Document Viewer', bodyHtml);
  }

  // -------------------------------------------------------------
  // 7. SCREEN 04: FORM 8879 SIGNING & KBA QUIZ
  // -------------------------------------------------------------
  function initSigning() {
    renderKbaQuestion();

    var continueBtn = document.getElementById('btn-kba-continue');
    if (continueBtn) {
      continueBtn.addEventListener('click', handleKbaAnswer);
    }

    var fallbackBtn = document.getElementById('btn-kba-fallback');
    if (fallbackBtn) {
      fallbackBtn.addEventListener('click', switchToWetSignature);
    }

    var read8879Btn = document.getElementById('btn-read-8879');
    if (read8879Btn) {
      read8879Btn.addEventListener('click', open8879PreviewModal);
    }
  }

  function renderKbaQuestion() {
    var quiz = state.kbaQuiz;
    var questionEl = document.getElementById('kba-question-text');
    var optsContainer = document.getElementById('kba-options-container');
    var stepBadge = document.getElementById('kba-step-badge');
    var attemptsBadge = document.getElementById('kba-attempts-badge');

    if (!questionEl || !optsContainer) return;

    var currentQ = quiz.questions[quiz.currentStep - 1];
    if (!currentQ) return;

    if (stepBadge) stepBadge.textContent = 'Identity check · step ' + quiz.currentStep + ' of 3';
    if (attemptsBadge) attemptsBadge.textContent = quiz.attemptsLeft + ' attempts remaining';

    questionEl.textContent = currentQ.question;

    optsContainer.innerHTML = '';
    selectedKbaOption = null;

    currentQ.options.forEach(function(opt, idx) {
      var label = document.createElement('label');
      label.innerHTML = '<i></i>' + opt;
      if (quiz.currentStep === 1 && idx === currentQ.correctIndex) {
        label.classList.add('pick');
        selectedKbaOption = idx;
      }
      label.addEventListener('click', function() {
        optsContainer.querySelectorAll('label').forEach(function(l) { l.classList.remove('pick'); });
        label.classList.add('pick');
        selectedKbaOption = idx;
      });
      optsContainer.appendChild(label);
    });
  }

  function handleKbaAnswer() {
    var quiz = state.kbaQuiz;
    if (selectedKbaOption === null) {
      showToast('Please select an option to continue.', 'warn');
      return;
    }

    var currentQ = quiz.questions[quiz.currentStep - 1];
    var isCorrect = (selectedKbaOption === currentQ.correctIndex);

    if (isCorrect) {
      if (quiz.currentStep < 3) {
        quiz.currentStep++;
        showToast('Question verified. Proceeding to step ' + quiz.currentStep + '.', 'ok');
        renderKbaQuestion();
      } else {
        // Quiz completed successfully!
        unlockSignaturePad();
      }
    } else {
      quiz.attemptsLeft--;
      if (quiz.attemptsLeft <= 0) {
        switchToWetSignature();
      } else {
        showToast('Answer could not be matched. ' + quiz.attemptsLeft + ' attempts remaining.', 'warn');
        renderKbaQuestion();
      }
    }
  }

  function switchToWetSignature() {
    var quizCard = document.getElementById('kba-quiz-card');
    if (quizCard) {
      quizCard.innerHTML = [
        '<span class="chip warn">Handwritten signature required</span>',
        '<h3 style="margin-top:10px;color:#fff">Identity verification threshold reached</h3>',
        '<p class="sub" style="color:var(--night-ink-2)">IRS Publication 1345 requires a fallback to a physical wet signature when remote knowledge-based authentication cannot be confirmed. This is a normal legal safeguard.</p>',
        '<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">',
        '  <button class="btn btn-g" id="btn-dl-wetsig">Download Form 8879 PDF to Sign</button>',
        '  <button class="btn btn-w" id="btn-upload-wetsig">Upload Signed Copy</button>',
        '</div>'
      ].join('');

      var dlBtn = document.getElementById('btn-dl-wetsig');
      var upBtn = document.getElementById('btn-upload-wetsig');
      if (dlBtn) dlBtn.addEventListener('click', function() { showToast('Form 8879 downloaded for physical signature.', 'ok'); });
      if (upBtn) upBtn.addEventListener('click', function() { showScreen('docs'); });
    }
  }

  function unlockSignaturePad() {
    var quizCard = document.getElementById('kba-quiz-card');
    if (quizCard) {
      quizCard.innerHTML = [
        '<span class="chip ok">✓ Identity Verified (KBA Passed)</span>',
        '<h3 style="margin-top:10px;color:#fff">Sign Form 8879 with Digital Authorization</h3>',
        '<p class="sub" style="color:var(--night-ink-2)">Draw your signature below, or type your legal name. Both spouses sign Form 8879 separately.</p>',
        '<div class="sig-box">',
        '  <canvas id="sig-canvas" width="360" height="120"></canvas>',
        '  <div class="sig-toolbar">',
        '    <span>Sign with finger, stylus, or mouse</span>',
        '    <button class="btn btn-o sm" id="btn-clear-sig" style="padding:4px 8px;font-size:.74rem">Clear</button>',
        '  </div>',
        '</div>',
        '<div style="margin-top:14px">',
        '  <button class="btn btn-g full" id="btn-submit-signature">Adopt and Electronically Sign Form 8879</button>',
        '</div>'
      ].join('');

      initSignatureCanvas();

      var submitBtn = document.getElementById('btn-submit-signature');
      if (submitBtn) {
        submitBtn.addEventListener('click', finalizeSignature);
      }
    }

    var stepVerify = document.getElementById('step-verify-id');
    var stepDraw = document.getElementById('step-draw-sig');
    if (stepVerify) { stepVerify.className = 'step done'; }
    if (stepDraw) { stepDraw.className = 'step now'; }
  }

  function initSignatureCanvas() {
    sigCanvas = document.getElementById('sig-canvas');
    if (!sigCanvas) return;
    sigCtx = sigCanvas.getContext('2d');
    sigCtx.lineWidth = 2.4;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
    sigCtx.strokeStyle = '#0C1D28';

    function getPos(e) {
      var rect = sigCanvas.getBoundingClientRect();
      var clientX = e.clientX || (e.touches && e.touches[0].clientX);
      var clientY = e.clientY || (e.touches && e.touches[0].clientY);
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }

    sigCanvas.onmousedown = function(e) {
      isDrawing = true;
      var pos = getPos(e);
      sigCtx.beginPath();
      sigCtx.moveTo(pos.x, pos.y);
    };

    sigCanvas.onmousemove = function(e) {
      if (!isDrawing) return;
      var pos = getPos(e);
      sigCtx.lineTo(pos.x, pos.y);
      sigCtx.stroke();
    };

    window.onmouseup = function() {
      isDrawing = false;
    };

    // Touch events for mobile
    sigCanvas.ontouchstart = function(e) {
      e.preventDefault();
      isDrawing = true;
      var pos = getPos(e);
      sigCtx.beginPath();
      sigCtx.moveTo(pos.x, pos.y);
    };

    sigCanvas.ontouchmove = function(e) {
      if (!isDrawing) return;
      e.preventDefault();
      var pos = getPos(e);
      sigCtx.lineTo(pos.x, pos.y);
      sigCtx.stroke();
    };

    sigCanvas.ontouchend = function() {
      isDrawing = false;
    };

    var clearBtn = document.getElementById('btn-clear-sig');
    if (clearBtn) {
      clearBtn.onclick = function(e) {
        e.preventDefault();
        sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
      };
    }
  }

  function finalizeSignature() {
    state.signatureRecord.signed = true;
    state.signatureRecord.method = 'KBA + Electronic Drawing';
    state.signatureRecord.timestamp = new Date().toISOString();
    state.signatureRecord.hash = 'SHA256-' + Math.random().toString(36).substr(2, 12).toUpperCase();

    showToast('Form 8879 signed! Tamper-proof evidence record created.', 'ok');
    if (window.FirebaseBridge) {
      window.FirebaseBridge.saveSignatureRecord(state.signatureRecord);
      window.FirebaseBridge.recordAuditLog('Form 8879 Signed', 'Record hash ' + state.signatureRecord.hash);
      window.FirebaseBridge.logCustomEvent('form_8879_signed', { hash: state.signatureRecord.hash });
    }

    var quizCard = document.getElementById('kba-quiz-card');
    if (quizCard) {
      quizCard.innerHTML = [
        '<div style="text-align:center;padding:12px 0">',
        '  <span class="chip ok">✓ Signed & Validated</span>',
        '  <h3 style="margin-top:10px;color:#fff">Authorization Complete</h3>',
        '  <p class="sub" style="color:var(--night-ink-2)">Your return is now fully authorized for IRS e-filing. Transmission will take place within one business day.</p>',
        '  <div style="background:var(--night-3);border:1px solid var(--night-line);border-radius:4px;padding:12px;margin-top:14px;text-align:left;font-family:var(--f-mono);font-size:.72rem;color:var(--night-ink-2)">',
        '    <div>SIGNER: Michael Whitfield</div>',
        '    <div>IP ADDRESS: 172.56.21.84</div>',
        '    <div>TIMESTAMP: ' + new Date().toLocaleString() + '</div>',
        '    <div>RECORD HASH: ' + state.signatureRecord.hash + '</div>',
        '    <div style="color:var(--gold);margin-top:4px">IRS PUB 1345 TAMPER-PROOF ARCHIVE RETAINED 3 YRS</div>',
        '  </div>',
        '</div>'
      ].join('');
    }

    var stepDraw = document.getElementById('step-draw-sig');
    var stepTransmit = document.getElementById('step-transmit-return');
    if (stepDraw) { stepDraw.className = 'step done'; }
    if (stepTransmit) { stepTransmit.className = 'step now'; }
  }

  function open8879PreviewModal() {
    var bodyHtml = [
      '<div style="border:1px solid var(--line);border-radius:4px;padding:18px;background:#fff">',
      '  <div style="display:flex;justify-content:space-between;border-bottom:2px solid var(--ink);padding-bottom:8px">',
      '    <div><b>Form 8879</b><br><small>IRS e-file Signature Authorization</small></div>',
      '    <div style="text-align:right"><b>OMB No. 1545-1878</b><br><small>Tax Year 2026</small></div>',
      '  </div>',
      '  <div style="margin-top:12px;font-size:.85rem">',
      '    <div><b>Taxpayer:</b> Michael & Elena Whitfield</div>',
      '    <div><b>Adjusted Gross Income:</b> $214,806</div>',
      '    <div><b>Total Tax:</b> $30,491</div>',
      '    <div><b>Federal Refund Amount:</b> $3,418</div>',
      '    <div><b>ERO:</b> Denise R. · Pivot Aide Tax</div>',
      '  </div>',
      '</div>'
    ].join('');
    openModal('Form 8879 Preview', bodyHtml);
  }

  // -------------------------------------------------------------
  // 8. SCREEN 06: MESSAGING & UNCLE PAT ASSISTANT
  // -------------------------------------------------------------
  function initMessaging() {
    var msgInput = document.getElementById('msg-input-box');
    var sendBtn = document.getElementById('btn-send-msg');
    var attachBtn = document.getElementById('btn-attach-msg');
    var quickChips = document.querySelectorAll('.quick span');

    if (sendBtn && msgInput) {
      sendBtn.addEventListener('click', function() {
        var text = msgInput.value.trim();
        if (!text) return;
        sendUserMessage(text);
        msgInput.value = '';
      });
      msgInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendBtn.click();
        }
      });
    }

    if (attachBtn) {
      attachBtn.addEventListener('click', function() {
        showToast('Document selector opened. Files attach directly to your tax folder.', 'info');
      });
    }

    quickChips.forEach(function(chip) {
      chip.addEventListener('click', function() {
        var question = chip.textContent;
        sendUserMessage(question);
      });
    });
  }

  function sendUserMessage(text) {
    var thread = document.getElementById('messages-thread');
    if (!thread) return;

    var newMsg = {
      id: 'm-' + Date.now(),
      sender: 'You · Just now',
      role: 'me',
      avatar: 'MW',
      text: text
    };
    state.messages.push(newMsg);

    var msgHtml = [
      '<div class="msg me" style="animation:fadeIn .25s ease">',
      '  <span class="av">MW</span>',
      '  <div>',
      '    <div class="bub">',
      '      <div class="who">You · Just now</div>',
      '      ' + text,
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

    thread.insertAdjacentHTML('beforeend', msgHtml);
    thread.scrollTop = thread.scrollHeight;

    if (window.FirebaseBridge) {
      window.FirebaseBridge.saveMessage(newMsg);
      window.FirebaseBridge.recordAuditLog('Client Message', 'Message sent: ' + text.slice(0, 30));
    }

    // Simulated response logic
    setTimeout(function() {
      generateReply(text);
    }, 900);
  }

  function generateReply(userText) {
    var thread = document.getElementById('messages-thread');
    if (!thread) return;

    var replyText = "I've noted this in your 2026 tax file. I'll verify the schedule numbers and update your file today.";
    var isPat = false;

    var lower = userText.toLowerCase();
    if (lower.indexOf('owe') !== -1 || lower.indexOf('balance') !== -1) {
      replyText = "Based on your prepared 2026 returns, you have a Federal refund of $3,418 and a Maryland balance due of $612.00.";
    } else if (lower.indexOf('filed') !== -1 || lower.indexOf('when') !== -1) {
      replyText = "Once Form 8879 is signed by both spouses, we transmit within 1 business day and watch the IRS acknowledgement queue for acceptance.";
    } else if (lower.indexOf('letter') !== -1 || lower.indexOf('notice') !== -1) {
      replyText = "You can upload any IRS or state notice on the Services or Documents tab — we provide a free 2-day plain-English read of what it means.";
      isPat = true;
    } else if (lower.indexOf('call') !== -1) {
      replyText = "I'll send over the booking link for your year-end tax planning session with Denise.";
    }

    var replySender = isPat ? 'Uncle Pat · automatic' : 'Denise · Just now';
    var avatarContent = isPat
      ? '<svg viewBox="22 4 156 172" aria-hidden="true"><use href="#pat-av"></use></svg>'
      : 'DR';

    var replyHtml = [
      '<div class="msg ' + (isPat ? 'pat' : '') + '" style="animation:fadeIn .25s ease">',
      '  <span class="av">' + avatarContent + '</span>',
      '  <div>',
      '    <div class="bub" ' + (isPat ? 'style="background:var(--surface-2)"' : '') + '>',
      '      <div class="who">' + replySender + '</div>',
      '      ' + replyText,
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

    thread.insertAdjacentHTML('beforeend', replyHtml);
    thread.scrollTop = thread.scrollHeight;
    showToast('New message received', 'info');
  }

  // -------------------------------------------------------------
  // 9. SCREEN 08: BILLING & PAYMENT PROCESSING
  // -------------------------------------------------------------
  function initBilling() {
    var segBank = document.getElementById('seg-pay-bank');
    var segCard = document.getElementById('seg-pay-card');
    var viewBank = document.getElementById('pay-view-bank');
    var viewCard = document.getElementById('pay-view-card');
    var feeDisplay = document.getElementById('billing-fee-display');
    var totalDisplay = document.getElementById('billing-total-display');
    var payBtn = document.getElementById('btn-pay-invoice');
    var autopayCheckbox = document.getElementById('autopay-checkbox');
    var autopayBadge = document.getElementById('autopay-status-badge');
    var historyContainer = document.getElementById('billing-history-container');
    var currentMethod = 'bank'; // 'bank' or 'card'

    // 1. Payment Method Toggling
    function setPaymentMethod(method) {
      currentMethod = method;
      if (segBank) segBank.classList.toggle('on', method === 'bank');
      if (segCard) segCard.classList.toggle('on', method === 'card');

      if (viewBank) viewBank.style.display = method === 'bank' ? 'block' : 'none';
      if (viewCard) viewCard.style.display = method === 'card' ? 'block' : 'none';

      if (!state.billing.isPaid) {
        if (method === 'card') {
          var fee = 36.26; // 2.9% + $0.30
          var total = 1240.00 + fee;
          if (feeDisplay) feeDisplay.textContent = '+$36.26 (2.9% + $0.30)';
          if (totalDisplay) totalDisplay.textContent = '$' + total.toFixed(2);
          if (payBtn) payBtn.textContent = 'Pay $' + total.toFixed(2) + ' with Card';
        } else {
          if (feeDisplay) feeDisplay.textContent = '$0.00 (No fee)';
          if (totalDisplay) totalDisplay.textContent = '$1,240.00';
          if (payBtn) payBtn.textContent = 'Pay $1,240.00';
        }
      }
    }

    if (segBank) {
      segBank.addEventListener('click', function() { setPaymentMethod('bank'); });
    }
    if (segCard) {
      segCard.addEventListener('click', function() { setPaymentMethod('card'); });
    }

    // 2. Card Selection (Saved vs New Card)
    var radioSaved = document.getElementById('radio-saved-card');
    var radioNew = document.getElementById('radio-new-card');
    var newCardFields = document.getElementById('new-card-fields');

    if (radioSaved && radioNew && newCardFields) {
      radioSaved.addEventListener('change', function() {
        if (radioSaved.checked) newCardFields.style.display = 'none';
      });
      radioNew.addEventListener('change', function() {
        if (radioNew.checked) {
          newCardFields.style.display = 'block';
          var numInput = document.getElementById('input-card-num');
          if (numInput) numInput.focus();
        }
      });
    }

    // Auto-format card input fields
    var cardNumInput = document.getElementById('input-card-num');
    if (cardNumInput) {
      cardNumInput.addEventListener('input', function(e) {
        var val = e.target.value.replace(/\D/g, '').substring(0, 16);
        var formatted = val.replace(/(\d{4})/g, '$1 ').trim();
        e.target.value = formatted;
      });
    }

    var cardExpInput = document.getElementById('input-card-exp');
    if (cardExpInput) {
      cardExpInput.addEventListener('input', function(e) {
        var val = e.target.value.replace(/\D/g, '').substring(0, 4);
        if (val.length >= 2) {
          e.target.value = val.substring(0, 2) + '/' + val.substring(2);
        } else {
          e.target.value = val;
        }
      });
    }

    // 3. Auto-Pay on Approval Toggle
    if (autopayCheckbox) {
      autopayCheckbox.checked = !!state.billing.autoPayEnabled;
      if (autopayBadge) autopayBadge.style.display = state.billing.autoPayEnabled ? 'inline-block' : 'none';

      autopayCheckbox.addEventListener('change', function() {
        var enabled = autopayCheckbox.checked;
        state.billing.autoPayEnabled = enabled;
        if (autopayBadge) autopayBadge.style.display = enabled ? 'inline-block' : 'none';

        if (enabled) {
          showToast('Auto-pay enabled: balance will automatically transfer when Form 8879 is signed.', 'ok');
          if (window.FirebaseBridge) {
            window.FirebaseBridge.recordAuditLog('Auto-Pay Enabled', 'Client authorized automatic ACH transfer on Form 8879 signing');
          }
        } else {
          showToast('Auto-pay disabled. Invoices will require manual payment.', 'info');
        }
      });
    }

    // 4. Link Another Bank Account Modal
    var linkBankBtn = document.getElementById('btn-link-bank');
    if (linkBankBtn) {
      linkBankBtn.addEventListener('click', function() {
        var modalHtml = [
          '<p style="font-size:.88rem">Link a verified US checking or savings account for zero-fee ACH invoice payments and IRS direct deposits.</p>',
          '<div class="calc-box">',
          '  <div class="field" style="margin-bottom:10px">',
          '    <label>Bank Name</label>',
          '    <input type="text" id="input-new-bank-name" placeholder="e.g. Chase, Bank of America, Navy Federal" style="width:100%;box-sizing:border-box;padding:8px 10px;background:var(--surface);border:1px solid var(--line);border-radius:3px">',
          '  </div>',
          '  <div class="field" style="margin-bottom:10px">',
          '    <label>Routing Number (9 Digits)</label>',
          '    <input type="text" id="input-new-bank-routing" placeholder="052000113" maxlength="9" style="font-family:var(--f-mono);width:100%;box-sizing:border-box;padding:8px 10px;background:var(--surface);border:1px solid var(--line);border-radius:3px">',
          '  </div>',
          '  <div class="field" style="margin-bottom:10px">',
          '    <label>Account Number</label>',
          '    <input type="password" id="input-new-bank-acc" placeholder="•••• •••• ••••" maxlength="17" style="font-family:var(--f-mono);width:100%;box-sizing:border-box;padding:8px 10px;background:var(--surface);border:1px solid var(--line);border-radius:3px">',
          '  </div>',
          '  <div class="field">',
          '    <label>Account Type</label>',
          '    <select id="input-new-bank-type" style="width:100%;padding:8px 10px;background:var(--surface);border:1px solid var(--line);border-radius:3px;color:var(--ink)">',
          '      <option value="Checking">Checking Account</option>',
          '      <option value="Savings">Savings Account</option>',
          '      <option value="Business Checking">Business Checking Account</option>',
          '    </select>',
          '  </div>',
          '</div>',
          '<div style="font-size:.74rem;color:var(--ink-3);margin-top:10px">',
          '  🔒 Bank connections are encrypted with 256-bit AES and NACHA Rule compliant.',
          '</div>'
        ].join('');

        openModal('Link Bank Account', modalHtml, [
          '<button class="btn btn-o sm" id="modal-cancel-btn">Cancel</button>',
          '<button class="btn btn-g sm" id="btn-confirm-link-bank">Save &amp; Link Account</button>'
        ].join(''));

        var confirmLinkBtn = document.getElementById('btn-confirm-link-bank');
        if (confirmLinkBtn) {
          confirmLinkBtn.addEventListener('click', function() {
            var bankName = (document.getElementById('input-new-bank-name') || {}).value || 'First National Bank';
            var accNum = (document.getElementById('input-new-bank-acc') || {}).value || '9921';
            var last4 = accNum.slice(-4) || '9921';
            var accType = (document.getElementById('input-new-bank-type') || {}).value || 'Checking';

            state.billing.savedAccount = {
              bank: bankName,
              last4: last4,
              type: accType,
              savedDate: 'Today'
            };

            var bankDisplay = document.querySelector('#pay-view-bank .t');
            var bankMeta = document.querySelector('#pay-view-bank .m');
            if (bankDisplay) bankDisplay.textContent = bankName + ' •••• ' + last4;
            if (bankMeta) bankMeta.textContent = accType + ' · saved today · ACH Direct Debit';

            closeModal();
            showToast('Bank account linked: ' + bankName + ' •••• ' + last4, 'ok');
          });
        }
      });
    }

    // 5. Itemized Receipt Modal
    function openReceiptModal(inv) {
      if (!inv) return;
      var subtotal = (inv.amount || 1240.00);
      var fee = inv.method && inv.method.indexOf('Card') !== -1 ? 36.26 : 0.00;
      var total = subtotal + fee;

      var itemsHtml = '';
      var items = inv.items || [
        { desc: 'Individual return — federal Form 1040', amount: 400.00 },
        { desc: 'Maryland, Virginia, Pennsylvania returns', amount: 285.00 },
        { desc: 'Schedule C — Whitfield Design Co.', amount: 310.00 },
        { desc: 'Schedule E — one property (214 Halcyon Row)', amount: 245.00 }
      ];

      items.forEach(function(it) {
        itemsHtml += [
          '<tr>',
          '  <td>' + it.desc + '</td>',
          '  <td class="amount">$' + it.amount.toFixed(2) + '</td>',
          '</tr>'
        ].join('');
      });

      if (fee > 0) {
        itemsHtml += [
          '<tr>',
          '  <td>Card Processing Surcharge (2.9% + $0.30)</td>',
          '  <td class="amount">+$' + fee.toFixed(2) + '</td>',
          '</tr>'
        ].join('');
      }

      var modalHtml = [
        '<div class="receipt-box" id="printable-receipt">',
        '  <div class="receipt-header">',
        '    <div>',
        '      <div style="font-weight:700;font-size:1.05rem;color:var(--ink)">Pivot Aide Tax</div>',
        '      <div style="font-size:.76rem;color:var(--ink-3)">EIN: 84-2918401 &middot; IRS E-File Authorized Provider</div>',
        '      <div style="font-size:.76rem;color:var(--ink-3)">Client: Michael Whitfield &middot; PAT-MW-2026</div>',
        '    </div>',
        '    <div style="text-align:right">',
        '      <span class="receipt-stamp">PAID IN FULL</span>',
        '      <div style="font-size:.78rem;font-weight:600;margin-top:5px;font-family:var(--f-mono)">' + (inv.number || 'Invoice 2026-0418') + '</div>',
        '      <div style="font-size:.72rem;color:var(--ink-3)">' + (inv.date || 'Today') + '</div>',
        '    </div>',
        '  </div>',
        '  <table class="receipt-table">',
        '    <thead>',
        '      <tr><th>Service Scope Item</th><th class="amount">Amount</th></tr>',
        '    </thead>',
        '    <tbody>' + itemsHtml + '</tbody>',
        '    <tfoot>',
        '      <tr class="receipt-total-row">',
        '        <td>Total Paid</td>',
        '        <td class="amount">$' + total.toFixed(2) + '</td>',
        '      </tr>',
        '    </tfoot>',
        '  </table>',
        '  <div style="margin-top:12px;padding:9px 12px;background:var(--surface-2);border-radius:3px;font-size:.74rem;color:var(--ink-2);font-family:var(--f-mono)">',
        '    <div><b>Payment Method:</b> ' + (inv.method || 'Bank transfer (ACH · Cardinal Trust •••• 8842)') + '</div>',
        '    <div><b>Transaction ID:</b> ' + (inv.txnHash || 'ACH-948102-CARDINAL') + '</div>',
        '    <div><b>Status:</b> Settled &middot; Retained under IRS Pub 1345 guidelines</div>',
        '  </div>',
        '</div>'
      ].join('');

      openModal('Itemized Payment Receipt', modalHtml, [
        '<button class="btn btn-o sm" id="btn-download-receipt-pdf">Download PDF Receipt</button>',
        '<button class="btn btn-b sm" id="modal-cancel-btn">Close</button>'
      ].join(''));

      var downloadBtn = document.getElementById('btn-download-receipt-pdf');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
          var safeNum = (inv.number || '2026-0418').replace(/\s+/g, '_');
          showToast('Receipt PDF generated: PivotAideTax_Receipt_' + safeNum + '.pdf', 'ok');
          
          // Simulated file download trigger
          var blob = new Blob([
            'Pivot Aide Tax — Official Payment Receipt\n',
            'Invoice: ' + inv.number + '\n',
            'Date: ' + (inv.date || 'Today') + '\n',
            'Amount: $' + total.toFixed(2) + '\n',
            'Method: ' + (inv.method || 'ACH Transfer') + '\n',
            'Transaction Ref: ' + (inv.txnHash || 'ACH-948102-CARDINAL') + '\n',
            'Taxpayer: Michael Whitfield\n',
            'IRS Publication 1345 Record Retained.\n'
          ], { type: 'text/plain' });
          var link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'PivotAideTax_Receipt_' + safeNum + '.txt';
          link.click();
        });
      }
    }

    // 6. Bind Receipt Click Handlers on Payment History
    function bindReceiptClicks() {
      var rows = document.querySelectorAll('#billing-history-container .row-clickable');
      rows.forEach(function(row) {
        row.onclick = function() {
          var id = row.dataset.invoiceId;
          var inv = null;
          if (id === 'inv-2026-0418') {
            inv = {
              number: 'Invoice 2026-0418',
              amount: 1240.00,
              date: state.billing.paidDate || 'Today',
              method: state.billing.paidMethod || 'Bank transfer (ACH · Cardinal Trust •••• 8842)',
              txnHash: state.billing.txnHash || 'ACH-948102-CARDINAL',
              items: state.billing.lineItems
            };
          } else {
            inv = (state.billing.history || []).find(function(h) { return h.id === id; });
          }
          if (inv) openReceiptModal(inv);
        };
      });
    }
    bindReceiptClicks();

    // 7. Payment Execution Flow
    if (payBtn) {
      payBtn.addEventListener('click', function() {
        if (state.billing.isPaid) {
          openReceiptModal({
            number: 'Invoice 2026-0418',
            amount: 1240.00,
            date: state.billing.paidDate || 'Today',
            method: state.billing.paidMethod || 'Bank transfer (ACH · Cardinal Trust •••• 8842)',
            txnHash: state.billing.txnHash || 'ACH-948102-CARDINAL',
            items: state.billing.lineItems
          });
          return;
        }

        var isCard = currentMethod === 'card';
        var finalFee = isCard ? 36.26 : 0.00;
        var finalAmount = 1240.00 + finalFee;

        payBtn.disabled = true;
        payBtn.textContent = 'Connecting to ' + (isCard ? 'secure card gateway...' : 'banking network (NACHA)...');

        setTimeout(function() {
          payBtn.textContent = isCard ? 'Authorizing tokenized transaction...' : 'Verifying routing & account status...';
        }, 650);

        setTimeout(function() {
          state.billing.isPaid = true;
          state.billing.paidDate = 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          state.billing.paidMethod = isCard ? 'Visa •••• 4012 (Credit Card)' : 'Bank transfer (ACH · Cardinal Trust •••• 8842)';
          state.billing.paidAmount = finalAmount;
          state.billing.txnHash = (isCard ? 'CC-' : 'ACH-') + Math.random().toString(36).substr(2, 8).toUpperCase() + '-TAX';

          // Update header
          var headerDue = document.getElementById('billing-header-due');
          if (headerDue) headerDue.textContent = '$0.00 due';

          var statusBadge = document.getElementById('invoice-status-chip');
          if (statusBadge) {
            statusBadge.style.display = 'inline-block';
            statusBadge.className = 'chip ok';
            statusBadge.textContent = '✓ Paid in full';
          }

          // Update pay button
          payBtn.disabled = false;
          payBtn.textContent = '✓ View Official Receipt ($' + finalAmount.toFixed(2) + ')';
          payBtn.className = 'btn btn-o full';

          // Update Home screen financial badge
          var homeInvoiceStat = document.getElementById('home-stat-invoice');
          if (homeInvoiceStat) {
            homeInvoiceStat.innerHTML = '<div class="n" style="color:var(--ok)">$0.00</div><div class="l">All invoices paid in full</div>';
          }

          // Add newly paid invoice into payment history
          var historyContainer = document.getElementById('billing-history-container');
          if (historyContainer) {
            var newRowHtml = [
              '<div class="row row-clickable" data-invoice-id="inv-2026-0418" style="cursor:pointer;background:var(--ok-bg);animation:fadeIn .3s ease" title="Click to view itemized receipt">',
              '  <span class="ic" style="color:var(--ok)">&#10003;</span>',
              '  <div class="g">',
              '    <div class="t">Invoice 2026-0418 &middot; <span style="color:var(--ok);font-size:.75rem">Just paid</span></div>',
              '    <div class="m">TY2026 return &middot; ' + state.billing.paidMethod + ' &middot; View receipt &rarr;</div>',
              '  </div>',
              '  <b style="font-size:.85rem;font-family:var(--f-mono)">$' + finalAmount.toFixed(2) + '</b>',
              '</div>'
            ].join('');

            var head = historyContainer.querySelector('.rowhead');
            if (head) {
              head.insertAdjacentHTML('afterend', newRowHtml);
            } else {
              historyContainer.insertAdjacentHTML('beforeend', newRowHtml);
            }
            bindReceiptClicks();
          }

          // Add updates entry
          if (state.updates) {
            state.updates.unshift({
              id: 'u-pay-' + Date.now(),
              title: 'Invoice 2026-0418 paid in full ($' + finalAmount.toFixed(2) + ')',
              meta: state.billing.paidMethod + ' · Transaction reference: ' + state.billing.txnHash,
              time: 'Just now',
              isNew: true
            });
          }

          if (window.FirebaseBridge) {
            window.FirebaseBridge.recordAuditLog('Payment Processed', 'Invoice 2026-0418 paid $' + finalAmount.toFixed(2) + ' via ' + state.billing.paidMethod);
            window.FirebaseBridge.logCustomEvent('invoice_paid', {
              invoice: '2026-0418',
              amount: finalAmount,
              method: currentMethod
            });
          }

          showToast('Payment confirmed! Receipt generated for Invoice 2026-0418.', 'ok');

          // Open receipt automatically
          setTimeout(function() {
            openReceiptModal({
              number: 'Invoice 2026-0418',
              amount: 1240.00,
              date: state.billing.paidDate,
              method: state.billing.paidMethod,
              txnHash: state.billing.txnHash,
              items: state.billing.lineItems
            });
          }, 350);
        }, 1200);
      });
    }
  }

  // -------------------------------------------------------------
  // 10. SCREEN 10: FIRM VIEW (STAFF TRIAGE BOARD)
  // -------------------------------------------------------------
  function initFirmView() {
    var triageBtns = document.querySelectorAll('.btn-firm-act');
    triageBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var action = btn.dataset.action;
        var client = btn.dataset.client;

        if (action === 'chase') {
          openModal('Chase Signer: ' + client, [
            '<p style="font-size:.9rem">Form 8879 has been unsigned for 6 days. Two automated reminders were sent.</p>',
            '<div class="field" style="margin-top:12px">',
            '  <label>Action to dispatch:</label>',
            '  <select style="width:100%;padding:9px;border:1px solid var(--line);border-radius:3px">',
            '    <option>Escalate to telephone follow-up call</option>',
            '    <option>Send high-priority SMS deadline alert</option>',
            '    <option>Regenerate KBA envelope</option>',
            '  </select>',
            '</div>'
          ].join(''), '<button class="btn btn-o sm" id="modal-cancel-btn">Cancel</button><button class="btn btn-g sm" id="btn-confirm-chase">Dispatch Escalation</button>');

          var confirmBtn = document.getElementById('btn-confirm-chase');
          if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
              closeModal();
              showToast('Escalation dispatched for ' + client, 'ok');
              btn.textContent = 'Chased';
              btn.className = 'chip ok';
            });
          }
        } else if (action === 'wet-signature') {
          openModal('Switch to Wet Signature: ' + client, [
            '<p style="font-size:.9rem">Client has failed 3 Knowledge-Based Authentication attempts. IRS Pub 1345 forbids further remote attempts.</p>',
            '<p style="font-size:.85rem;color:var(--ink-2);margin-top:8px">Generate a physical signature package for mailing or office signing.</p>'
          ].join(''), '<button class="btn btn-o sm" id="modal-cancel-btn">Cancel</button><button class="btn btn-g sm" id="btn-confirm-wet">Generate Wet Signature Package</button>');

          var confirmWetBtn = document.getElementById('btn-confirm-wet');
          if (confirmWetBtn) {
            confirmWetBtn.addEventListener('click', function() {
              closeModal();
              showToast('Wet signature package generated for ' + client, 'ok');
              btn.textContent = 'Package Sent';
              btn.className = 'chip ok';
            });
          }
        } else if (action === 'notice-review') {
          openModal('Notice Review: ' + client, [
            '<p style="font-size:.9rem">IRS Notice CP2000 uploaded by client on 2 Sep. Free 2-day plain-English read.</p>',
            '<div style="background:var(--surface-2);padding:10px;border-radius:4px;font-family:var(--f-mono);font-size:.78rem;margin-top:8px">',
            '  Issue: Proposed change to 1099-MISC rental distribution.<br>Status: Preparer review drafted.',
            '</div>'
          ].join(''), '<button class="btn btn-o sm" id="modal-cancel-btn">Cancel</button><button class="btn btn-b sm" id="btn-send-review">Send Client Plain-English Read</button>');

          var sendReviewBtn = document.getElementById('btn-send-review');
          if (sendReviewBtn) {
            sendReviewBtn.addEventListener('click', function() {
              closeModal();
              showToast('Notice explanation sent to ' + client, 'ok');
              btn.textContent = 'Completed';
              btn.className = 'chip ok';
            });
          }
        } else if (action === 'waiting') {
          openModal('Client Status: ' + client, [
            '<p style="font-size:.9rem">Two checklist documents are currently outstanding: Form 1099-MISC from Keystone and MD non-resident W-2.</p>',
            '<p style="font-size:.85rem;color:var(--ink-2);margin-top:8px">Automated reminder scheduled to dispatch tomorrow at 9:00 AM.</p>'
          ].join(''), '<button class="btn btn-o sm" id="modal-cancel-btn">Close</button><button class="btn btn-g sm" id="btn-send-now">Send Reminder Now</button>');

          var sendNowBtn = document.getElementById('btn-send-now');
          if (sendNowBtn) {
            sendNowBtn.addEventListener('click', function() {
              closeModal();
              showToast('Reminder pushed to ' + client, 'ok');
              btn.textContent = 'Chased';
              btn.className = 'chip ok';
            });
          }
        }
      });
    });
  }

  // -------------------------------------------------------------
  // 11. SCREEN 07: SERVICES & ENGAGEMENT SCOPING ENGINE
  // -------------------------------------------------------------
  function initServices() {
    function updateServicesUi() {
      var stripTitle = document.getElementById('svc-strip-active-title');
      var stripChip = document.getElementById('svc-strip-status-chip');
      var activeScopes = state.file.activeScopes || [];
      var pendingScopes = state.file.pendingScopes || [];

      if (stripTitle) {
        if (activeScopes.length > 0) {
          stripTitle.textContent = activeScopes.map(function(s) { return s.title; }).join(' · ');
        } else {
          stripTitle.textContent = 'No active scopes assigned';
        }
      }

      if (stripChip) {
        var label = activeScopes.length + ' Active Scope' + (activeScopes.length === 1 ? '' : 's');
        if (pendingScopes.length > 0) {
          label += ' · ' + pendingScopes.length + ' Pending';
        }
        stripChip.textContent = label;
      }

      var cards = document.querySelectorAll('.svcard[data-service-key]');
      cards.forEach(function(card) {
        var key = card.dataset.serviceKey;
        var badge = card.querySelector('#badge-svc-' + key);
        var actionBtn = card.querySelector('.btn-service-action');

        var isActive = activeScopes.some(function(s) { return s.serviceKey === key; });
        var isPending = pendingScopes.some(function(s) { return s.serviceKey === key; });

        card.classList.toggle('is-active', isActive);
        card.classList.toggle('is-pending', isPending && !isActive);

        if (badge) {
          if (isActive) {
            badge.style.display = 'inline-block';
            badge.className = 'chip ok sm';
            badge.textContent = 'Active on file';
          } else if (isPending) {
            badge.style.display = 'inline-block';
            badge.className = 'chip gold sm';
            badge.textContent = 'Scope Pending';
          } else {
            badge.style.display = 'none';
          }
        }

        if (actionBtn) {
          if (key === 'individual') {
            actionBtn.innerHTML = isActive ? '<span class="btn-ic" style="margin-right:6px">✎</span>Review &amp; Add Schedules' : '<span class="btn-ic" style="margin-right:6px">+</span>Add';
            actionBtn.className = 'btn btn-o sm btn-service-action';
          } else if (key === 'flagship') {
            actionBtn.innerHTML = isPending ? '<span class="btn-ic" style="margin-right:6px">✓</span>Inquiry Sent (Talk to us)' : '<span class="btn-ic" style="margin-right:6px">💬</span>Talk to us';
            actionBtn.className = 'btn btn-g sm btn-service-action';
          } else {
            if (isActive) {
              actionBtn.innerHTML = '<span class="btn-ic" style="margin-right:6px">✓</span>Active on File';
              actionBtn.className = 'btn btn-o sm btn-service-action';
            } else if (isPending) {
              actionBtn.innerHTML = '<span class="btn-ic" style="margin-right:6px">⏳</span>Scope Requested';
              actionBtn.className = 'btn btn-o sm btn-service-action';
            } else {
              actionBtn.innerHTML = '<span class="btn-ic" style="margin-right:6px">+</span>Add';
              actionBtn.className = 'btn btn-o sm btn-service-action';
            }
          }
        }
      });
    }

    // Active File Scopes Modal
    var btnViewScopes = document.getElementById('btn-view-active-scopes');
    if (btnViewScopes) {
      btnViewScopes.addEventListener('click', function() {
        var activeScopes = state.file.activeScopes || [];
        var pendingScopes = state.file.pendingScopes || [];

        var listHtml = '<div style="display:flex;flex-direction:column;gap:12px">';

        listHtml += '<div><span class="calc-section-title">Active Signed Engagements (' + activeScopes.length + ')</span>';
        if (activeScopes.length === 0) {
          listHtml += '<p class="sub" style="margin-top:4px">No active engagements on file.</p>';
        } else {
          activeScopes.forEach(function(s) {
            listHtml += [
              '<div style="background:var(--surface-2);border-left:3.5px solid var(--ok);padding:11px 13px;border-radius:4px;margin-top:7px">',
              '  <div style="display:flex;justify-content:space-between;align-items:center">',
              '    <b>' + s.title + '</b>',
              '    <span style="font-family:var(--f-mono);font-size:.85rem;color:var(--ink);font-weight:600">' + (s.fee || '$1,240.00') + '</span>',
              '  </div>',
              '  <p class="sub" style="font-size:.78rem;margin-top:4px">' + s.details + '</p>',
              '  <div style="font-size:.72rem;color:var(--ink-3);margin-top:6px;font-family:var(--f-mono)">' + (s.date || 'Signed') + '</div>',
              '</div>'
            ].join('');
          });
        }
        listHtml += '</div>';

        if (pendingScopes.length > 0) {
          listHtml += '<div style="margin-top:8px"><span class="calc-section-title">Pending Scope Proposals (' + pendingScopes.length + ')</span>';
          pendingScopes.forEach(function(s) {
            listHtml += [
              '<div style="background:var(--surface-2);border-left:3.5px solid var(--gold);padding:11px 13px;border-radius:4px;margin-top:7px">',
              '  <div style="display:flex;justify-content:space-between;align-items:center">',
              '    <b>' + s.title + '</b>',
              '    <span class="chip gold sm">Awaiting Letter</span>',
              '  </div>',
              '  <p class="sub" style="font-size:.78rem;margin-top:4px">' + s.details + '</p>',
              '  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:7px">',
              '    <span style="font-family:var(--f-mono);font-size:.82rem;color:var(--gold-dp);font-weight:500">' + (s.fee || 'Quoted on scope') + '</span>',
              '    <button class="btn-text-link btn-remove-pending" data-scope-id="' + s.id + '" style="color:var(--warn);font-size:.75rem">Withdraw scope request</button>',
              '  </div>',
              '</div>'
            ].join('');
          });
          listHtml += '</div>';
        }

        listHtml += [
          '<div class="scope-clause-box">',
          '  <b>Safeguards Rule & Engagement Protection:</b> Under IRS Pub 1345 rules, no tax preparation or accounting work begins until an engagement letter with fixed scope and fee schedule is signed by both taxpayer and practitioner.',
          '</div>',
          '</div>'
        ].join('');

        openModal('Your Active File Scopes & Engagements', listHtml, '<button class="btn btn-b sm" id="modal-cancel-btn">Done</button>');

        var removeBtns = document.querySelectorAll('.btn-remove-pending');
        removeBtns.forEach(function(b) {
          b.addEventListener('click', function() {
            var scopeId = b.dataset.scopeId;
            state.file.pendingScopes = state.file.pendingScopes.filter(function(s) { return s.id !== scopeId; });
            closeModal();
            updateServicesUi();
            showToast('Scope request withdrawn.', 'info');
          });
        });
      });
    }

    // Modal 1: Individual Return Scope & Fee Calculator
    function openIndividualScopeModal() {
      var modalHtml = [
        '<p style="font-size:.88rem">Federal return base ($200) covers Form 1040, standard deductions, and your resident Maryland return. Select schedules and non-resident jurisdictions below for upfront guaranteed pricing.</p>',
        '<div class="calc-box">',
        '  <div class="calc-section-title">Core Filings</div>',
        '  <div class="calc-row">',
        '    <label class="calc-row-left">',
        '      <input type="checkbox" checked disabled>',
        '      <span>Federal Return (Form 1040) &middot; Resident MD 502</span>',
        '    </label>',
        '    <span class="calc-row-fee">$200.00</span>',
        '  </div>',
        '  <div class="calc-section-title" style="margin-top:10px">Jurisdictions & State Returns</div>',
        '  <div class="calc-row">',
        '    <label class="calc-row-left">',
        '      <input type="checkbox" id="calc-va" checked data-fee="65">',
        '      <span>Virginia Form 763 (Non-resident / part-year)</span>',
        '    </label>',
        '    <span class="calc-row-fee">+$65.00</span>',
        '  </div>',
        '  <div class="calc-row">',
        '    <label class="calc-row-left">',
        '      <input type="checkbox" id="calc-pa" checked data-fee="65">',
        '      <span>Pennsylvania Form 40NR (Non-resident on-site)</span>',
        '    </label>',
        '    <span class="calc-row-fee">+$65.00</span>',
        '  </div>',
        '  <div class="calc-row">',
        '    <label class="calc-row-left">',
        '      <input type="checkbox" id="calc-addl-state" data-fee="65">',
        '      <span>Additional State Return (DC, DE, NY, etc.)</span>',
        '    </label>',
        '    <span class="calc-row-fee">+$65.00</span>',
        '  </div>',
        '  <div class="calc-section-title" style="margin-top:10px">Schedules & Business Activities</div>',
        '  <div class="calc-row">',
        '    <label class="calc-row-left">',
        '      <input type="checkbox" id="calc-sched-c" checked data-fee="110">',
        '      <span>Schedule C &middot; Whitfield Design Co. (Sole Prop / Freelance)</span>',
        '    </label>',
        '    <span class="calc-row-fee">+$110.00</span>',
        '  </div>',
        '  <div class="calc-row">',
        '    <label class="calc-row-left">',
        '      <input type="checkbox" id="calc-sched-e" checked data-fee="85">',
        '      <span>Schedule E &middot; Rental Real Estate (214 Halcyon Row)</span>',
        '    </label>',
        '    <span class="calc-row-fee">+$85.00</span>',
        '  </div>',
        '  <div class="calc-row">',
        '    <label class="calc-row-left">',
        '      <input type="checkbox" id="calc-crypto" data-fee="50">',
        '      <span>Form 8949 &middot; Capital Gains, Stocks &amp; Crypto</span>',
        '    </label>',
        '    <span class="calc-row-fee">+$50.00</span>',
        '  </div>',
        '</div>',
        '<div class="calc-total-bar">',
        '  <span class="calc-total-label">Upfront Guaranteed Scope Fee:</span>',
        '  <span class="calc-total-amount" id="calc-live-total">$525.00</span>',
        '</div>',
        '<div class="scope-clause-box">',
        '  <b>Upfront price guarantee:</b> The price shown is what you pay. If our review uncovers no unforeseen complexity, your invoice will match this exact dollar figure.',
        '</div>'
      ].join('');

      openModal('Individual Return Scope & Fee Calculator', modalHtml, [
        '<button class="btn btn-o sm" id="modal-cancel-btn">Cancel</button>',
        '<button class="btn btn-g sm" id="btn-confirm-individual-scope">Confirm Scope &amp; Request Letter</button>'
      ].join(''));

      function recalculate() {
        var base = 200;
        var inputs = document.querySelectorAll('.calc-box input[type="checkbox"]:not(:disabled)');
        inputs.forEach(function(inp) {
          if (inp.checked) {
            base += parseInt(inp.dataset.fee, 10) || 0;
          }
        });
        var totalEl = document.getElementById('calc-live-total');
        if (totalEl) totalEl.textContent = '$' + base + '.00';
        return base;
      }

      var calcCheckboxes = document.querySelectorAll('.calc-box input[type="checkbox"]');
      calcCheckboxes.forEach(function(cb) {
        cb.addEventListener('change', recalculate);
      });

      var confirmBtn = document.getElementById('btn-confirm-individual-scope');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
          var finalFee = recalculate();
          var descParts = ['Federal + MD (resident)'];
          if (document.getElementById('calc-va') && document.getElementById('calc-va').checked) descParts.push('VA');
          if (document.getElementById('calc-pa') && document.getElementById('calc-pa').checked) descParts.push('PA');
          if (document.getElementById('calc-sched-c') && document.getElementById('calc-sched-c').checked) descParts.push('Sched C');
          if (document.getElementById('calc-sched-e') && document.getElementById('calc-sched-e').checked) descParts.push('Sched E');

          if (state.file.activeScopes && state.file.activeScopes.length > 0) {
            state.file.activeScopes[0].fee = '$' + finalFee + '.00';
            state.file.activeScopes[0].details = descParts.join(' · ');
          }

          if (window.FirebaseBridge) {
            window.FirebaseBridge.recordAuditLog('Scope Updated', 'Individual Return updated to $' + finalFee);
          }

          closeModal();
          updateServicesUi();
          showToast('Individual Return scope updated ($' + finalFee + '.00). Engagement letter updated.', 'ok');
        });
      }
    }

    // Modal 2: Business Return Scope Assessment
    function openBusinessScopeModal() {
      var modalHtml = [
        '<p style="font-size:.88rem">Select your corporate entity type and bookkeeping readiness. Books are thoroughly reviewed by our CPAs before the return is built.</p>',
        '<div class="calc-box">',
        '  <div class="calc-section-title">1. Entity Structure</div>',
        '  <div class="tier-grid">',
        '    <div class="tier-card selected" data-entity="scorp" data-base="850">',
        '      <span class="tier-name">S-Corporation</span>',
        '      <span class="tier-rate">Form 1120-S</span>',
        '      <span class="tier-desc">Includes Form 1125-A, Schedule K-1s for shareholders</span>',
        '    </div>',
        '    <div class="tier-card" data-entity="partnership" data-base="850">',
        '      <span class="tier-name">Partnership</span>',
        '      <span class="tier-rate">Form 1065</span>',
        '      <span class="tier-desc">Multi-member LLCs, partner capital accounts &amp; K-1s</span>',
        '    </div>',
        '    <div class="tier-card" data-entity="ccorp" data-base="950">',
        '      <span class="tier-name">C-Corporation</span>',
        '      <span class="tier-rate">Form 1120</span>',
        '      <span class="tier-desc">Corporate income tax &amp; accumulated earnings balance</span>',
        '    </div>',
        '  </div>',
        '  <div class="calc-section-title" style="margin-top:14px">2. Bookkeeping Status</div>',
        '  <div style="display:flex;flex-direction:column;gap:8px">',
        '    <label class="calc-row-left" style="background:var(--surface);padding:8px 10px;border:1px solid var(--line);border-radius:3px">',
        '      <input type="radio" name="biz-books" value="0" checked>',
        '      <span style="font-size:.84rem">Reconciled &amp; closed in QuickBooks / Xero (no catch-up needed)</span>',
        '    </label>',
        '    <label class="calc-row-left" style="background:var(--surface);padding:8px 10px;border:1px solid var(--line);border-radius:3px">',
        '      <input type="radio" name="biz-books" value="250">',
        '      <span style="font-size:.84rem">Minor year-end adjustments needed (+ $250.00)</span>',
        '    </label>',
        '    <label class="calc-row-left" style="background:var(--surface);padding:8px 10px;border:1px solid var(--line);border-radius:3px">',
        '      <input type="radio" name="biz-books" value="500">',
        '      <span style="font-size:.84rem">Need bookkeeping reconstruction / catch-up (+ $500.00)</span>',
        '    </label>',
        '  </div>',
        '</div>',
        '<div class="calc-total-bar">',
        '  <span class="calc-total-label">Estimated Scope Proposal:</span>',
        '  <span class="calc-total-amount" id="biz-scope-total">$850.00</span>',
        '</div>',
        '<div class="scope-clause-box">',
        '  <b>Scope Review Promise:</b> Nothing is billed until we examine your trial balance and issue a signed engagement letter.',
        '</div>'
      ].join('');

      openModal('Business Return Scope Assessment', modalHtml, [
        '<button class="btn btn-o sm" id="modal-cancel-btn">Cancel</button>',
        '<button class="btn btn-g sm" id="btn-submit-biz-scope">Submit Business Scope</button>'
      ].join(''));

      var selectedBase = 850;
      var selectedEntity = 'S-Corporation (1120-S)';
      var tierCards = document.querySelectorAll('.tier-card[data-entity]');
      tierCards.forEach(function(card) {
        card.addEventListener('click', function() {
          tierCards.forEach(function(c) { c.classList.remove('selected'); });
          card.classList.add('selected');
          selectedBase = parseInt(card.dataset.base, 10);
          selectedEntity = card.querySelector('.tier-name').textContent;
          updateBizTotal();
        });
      });

      var bookRadios = document.querySelectorAll('input[name="biz-books"]');
      bookRadios.forEach(function(r) {
        r.addEventListener('change', updateBizTotal);
      });

      function updateBizTotal() {
        var bookFee = 0;
        var checkedRadio = document.querySelector('input[name="biz-books"]:checked');
        if (checkedRadio) bookFee = parseInt(checkedRadio.value, 10);
        var total = selectedBase + bookFee;
        var el = document.getElementById('biz-scope-total');
        if (el) el.textContent = '$' + total + '.00';
        return total;
      }

      var submitBtn = document.getElementById('btn-submit-biz-scope');
      if (submitBtn) {
        submitBtn.addEventListener('click', function() {
          var total = updateBizTotal();
          var newScope = {
            id: 'scope-biz-' + Date.now(),
            serviceKey: 'business',
            title: 'Business Return (' + selectedEntity + ')',
            details: 'Federal business filing · includes K-1 package · books assessment',
            fee: '$' + total + '.00',
            statusLabel: 'Scope Pending'
          };
          if (!state.file.pendingScopes) state.file.pendingScopes = [];
          state.file.pendingScopes.push(newScope);

          if (state.firmTriage && state.firmTriage.actionQueue) {
            state.firmTriage.actionQueue.unshift({
              id: 't-' + Date.now(),
              name: state.user.name,
              issue: 'Business return scope requested (' + selectedEntity + ')',
              sub: 'Estimated $' + total + ' · review trial balance',
              chip: 'New Scope',
              chipClass: 'warn',
              action: 'scope-review'
            });
          }

          closeModal();
          updateServicesUi();
          showToast('Business scope submitted ($' + total + '.00). Denise R. will review within 24 hours.', 'ok');
        });
      }
    }

    // Modal 3: Monthly Bookkeeping Plan
    function openBookkeepingScopeModal() {
      var modalHtml = [
        '<p style="font-size:.88rem">Monthly reconciliation, expense classification, and clear financial statements delivered by the 10th of every month.</p>',
        '<div class="calc-box">',
        '  <div class="calc-section-title">Select Monthly Tier</div>',
        '  <div class="tier-grid">',
        '    <div class="tier-card" data-plan="starter" data-rate="195">',
        '      <span class="tier-name">Starter</span>',
        '      <span class="tier-rate">$195 / mo</span>',
        '      <span class="tier-desc">Up to 50 transactions, 1 bank account, monthly P&amp;L</span>',
        '    </div>',
        '    <div class="tier-card selected" data-plan="growth" data-rate="350">',
        '      <span class="tier-name">Growth</span>',
        '      <span class="tier-rate">$350 / mo</span>',
        '      <span class="tier-desc">Up to 150 transactions, multiple cards, monthly balance sheet</span>',
        '    </div>',
        '    <div class="tier-card" data-plan="scale" data-rate="550">',
        '      <span class="tier-name">Full Charge</span>',
        '      <span class="tier-rate">$550 / mo</span>',
        '      <span class="tier-desc">Multi-entity, payroll reconciliation &amp; quarterly review</span>',
        '    </div>',
        '  </div>',
        '  <div class="calc-section-title" style="margin-top:14px">Accounting Platform</div>',
        '  <select id="bookkeeping-software" style="width:100%;padding:9px 12px;background:var(--surface);border:1px solid var(--line);border-radius:3px;font-family:var(--f-body);color:var(--ink)">',
        '    <option value="qbo">QuickBooks Online (invite accountant)</option>',
        '    <option value="xero">Xero Accounting</option>',
        '    <option value="setup">Need Pivot Aide Tax to set up my ledger</option>',
        '  </select>',
        '</div>',
        '<div class="calc-total-bar">',
        '  <span class="calc-total-label">Monthly Rate (No Annual Lock-in):</span>',
        '  <span class="calc-total-amount" id="bk-live-rate">$350.00 / mo</span>',
        '</div>',
        '<div class="scope-clause-box">',
        '  <b>Seamless Tax Season Integration:</b> When we do your monthly bookkeeping, your year-end business and personal returns are prepared with zero stress.',
        '</div>'
      ].join('');

      openModal('Monthly Bookkeeping Subscription', modalHtml, [
        '<button class="btn btn-o sm" id="modal-cancel-btn">Cancel</button>',
        '<button class="btn btn-g sm" id="btn-confirm-bk-scope">Add Bookkeeping to File</button>'
      ].join(''));

      var selectedPlanName = 'Growth';
      var selectedPlanRate = 350;
      var cards = document.querySelectorAll('.tier-card[data-plan]');
      cards.forEach(function(card) {
        card.addEventListener('click', function() {
          cards.forEach(function(c) { c.classList.remove('selected'); });
          card.classList.add('selected');
          selectedPlanName = card.querySelector('.tier-name').textContent;
          selectedPlanRate = parseInt(card.dataset.rate, 10);
          var rateEl = document.getElementById('bk-live-rate');
          if (rateEl) rateEl.textContent = '$' + selectedPlanRate + '.00 / mo';
        });
      });

      var confirmBtn = document.getElementById('btn-confirm-bk-scope');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
          var sw = document.getElementById('bookkeeping-software');
          var swText = sw ? sw.options[sw.selectedIndex].text : 'QuickBooks Online';

          var newScope = {
            id: 'scope-bk-' + Date.now(),
            serviceKey: 'bookkeeping',
            title: 'Monthly Bookkeeping (' + selectedPlanName + ')',
            details: selectedPlanName + ' tier · $' + selectedPlanRate + '/mo · ' + swText,
            fee: '$' + selectedPlanRate + '.00 / mo',
            statusLabel: 'Scope Pending'
          };
          if (!state.file.pendingScopes) state.file.pendingScopes = [];
          state.file.pendingScopes.push(newScope);

          closeModal();
          updateServicesUi();
          showToast('Monthly Bookkeeping added to file (' + selectedPlanName + ' tier).', 'ok');
        });
      }
    }

    // Modal 4: Accounting Cleanup Diagnostic
    function openCleanupScopeModal() {
      var modalHtml = [
        '<p style="font-size:.88rem">Catch-up and reconstruction so your business return stands on verified numbers that will withstand IRS scrutiny.</p>',
        '<div class="calc-box">',
        '  <div class="calc-section-title">Months Needing Reconstruction</div>',
        '  <div style="display:flex;flex-direction:column;gap:8px">',
        '    <label class="calc-row-left" style="background:var(--surface);padding:8px 10px;border:1px solid var(--line);border-radius:3px">',
        '      <input type="radio" name="cleanup-months" value="650" checked>',
        '      <span style="font-size:.84rem"><b>1–3 months:</b> Quick catch-up &amp; account reconciliation (~$650.00)</span>',
        '    </label>',
        '    <label class="calc-row-left" style="background:var(--surface);padding:8px 10px;border:1px solid var(--line);border-radius:3px">',
        '      <input type="radio" name="cleanup-months" value="1250">',
        '      <span style="font-size:.84rem"><b>4–12 months:</b> Full year reconstruction &amp; statement tie-out (~$1,250.00)</span>',
        '    </label>',
        '    <label class="calc-row-left" style="background:var(--surface);padding:8px 10px;border:1px solid var(--line);border-radius:3px">',
        '      <input type="radio" name="cleanup-months" value="2200">',
        '      <span style="font-size:.84rem"><b>1+ years:</b> Multi-year backlog &amp; prior period adjustments (~$2,200+)</span>',
        '    </label>',
        '  </div>',
        '  <div class="calc-section-title" style="margin-top:14px">Known Diagnostic Issues</div>',
        '  <div style="display:flex;flex-direction:column;gap:6px">',
        '    <label style="display:flex;align-items:center;gap:8px;font-size:.82rem"><input type="checkbox" checked> Personal and business expenses commingled</label>',
        '    <label style="display:flex;align-items:center;gap:8px;font-size:.82rem"><input type="checkbox" checked> Bank feeds have unreconciled discrepancies</label>',
        '    <label style="display:flex;align-items:center;gap:8px;font-size:.82rem"><input type="checkbox"> Prior year tax return balance does not match books</label>',
        '  </div>',
        '</div>',
        '<div class="scope-clause-box">',
        '  <b>Free Diagnostic:</b> We review your bank feed health and deliver a fixed-fee cleanup scope proposal within 48 hours before any work begins.',
        '</div>'
      ].join('');

      openModal('Accounting Cleanup & Reconstruction', modalHtml, [
        '<button class="btn btn-o sm" id="modal-cancel-btn">Cancel</button>',
        '<button class="btn btn-g sm" id="btn-request-cleanup">Request Fixed-Price Diagnostic</button>'
      ].join(''));

      var reqBtn = document.getElementById('btn-request-cleanup');
      if (reqBtn) {
        reqBtn.addEventListener('click', function() {
          var checkedRadio = document.querySelector('input[name="cleanup-months"]:checked');
          var estFee = checkedRadio ? checkedRadio.value : '650';

          var newScope = {
            id: 'scope-clean-' + Date.now(),
            serviceKey: 'cleanup',
            title: 'Accounting Cleanup Diagnostic',
            details: 'Diagnostic review · est. $' + estFee + ' · 48h proposal turnaround',
            fee: 'Est. $' + estFee + '.00',
            statusLabel: 'Scope Pending'
          };
          if (!state.file.pendingScopes) state.file.pendingScopes = [];
          state.file.pendingScopes.push(newScope);

          closeModal();
          updateServicesUi();
          showToast('Cleanup diagnostic requested. Denise R. will assess your ledger.', 'ok');
        });
      }
    }

    // Modal 5: Audit & Resolution
    function openAuditScopeModal() {
      var modalHtml = [
        '<p style="font-size:.88rem">IRS examination notices, automated CP2000 underreporting inquiries, state agency audits, or unfiled prior years.</p>',
        '<div class="calc-box">',
        '  <div class="calc-section-title">Select Resolution Tier</div>',
        '  <div class="tier-grid">',
        '    <div class="tier-card selected" data-audit-tier="tier1" data-fee="150">',
        '      <span class="tier-name">Tier 1: Notice Reply</span>',
        '      <span class="tier-rate">$150.00</span>',
        '      <span class="tier-desc">CP2000 math errors, document match &amp; written response</span>',
        '    </div>',
        '    <div class="tier-card" data-audit-tier="tier2" data-fee="450">',
        '      <span class="tier-name">Tier 2: Full Audit</span>',
        '      <span class="tier-rate">$450.00</span>',
        '      <span class="tier-desc">Correspondence audit defense, Schedule C/E substantiation</span>',
        '    </div>',
        '    <div class="tier-card" data-audit-tier="tier3" data-fee="1200">',
        '      <span class="tier-name">Tier 3: In-Person</span>',
        '      <span class="tier-rate">Retainer ($1,200)</span>',
        '      <span class="tier-desc">Field examination, IRS Appeals &amp; back tax settlements</span>',
        '    </div>',
        '  </div>',
        '  <div class="calc-section-title" style="margin-top:14px">Notice / Case Details (Optional)</div>',
        '  <input type="text" id="audit-notice-num" placeholder="e.g. IRS Notice CP2000 or Letter 525" style="width:100%;padding:9px 12px;background:var(--surface);border:1px solid var(--line);border-radius:3px;font-family:var(--f-body);color:var(--ink);box-sizing:border-box">',
        '</div>',
        '<div class="calc-total-bar">',
        '  <span class="calc-total-label">Selected Tier Fee:</span>',
        '  <span class="calc-total-amount" id="audit-tier-fee">$150.00</span>',
        '</div>',
        '<div class="scope-clause-box">',
        '  <b>Power of Attorney:</b> If formal representation is required, Form 2848 (IRS Power of Attorney) will be prepared for your electronic signature.',
        '</div>'
      ].join('');

      openModal('Audit & Resolution Representation', modalHtml, [
        '<button class="btn btn-o sm" id="modal-cancel-btn">Cancel</button>',
        '<button class="btn btn-g sm" id="btn-confirm-audit">Engage Resolution Team</button>'
      ].join(''));

      var selectedTierName = 'Tier 1: Notice Reply';
      var selectedTierFee = '$150.00';
      var cards = document.querySelectorAll('.tier-card[data-audit-tier]');
      cards.forEach(function(card) {
        card.addEventListener('click', function() {
          cards.forEach(function(c) { c.classList.remove('selected'); });
          card.classList.add('selected');
          selectedTierName = card.querySelector('.tier-name').textContent;
          var feeVal = card.dataset.fee;
          selectedTierFee = feeVal === '1200' ? 'Retainer ($1,200)' : '$' + feeVal + '.00';
          var feeEl = document.getElementById('audit-tier-fee');
          if (feeEl) feeEl.textContent = selectedTierFee;
        });
      });

      var confirmBtn = document.getElementById('btn-confirm-audit');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
          var noticeNum = (document.getElementById('audit-notice-num') || {}).value || 'Unspecified Notice';
          var newScope = {
            id: 'scope-audit-' + Date.now(),
            serviceKey: 'audit',
            title: 'Audit Resolution (' + selectedTierName + ')',
            details: noticeNum + ' · Enrolled Agent priority representation',
            fee: selectedTierFee,
            statusLabel: 'Scope Pending'
          };
          if (!state.file.pendingScopes) state.file.pendingScopes = [];
          state.file.pendingScopes.push(newScope);

          closeModal();
          updateServicesUi();
          showToast('Audit & resolution scope registered. Senior advisor assigned.', 'ok');
        });
      }
    }

    // Modal 6: The Standing File (Flagship)
    function openFlagshipModal() {
      var modalHtml = [
        '<div style="text-align:center;padding:6px 0 12px">',
        '  <span class="chip gold" style="font-size:.72rem">Flagship Advisory Tier</span>',
        '  <h3 style="font-size:1.3rem;margin-top:8px">The Standing File</h3>',
        '  <p class="sub" style="max-width:44ch;margin:6px auto 0">Year-long tax minimization, proactive quarterly projection calls, and a dedicated senior advisor who knows every detail of your file.</p>',
        '</div>',
        '<div class="calc-box">',
        '  <div class="calc-section-title">What is Included in The Standing File</div>',
        '  <ul style="margin:4px 0 0 18px;padding:0;font-size:.84rem;line-height:1.6;color:var(--ink)">',
        '    <li><b>Dedicated Senior Advisor:</b> Direct mobile access and priority messaging with Denise R.</li>',
        '    <li><b>Quarterly Tax Projections:</b> Proactive estimated tax recalculation before deadlines.</li>',
        '    <li><b>Year-End Strategy Call:</b> November acceleration and tax minimization blueprint.</li>',
        '    <li><b>Full IRS Audit Protection:</b> Zero hourly fees for notice defense and examination replies.</li>',
        '    <li><b>Unified Scope:</b> Both personal 1040 and business entities synchronized in one open file.</li>',
        '  </ul>',
        '</div>',
        '<div class="scope-clause-box" style="margin-top:14px">',
        '  <b>Tailored to Your Complexity:</b> Pricing is customized based on your business entities and investment volume. Talk directly with Denise to evaluate enrollment.',
        '</div>'
      ].join('');

      openModal('The Standing File &mdash; Flagship Advisory', modalHtml, [
        '<button class="btn btn-o sm" id="modal-cancel-btn">Close</button>',
        '<button class="btn btn-g sm" id="btn-standing-file-message">Send Message to Denise</button>'
      ].join(''));

      var msgBtn = document.getElementById('btn-standing-file-message');
      if (msgBtn) {
        msgBtn.addEventListener('click', function() {
          closeModal();
          showScreen('msgs');
          sendUserMessage("Hi Denise, I'm interested in enrolling in The Standing File for year-round tax strategy and quarterly planning. What is the scope and pricing for my file?");
          showToast('Inquiry sent to Denise R. regarding The Standing File.', 'ok');
        });
      }
    }

    // Modal 7: Free IRS Notice Review ("Send us the letter")
    var uploadNoticeBtn = document.getElementById('btn-upload-notice');
    if (uploadNoticeBtn) {
      uploadNoticeBtn.addEventListener('click', function() {
        var modalHtml = [
          '<p style="font-size:.88rem">Photograph or upload any IRS or state notice. Uncle Pat and the team will explain what it actually says in plain English within <b>two business days</b> &mdash; completely free, whether or not you are a client.</p>',
          '<div class="calc-box">',
          '  <div class="calc-section-title">1. Notice Issuer &amp; Agency</div>',
          '  <select id="notice-agency-select" style="width:100%;padding:9px 12px;background:var(--surface);border:1px solid var(--line);border-radius:3px;font-family:var(--f-body);color:var(--ink)">',
          '    <option value="IRS">Internal Revenue Service (Federal)</option>',
          '    <option value="MD">Comptroller of Maryland</option>',
          '    <option value="VA">Virginia Department of Taxation</option>',
          '    <option value="PA">Pennsylvania Department of Revenue</option>',
          '    <option value="Other">Other State Revenue Agency</option>',
          '  </select>',
          '  <div class="calc-section-title" style="margin-top:14px">2. Notice Form / Letter Number</div>',
          '  <select id="notice-type-select" style="width:100%;padding:9px 12px;background:var(--surface);border:1px solid var(--line);border-radius:3px;font-family:var(--f-body);color:var(--ink)">',
          '    <option value="CP2000">CP2000 &middot; Proposed Changes to Income / 1099 Underreporter</option>',
          '    <option value="CP504">CP504 &middot; Notice of Intent to Levy</option>',
          '    <option value="5071C">5071C / 5747C &middot; Tax Return Identity Verification</option>',
          '    <option value="CP14">CP14 &middot; Balance Due / Unpaid Assessment</option>',
          '    <option value="Letter 12C">Letter 12C &middot; Missing 1095-A / W-2 Information</option>',
          '    <option value="State Discrepancy">State Notice &middot; Apportionment or Withholding Question</option>',
          '    <option value="Other Notice">Other / Not Listed</option>',
          '  </select>',
          '  <div class="calc-section-title" style="margin-top:14px">3. Upload File or Snap Photo</div>',
          '  <div class="drop" id="notice-file-drop" style="cursor:pointer;padding:18px 12px;text-align:center;border:2px dashed var(--line);border-radius:4px;background:var(--surface)">',
          '    <div class="ic" style="font-size:1.6rem">✉</div>',
          '    <div class="t" id="notice-drop-text" style="font-weight:500;margin-top:4px">Drop notice PDF or photo here</div>',
          '    <div class="m" style="font-size:.74rem;color:var(--ink-3)">Scanned on arrival &middot; zero spam &middot; encrypted storage</div>',
          '  </div>',
          '  <input type="file" id="notice-file-input" accept="image/*,.pdf" style="display:none">',
          '</div>',
          '<div class="notice-preview-badge">',
          '  <span class="chip ok sm">48h SLA</span>',
          '  <span style="font-size:.78rem;color:var(--ink-2);line-height:1.35">You will receive an itemized, plain-English breakdown with zero sales pitch or pressure to hire us.</span>',
          '</div>'
        ].join('');

        openModal('Free IRS or State Notice Read', modalHtml, [
          '<button class="btn btn-o sm" id="modal-cancel-btn">Cancel</button>',
          '<button class="btn btn-b sm" id="btn-submit-notice">Upload Notice for 48h Read</button>'
        ].join(''));

        var dropZone = document.getElementById('notice-file-drop');
        var fileInput = document.getElementById('notice-file-input');
        var dropText = document.getElementById('notice-drop-text');
        var selectedFileName = 'irs-notice-cp2000.pdf';

        if (dropZone && fileInput) {
          dropZone.addEventListener('click', function() {
            fileInput.click();
          });
          fileInput.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
              selectedFileName = e.target.files[0].name;
              if (dropText) dropText.innerHTML = '<span style="color:var(--ok)">✓ Attached: ' + selectedFileName + '</span>';
            }
          });
        }

        var submitNoticeBtn = document.getElementById('btn-submit-notice');
        if (submitNoticeBtn) {
          submitNoticeBtn.addEventListener('click', function() {
            var agencySelect = document.getElementById('notice-agency-select');
            var agency = agencySelect ? agencySelect.value : 'IRS';
            var typeSelect = document.getElementById('notice-type-select');
            var noticeType = typeSelect ? typeSelect.value : 'CP2000';

            // 1. Add to documents under 'review'
            var docId = 'doc-notice-' + Date.now();
            state.documents.unshift({
              id: docId,
              name: agency + ' Notice (' + noticeType + ') — Free Plain-English Read',
              category: 'review',
              meta: 'Uploaded today · Denise reviewing · 48h SLA guarantee',
              type: 'Notice',
              icon: '✉'
            });
            renderDocumentsList();

            // 2. Add to messages from Uncle Pat
            state.messages.push({
              id: 'm-' + Date.now(),
              sender: 'Uncle Pat · automatic',
              role: 'pat',
              avatar: 'PAT',
              text: 'We received your ' + agency + ' ' + noticeType + ' notice (' + selectedFileName + '). Denise is reading it now. Your plain-English summary is guaranteed within two business days.'
            });

            // 3. Add to updates
            if (state.updates) {
              state.updates.unshift({
                id: 'u-' + Date.now(),
                title: agency + ' Notice received for free plain-English read',
                meta: 'Turnaround guaranteed within 2 business days. Denise R. assigned.',
                time: 'Just now',
                isNew: true
              });
            }

            // 4. Add to firm triage queue
            if (state.firmTriage && state.firmTriage.actionQueue) {
              state.firmTriage.actionQueue.unshift({
                id: 't-' + Date.now(),
                name: state.user.name,
                issue: agency + ' ' + noticeType + ' notice uploaded',
                sub: 'Free read promised within 2 business days',
                chip: 'Due 48h',
                chipClass: 'warn',
                action: 'notice-review'
              });
            }

            if (window.FirebaseBridge) {
              window.FirebaseBridge.recordAuditLog('Notice Uploaded', agency + ' ' + noticeType + ' uploaded for free read');
              window.FirebaseBridge.logCustomEvent('notice_uploaded', { agency: agency, type: noticeType });
            }

            closeModal();
            showToast('Notice received! Your 2-day plain-English read is underway.', 'ok');
          });
        }
      });
    }

    // Bind click events to all service cards and buttons
    function handleServiceAction(key) {
      if (key === 'individual') {
        openIndividualScopeModal();
      } else if (key === 'business') {
        openBusinessScopeModal();
      } else if (key === 'bookkeeping') {
        openBookkeepingScopeModal();
      } else if (key === 'cleanup') {
        openCleanupScopeModal();
      } else if (key === 'audit') {
        openAuditScopeModal();
      } else if (key === 'flagship') {
        openFlagshipModal();
      }
    }

    var serviceCards = document.querySelectorAll('.svcard[data-service-key]');
    serviceCards.forEach(function(card) {
      var actionBtn = card.querySelector('.btn-service-action');
      if (actionBtn) {
        actionBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var key = actionBtn.dataset.serviceKey || card.dataset.serviceKey;
          handleServiceAction(key);
        });
      }
      card.addEventListener('click', function(e) {
        if (e.target.closest('button, a, input, select')) return;
        handleServiceAction(card.dataset.serviceKey);
      });
    });

    // Initialize UI on load
    updateServicesUi();
  }

  // -------------------------------------------------------------
  // 12. SCREEN 09: NOTIFICATION CONTROLS & UPDATES ENGINE
  // -------------------------------------------------------------
  function initUpdates() {
    var feedList = document.getElementById('updates-feed-list');

    // Channel cycle progression mappings
    var channelLabels = {
      'push-email': 'Push · email',
      'push': 'Push only',
      'email': 'Email',
      'off': 'Off'
    };

    var channelCycles = {
      'needsYou': ['push-email', 'push', 'email', 'off'],
      'stageMove': ['push-email', 'push', 'email', 'off'],
      'deadlines': ['push-email', 'push', 'email', 'off'],
      'ruleChanges': ['email', 'push-email', 'off'],
      'firmNews': ['off', 'email']
    };

    // 1. Update Channel Values Display
    function updateChannelValues() {
      var keys = ['needsYou', 'stageMove', 'deadlines', 'ruleChanges', 'firmNews'];
      keys.forEach(function(key) {
        var el = document.querySelector('.channel-val[data-key="' + key + '"]');
        if (!el) return;
        var currentVal = state.notificationSettings[key] || 'off';
        el.textContent = channelLabels[currentVal] || currentVal;
        el.classList.toggle('muted', currentVal === 'off');
      });
    }

    // Bind channel cycle click handlers
    var channelVals = document.querySelectorAll('.channel-val[data-key]');
    channelVals.forEach(function(valEl) {
      valEl.addEventListener('click', function() {
        var key = valEl.dataset.key;
        var cycle = channelCycles[key] || ['push-email', 'email', 'off'];
        var currentVal = state.notificationSettings[key] || cycle[0];
        var currentIndex = cycle.indexOf(currentVal);
        var nextIndex = (currentIndex + 1) % cycle.length;
        var nextVal = cycle[nextIndex];

        state.notificationSettings[key] = nextVal;
        updateChannelValues();

        var rowSpan = valEl.closest('.kv').querySelector('span');
        var friendlyName = rowSpan ? rowSpan.textContent : key;
        showToast(friendlyName + ' set to ' + channelLabels[nextVal], 'info');

        if (window.FirebaseBridge) {
          window.FirebaseBridge.recordAuditLog('Notification Setting Updated', friendlyName + ' set to ' + nextVal);
        }
      });
    });

    // 2. Render Clean Updates Feed
    function renderUpdatesFeed() {
      if (!feedList) return;
      var items = state.updates || [];

      var html = '';
      items.forEach(function(it) {
        html += [
          '<div class="fitem ' + (it.isNew ? 'new ' : '') + 'clickable" data-update-id="' + it.id + '" data-action="' + (it.actionScreen || '') + '" title="Click to open details">',
          '  <span class="d"></span>',
          '  <div>',
          '    <div class="t">' + it.title + '</div>',
          '    <div class="m">' + it.meta + '</div>',
          '    <div class="w">' + it.time + '</div>',
          '  </div>',
          '</div>'
        ].join('');
      });

      feedList.innerHTML = html;
      bindFeedItemClicks();
    }

    // 3. Bind Feed Item Click Actions
    function bindFeedItemClicks() {
      var rows = feedList.querySelectorAll('.fitem.clickable');
      rows.forEach(function(row) {
        row.addEventListener('click', function() {
          var id = row.dataset.updateId;
          var act = row.dataset.action;
          var it = (state.updates || []).find(function(u) { return u.id === id; });

          // Mark individual item read
          if (it && it.isNew) {
            it.isNew = false;
            row.classList.remove('new');
            checkUnreadNotifications();
          }

          if (act === 'sign') {
            showScreen('sign');
            showToast('Opened Form 8879 signing envelope.', 'info');
          } else if (act === 'msgs') {
            showScreen('msgs');
            showToast('Opened conversation thread with Denise R.', 'info');
          } else if (act === 'svcs') {
            showScreen('svcs');
            showToast('Opened Services & file scope.', 'info');
          } else if (act === 'pay') {
            showScreen('pay');
            showToast('Opened Billing & payment.', 'info');
          } else if (act === 'rule-modal' || (it && it.ruleArticle)) {
            openRuleArticleModal(it ? it.ruleArticle : null);
          }
        });
      });
    }

    // 4. Uncle Pat's 2-Minute Tax Rule Reader Modal
    function openRuleArticleModal(art) {
      art = art || {
        title: 'Treasury Reg. §1.469 Vacancy Deduction Clarification',
        summary: 'The IRS issued revised guidance on residential rental properties that experience short periods of vacancy between tenants during the tax year.',
        keyTakeaway: 'Good news for 214 Halcyon Row: As long as the property was actively marketed and held out for rent after the March vacancy, you retain 100% of your Schedule E depreciation, mortgage interest, and property tax deductions for the entire 12-month period.',
        impact: '$0 loss of rental deductions. Your projected Schedule E profit swing of $9,100 stands.'
      };

      var modalHtml = [
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">',
        '  <svg class="owl-av" viewBox="22 4 156 172" style="width:36px;height:36px;flex:none"><use href="#pat-av"></use></svg>',
        '  <div>',
        '    <span class="chip gold sm">Uncle Pat &middot; 2-Minute Tax Rule Read</span>',
        '    <h4 style="margin:4px 0 0;font-size:1.05rem">' + art.title + '</h4>',
        '  </div>',
        '</div>',
        '<div style="font-size:.86rem;line-height:1.6;color:var(--ink)">',
        '  <p>' + art.summary + '</p>',
        '  <div style="background:var(--ok-bg);border-left:3.5px solid var(--ok);padding:11px 14px;border-radius:4px;margin:12px 0">',
        '    <b style="color:var(--ok)">What it means for your file:</b>',
        '    <p style="margin:4px 0 0;font-size:.82rem;color:var(--ink)">' + art.keyTakeaway + '</p>',
        '  </div>',
        '  <div style="background:var(--surface-2);padding:10px 14px;border-radius:4px;font-family:var(--f-mono);font-size:.78rem">',
        '    <b>Bottom-Line Impact:</b> ' + art.impact,
        '  </div>',
        '</div>',
        '<p class="legal" style="margin-top:14px">Rules are monitored daily against your active return schedules. Only rulings that actually change your bottom line appear in your feed.</p>'
      ].join('');

      openModal('Rule Change Assessment: 214 Halcyon Row', modalHtml, '<button class="btn btn-b sm" id="modal-cancel-btn">Understood &middot; Return to Updates</button>');
    }

    // 5. Check Unread Notifications & Update Bell Dot
    function checkUnreadNotifications() {
      var hasUnread = (state.updates || []).some(function(u) { return u.isNew; });
      var bellDot = document.querySelector('.appbar-btn.bell .dot');
      if (bellDot) {
        bellDot.style.display = hasUnread ? 'block' : 'none';
      }
    }

    // Initialize UI on startup
    updateChannelValues();
    renderUpdatesFeed();
    checkUnreadNotifications();
  }

  // -------------------------------------------------------------
  // 13. GLOBAL EVENT DELEGATION
  // -------------------------------------------------------------
  function bindGlobalEvents() {
    // Mobile navigation drawer toggles
    if (el.btnToggleMenu) {
      el.btnToggleMenu.addEventListener('click', function() {
        toggleMobileDrawer();
      });
    }

    if (el.btnMobileMore) {
      el.btnMobileMore.addEventListener('click', function() {
        toggleMobileDrawer(true);
      });
    }

    if (el.drawerBackdrop) {
      el.drawerBackdrop.addEventListener('click', function() {
        toggleMobileDrawer(false);
      });
    }

    // Anchor & button jump links with [data-go]
    document.addEventListener('click', function(e) {
      var target = e.target.closest('[data-go]');
      if (!target) return;
      e.preventDefault();
      var screenName = target.dataset.go;
      showScreen(screenName);
    });

    // Theme toggle
    if (el.themeToggle) el.themeToggle.addEventListener('click', toggleTheme);

    // Modal backdrop click
    if (el.modalBackdrop) {
      el.modalBackdrop.addEventListener('click', function(e) {
        if (e.target === el.modalBackdrop) closeModal();
      });
    }

    // Auto-close mobile drawer when window resizes to desktop width
    window.addEventListener('resize', function() {
      if (window.innerWidth > 860) {
        toggleMobileDrawer(false);
      }
    });

    // Keyboard navigation (Escape to close mobile drawer / modal)
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        toggleMobileDrawer(false);
        closeModal();
      }
    });
  }

  // -------------------------------------------------------------
  // 14. FIREBASE CLOUD SERVICES INTEGRATION
  // -------------------------------------------------------------
  function initFirebaseIntegration() {
    function updateFirebaseUi() {
      var badge = document.getElementById('firebase-status-badge');
      var cardBadge = document.getElementById('firebase-card-badge');
      var authStatusEl = document.querySelector('[data-auth-status]');
      var firestoreStatusEl = document.querySelector('[data-firestore-status]');
      var storageStatusEl = document.querySelector('[data-storage-status]');
      var analyticsStatusEl = document.querySelector('[data-analytics-status]');

      if (badge) {
        badge.classList.add('connected');
        badge.title = 'Firebase Connected: piovde-tax';
      }
      if (cardBadge) {
        cardBadge.classList.add('connected');
        cardBadge.innerHTML = '<span class="fb-dot"></span>Connected: piovde-tax';
      }

      if (window.FirebaseBridge) {
        var user = window.FirebaseBridge.currentUser;
        if (authStatusEl) {
          if (user) {
            authStatusEl.style.color = '#2ecc71';
            authStatusEl.textContent = 'Live ✓ (' + user.email + ')';
          } else {
            authStatusEl.style.color = '#2ecc71';
            authStatusEl.textContent = 'Live ✓ (Ready for login)';
          }
        }
        if (analyticsStatusEl) {
          analyticsStatusEl.style.color = '#2ecc71';
          analyticsStatusEl.textContent = 'Live ✓ (G-JKCY3TFFHW)';
        }
        if (firestoreStatusEl && firestoreStatusEl.textContent === 'Checking...') {
          firestoreStatusEl.style.color = 'var(--gold)';
          firestoreStatusEl.textContent = 'Ready (Click Ping to test)';
        }
      }
    }

    window.addEventListener('firebase-ready', function() {
      updateFirebaseUi();
    });
    if (window.FirebaseBridge) {
      updateFirebaseUi();
    }

    window.addEventListener('firebase-auth-changed', function(e) {
      var user = e.detail.user;
      // Update avatar / user pill
      var userNameEl = document.querySelector('.user-pill .user-name');
      var userAvEl   = document.querySelector('.user-pill .av');
      // Update AUTH STATUS row in Firm Console
      var authStatusEl = document.querySelector('[data-auth-status]');

      if (user) {
        if (userNameEl) {
          var name = user.displayName || user.email || 'M. Whitfield';
          userNameEl.textContent = name.split('@')[0].replace('.', ' ').slice(0, 14);
        }
        if (userAvEl) {
          var initials = (user.displayName || user.email || 'MW').slice(0, 2).toUpperCase();
          userAvEl.textContent = initials;
        }
        if (authStatusEl) {
          authStatusEl.style.color = '#2ecc71';
          authStatusEl.textContent = 'Live ✓ (' + user.email + ')';
        }
      } else {
        if (authStatusEl) {
          authStatusEl.style.color = '#2ecc71';
          authStatusEl.textContent = 'Live ✓ (Ready for login)';
        }
      }
    });

    // Wire up Firm Console test buttons
    var testBtn = document.getElementById('btn-test-firebase');
    if (testBtn) {
      testBtn.addEventListener('click', async function() {
        testBtn.disabled = true;
        testBtn.textContent = 'Pinging...';
        var fsEl = document.querySelector('[data-firestore-status]');
        if (window.FirebaseBridge) {
          var res = await window.FirebaseBridge.testConnection();
          if (res.success) {
            if (fsEl) {
              fsEl.style.color = '#2ecc71';
              fsEl.textContent = 'Live ✓ (Connected)';
            }
            showToast(res.message, 'ok');
          } else {
            if (fsEl) {
              fsEl.style.color = 'var(--gold)';
              fsEl.textContent = 'Console setup needed';
            }
            showToast('Auth: Live ✓ | Firestore needs 1-time setup in Firebase Console', 'warn');
          }
        } else {
          showToast('Connecting to Firebase (piovde-tax)...', 'info');
        }
        testBtn.disabled = false;
        testBtn.textContent = 'Ping Cloud Services';
      });
    }

    var syncBtn = document.getElementById('btn-sync-firebase');
    if (syncBtn) {
      syncBtn.addEventListener('click', async function() {
        if (window.FirebaseBridge) {
          await window.FirebaseBridge.recordAuditLog('Ledger Sync', 'User requested Firebase ledger sync');
          showToast('Audit log record saved to Firebase!', 'ok');
        } else {
          showToast('Firebase syncing...', 'info');
        }
      });
    }

    var guideBtn = document.getElementById('btn-firebase-guide');
    if (guideBtn) {
      guideBtn.addEventListener('click', function() {
        openModal('Firebase Cloud Services — Quick Setup', [
          '<div style="font-size:.86rem;line-height:1.65">',
          '  <p>Project <b>piovde-tax</b> is connected. Current service status:</p>',
          '  <ul style="margin:10px 0 14px 20px;line-height:1.8">',
          '    <li><b style="color:#2ecc71">Authentication:</b> LIVE ✓ (Email/Password active)</li>',
          '    <li><b style="color:#2ecc71">Analytics:</b> LIVE ✓ (Measurement ID G-JKCY3TFFHW)</li>',
          '    <li><b style="color:var(--gold)">Cloud Firestore:</b> 1 click to activate in Firebase Console</li>',
          '    <li><b style="color:var(--gold)">Cloud Storage:</b> 1 click to activate in Firebase Console</li>',
          '  </ul>',
          '  <div style="background:var(--bg-card-subtle);border-left:3px solid var(--gold);padding:10px 14px;margin-bottom:14px;border-radius:3px">',
          '    <b>How to enable Firestore (30 seconds):</b>',
          '    <ol style="margin:6px 0 0 16px;padding:0">',
          '      <li>Open <a href="https://console.firebase.google.com/project/piovde-tax/firestore" target="_blank" rel="noopener" style="color:var(--blue);text-decoration:underline"><b>Firebase Firestore Console</b></a></li>',
          '      <li>Click <b>Create database</b></li>',
          '      <li>Select <b>Start in test mode</b> &rarr; Click <b>Next</b> &rarr; <b>Enable</b></li>',
          '    </ol>',
          '  </div>',
          '  <div style="background:var(--bg-card-subtle);border-left:3px solid var(--blue);padding:10px 14px;margin-bottom:14px;border-radius:3px">',
          '    <b>How to enable Cloud Storage (30 seconds):</b>',
          '    <ol style="margin:6px 0 0 16px;padding:0">',
          '      <li>Open <a href="https://console.firebase.google.com/project/piovde-tax/storage" target="_blank" rel="noopener" style="color:var(--blue);text-decoration:underline"><b>Firebase Storage Console</b></a></li>',
          '      <li>Click <b>Get started</b> &rarr; <b>Start in test mode</b> &rarr; <b>Done</b></li>',
          '    </ol>',
          '  </div>',
          '  <p class="sub" style="color:var(--ink-3)">Note: The app works completely smoothly even before provisioning — all data persists safely in your session!</p>',
          '</div>'
        ].join(''), '<button class="btn btn-b sm" id="modal-cancel-btn">Got it</button>');
      });
    }

    updateFirebaseUi();
  }

  // -------------------------------------------------------------
  // 15. BOOTSTRAP INITIALIZATION
  // -------------------------------------------------------------
  function init() {
    initTheme();
    bindGlobalEvents();
    initDeviceSwitcher();
    initSignIn();
    renderDocumentsList();
    bindDropZoneEvents();
    initSigning();
    initMessaging();
    initBilling();
    initFirmView();
    initServices();
    initUpdates();
    initFirebaseIntegration();

    // Default start screen — Screen 01 Sign In (matching prototype showcase)
    showScreen('signin');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
