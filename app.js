(function () {
  'use strict';

  const cfg = window.ARIVE_CONFIG || {};
  const SCRIPT_URL = cleanUrl(cfg.WEB_APP_URL || cfg.APPS_SCRIPT_URL || cfg.GOOGLE_SCRIPT_URL || '');
  const SHEET_URL = cfg.GOOGLE_SHEET_URL || cfg.SHEET_URL || 'https://docs.google.com/spreadsheets/d/1nZZrP-5gtEjAUbKmVSPSiYmQIRrUXaXQ6jucodH1gic/edit';

  const state = { plans: [], changes: [], selected: null, typeOptions: [] };

  const els = {
    status: $('#statusBanner'),
    sheetLink: $('#sheetLink'),
    refreshBtn: $('#refreshBtn'),
    planList: $('#planList'),
    details: $('#detailsPanel'),
    search: $('#searchBox'),
    statusFilter: $('#statusFilter'),
    typeFilter: $('#typeFilter'),
    statPlans: $('#statPlans'),
    statChanges: $('#statChanges'),
    statOpen: $('#statOpen'),
    statComplete: $('#statComplete'),
    modal: $('#modalBackdrop'),
    form: $('#changeForm'),
    closeModal: $('#closeModal'),
    cancelBtn: $('#cancelBtn'),
    archiveBtn: $('#archiveBtn')
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    els.sheetLink.href = SHEET_URL;
    els.refreshBtn.addEventListener('click', () => loadData(true));
    els.search.addEventListener('input', renderPlans);
    els.statusFilter.addEventListener('change', renderPlans);
    els.typeFilter.addEventListener('change', renderPlans);
    els.closeModal.addEventListener('click', closeModal);
    els.cancelBtn.addEventListener('click', closeModal);
    els.modal.addEventListener('click', e => { if (e.target === els.modal) closeModal(); });
    els.form.addEventListener('submit', saveChange);
    els.archiveBtn.addEventListener('click', archiveCurrentChange);
    loadData(false);
  }

  async function loadData(manual) {
    if (!SCRIPT_URL || SCRIPT_URL.includes('PASTE_YOUR_WORKING')) {
      setStatus('error', 'Missing Apps Script URL. Open config.js and paste your working /exec URL into APPS_SCRIPT_URL, GOOGLE_SCRIPT_URL, and WEB_APP_URL.');
      return;
    }
    setStatus('info', manual ? 'Refreshing live data...' : 'Loading live data...');
    try {
      const data = await jsonp(SCRIPT_URL, { action: 'list', t: Date.now() }, 20000);
      if (!data || data.ok === false || data.success === false) throw new Error(data && data.error ? data.error : 'Apps Script returned an error.');
      const rawPlans = firstArray(data.plans, data.floorplans, data.floorPlans);
      const rawChanges = firstArray(data.changes, data.changeLog, []);
      if (!Array.isArray(rawPlans)) throw new Error('Apps Script did not return a plans array.');
      state.plans = rawPlans.map(normalizePlan).filter(p => p.name).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      state.changes = rawChanges.map(normalizeChange).filter(c => c.floorplan && isActive(c));
      state.typeOptions = [...new Set(state.changes.map(c => c.changeType).filter(Boolean))].sort();
      if (!state.selected && state.plans.length) state.selected = state.plans[0].name;
      populateTypeFilter();
      renderAll();
      setStatus(`Live data loaded from Google Sheet. ${state.plans.length} plans found.`, 'success');
      setStatus(`Live data loaded from Google Sheet. ${plans.length} plans found.`, 'success');
    } catch (err) {
      console.error(err);
      setStatus('error', `Could not load live data. ${err.message || err}. Open debug.html to test the Apps Script URL.`);
      state.plans = [];
      state.changes = [];
      renderAll();
    }
  }

  function populateTypeFilter() {
    const current = els.typeFilter.value || 'all';
    els.typeFilter.innerHTML = '<option value="all">All change types</option>' + state.typeOptions.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    els.typeFilter.value = state.typeOptions.includes(current) ? current : 'all';
  }

  function renderAll() {
    renderStats();
    renderPlans();
    renderDetails();
  }

  function renderStats() {
    els.statPlans.textContent = state.plans.length;
    els.statChanges.textContent = activeChanges().length;
    els.statOpen.textContent = activeChanges().filter(c => !isCompleteStatus(c.status)).length;
    els.statComplete.textContent = activeChanges().filter(c => isCompleteStatus(c.status)).length;
  }

  function renderPlans() {
    const q = els.search.value.trim().toLowerCase();
    const status = els.statusFilter.value;
    const type = els.typeFilter.value;
    const list = state.plans.filter(plan => {
      const changes = changesFor(plan.name);
      const textMatch = !q || plan.name.toLowerCase().includes(q) || plan.agentNotes.toLowerCase().includes(q);
      const statusMatch = status === 'all' ||
        (status === 'open' && changes.some(c => !isCompleteStatus(c.status))) ||
        (status === 'complete' && changes.length && changes.every(c => isCompleteStatus(c.status))) ||
        (status === 'none' && !changes.length);
      const typeMatch = type === 'all' || changes.some(c => c.changeType === type);
      return textMatch && statusMatch && typeMatch;
    });

    if (!state.plans.length) {
      els.planList.innerHTML = '<div class="empty-state"><strong>No live data</strong><span>The site is not connected to Google Sheets yet.</span></div>';
      return;
    }
    if (!list.length) {
      els.planList.innerHTML = '<div class="empty-state"><strong>No matching plans</strong><span>Try clearing the search or filters.</span></div>';
      return;
    }
    els.planList.innerHTML = list.map(plan => {
      const changes = changesFor(plan.name);
      return `<button class="plan-card ${state.selected === plan.name ? 'active' : ''}" data-plan="${escapeHtml(plan.name)}" type="button">
        <div><div class="plan-title">${escapeHtml(plan.name)}</div><div class="plan-sub">${changes.length} change${changes.length === 1 ? '' : 's'} • Total sales: ${escapeHtml(plan.totalSales || '0')}</div></div>
      </button>`;
    }).join('');
    $$('.plan-card', els.planList).forEach(btn => btn.addEventListener('click', () => { state.selected = btn.dataset.plan; renderAll(); }));
  }

  function renderDetails() {
    const plan = state.plans.find(p => p.name === state.selected);
    if (!plan) {
      els.details.innerHTML = '<div class="empty-main"><div class="empty-icon">⌂</div><h2>No plan selected</h2><p>Select a floorplan on the left to view its change history.</p></div>';
      return;
    }
    const changes = changesFor(plan.name).sort((a, b) => String(b.changeDate).localeCompare(String(a.changeDate)) || String(b.lastUpdated).localeCompare(String(a.lastUpdated)));
    els.details.innerHTML = `<div class="plan-detail-head">
      <div><div class="eyebrow">FLOORPLAN</div><h2 class="plan-detail-title">${escapeHtml(plan.name)}</h2><p>${escapeHtml(changes.length ? `${changes.length} logged change${changes.length === 1 ? '' : 's'}` : 'No changes logged yet')}</p></div>
      <div class="detail-actions"><button id="addChangeBtn" class="btn primary" type="button">+ Add Change</button></div>
    </div>
    <div class="detail-grid">
      <div class="info-card"><h3>Sales Agent Notes</h3><p>${escapeHtml(plan.agentNotes || 'No sales agent notes listed.')}</p></div>
      <div class="info-card"><h3>Sales History</h3><div class="sales-row">
        ${salesPill('2025', plan.sales2025)}${salesPill('2024', plan.sales2024)}${salesPill('2023', plan.sales2023)}${salesPill('Total', plan.totalSales)}
      </div></div>
    </div>
    <div class="info-card"><h3>Change History</h3>${changes.length ? `<div class="change-list">${changes.map(changeCard).join('')}</div>` : '<div class="empty-state"><strong>No changes logged</strong><span>Click Add Change to create the first record for this floorplan.</span></div>'}</div>`;
    $('#addChangeBtn').addEventListener('click', () => openModal(plan.name));
    $$('.edit-change', els.details).forEach(btn => btn.addEventListener('click', () => {
      const c = state.changes.find(x => x.id === btn.dataset.id);
      if (c) openModal(plan.name, c);
    }));
  }

  function salesPill(label, value) { return `<div class="sales-pill"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '0')}</strong></div>`; }

  function changeCard(c) {
    const status = mapStatusForSelect(c.status);
    const klass = status === 'Complete' ? 'complete' : status === 'Curtis Design' ? 'design' : 'purchasing';
    return `<article class="change-card ${klass}">
      <div class="change-top">
        <div><div class="change-title">${escapeHtml(c.description || '(No description)')}</div><div class="meta"><span>${escapeHtml(c.changeDate || 'No date')}</span><span>${escapeHtml(c.changeType || 'Other')}</span>${c.costImpact ? `<span>${escapeHtml(c.costImpact)}</span>` : ''}</div></div>
        <button class="btn ghost edit-change" data-id="${escapeHtml(c.id)}" type="button">Edit</button>
      </div>
      <div class="note-block"><span class="status-chip ${klass}">${escapeHtml(status)}</span>${c.notes ? `<p><strong>Notes:</strong> ${escapeHtml(c.notes)}</p>` : '<p><strong>Notes:</strong> No notes added yet.</p>'}</div>
      ${c.reason ? `<p><strong>Reason:</strong> ${escapeHtml(c.reason)}</p>` : ''}
      <div class="meta"><span>Requested: ${escapeHtml(c.requestedBy || 'N/A')}</span><span>Approved: ${escapeHtml(c.approvedBy || 'N/A')}</span><span>Plan Set: ${escapeHtml(c.planSetUpdated || 'No')}</span><span>Pricing: ${escapeHtml(c.pricingUpdated || 'No')}</span><span>Option: ${escapeHtml(c.optionUpdated || 'No')}</span></div>
    </article>`;
  }

  function openModal(floorplan, change) {
    $('#formTitle').textContent = change ? `Edit ${floorplan} Change` : `Add ${floorplan} Change`;
    $('#changeId').value = change ? change.id : '';
    $('#formFloorplan').value = floorplan;
    $('#changeDate').value = change ? toInputDate(change.changeDate) : new Date().toISOString().slice(0,10);
    $('#changeType').value = change ? (change.changeType || 'Design') : 'Design';
    $('#status').value = mapStatusForSelect(change ? change.status : 'Purchasing');
    $('#costImpact').value = change ? (change.costImpact || '') : '';
    $('#description').value = change ? (change.description || '') : '';
    $('#reason').value = change ? (change.reason || '') : '';
    $('#requestedBy').value = change ? (change.requestedBy || '') : '';
    $('#approvedBy').value = change ? (change.approvedBy || '') : '';
    $('#planSetUpdated').value = change ? (change.planSetUpdated || 'No') : 'No';
    $('#pricingUpdated').value = change ? (change.pricingUpdated || 'No') : 'No';
    $('#optionUpdated').value = change ? (change.optionUpdated || 'No') : 'No';
    $('#notes').value = change ? (change.notes || '') : '';
    els.archiveBtn.hidden = !change;
    els.modal.hidden = false;
    setTimeout(() => $('#description').focus(), 50);
  }

  function closeModal() { els.modal.hidden = true; }

  function saveChange(event) {
    event.preventDefault();
    if (!SCRIPT_URL || SCRIPT_URL.includes('PASTE_YOUR_WORKING')) { alert('Paste your Apps Script URL in config.js first.'); return; }
    const payload = formPayload('saveChange');
    if (!payload.changeId) payload.changeId = localChangeId(payload.floorplan);
    postToScript(payload);
    upsertLocal(normalizeChange(payload));
    closeModal();
    renderAll();
    setStatus('info', 'Saving to Google Sheet... wait a few seconds, then click Refresh to confirm.');
    setTimeout(() => loadData(true), 2200);
  }

  function archiveCurrentChange() {
    const id = $('#changeId').value;
    if (!id) return;
    if (!confirm('Archive this change? It will be hidden from the dashboard but remain in the sheet.')) return;
    postToScript({ action: 'archiveChange', changeId: id, id });
    state.changes = state.changes.filter(c => c.id !== id);
    closeModal();
    renderAll();
    setStatus('info', 'Archiving in Google Sheet... wait a few seconds, then click Refresh to confirm.');
    setTimeout(() => loadData(true), 2200);
  }

  function formPayload(action) {
    const data = Object.fromEntries(new FormData(els.form).entries());
    data.action = action;
    data.id = data.changeId;
    return data;
  }

  function postToScript(payload) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = SCRIPT_URL;
    form.target = 'postFrame';
    form.style.display = 'none';
    const fields = { ...payload, payload: JSON.stringify(payload) };
    Object.entries(fields).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v == null ? '' : String(v);
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    setTimeout(() => form.remove(), 1000);
  }

  function jsonp(url, params, timeoutMs) {
    return new Promise((resolve, reject) => {
      const cb = 'ariveCb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      const timer = setTimeout(() => cleanup(() => reject(new Error('Unable to reach Apps Script.'))), timeoutMs || 15000);
      window[cb] = data => cleanup(() => resolve(data));
      const fullUrl = new URL(url);
      Object.entries(params || {}).forEach(([k, v]) => fullUrl.searchParams.set(k, v));
      fullUrl.searchParams.set('callback', cb);
      script.src = fullUrl.toString();
      script.async = true;
      script.onerror = () => cleanup(() => reject(new Error('Apps Script blocked the request. Check browser/account permissions and the /exec URL.')));
      function cleanup(done) { clearTimeout(timer); try { delete window[cb]; } catch(e) { window[cb] = undefined; } script.remove(); done(); }
      document.head.appendChild(script);
    });
  }

  function normalizePlan(p) {
    const name = String(p.name || p.floorplan || p.plan || '').trim();
    return {
      id: slug(name),
      order: Number(p.order || p.sortOrder || 9999),
      name,
      sales2025: val(p.sales2025),
      sales2024: val(p.sales2024),
      sales2023: val(p.sales2023),
      totalSales: val(p.totalSales || p.total),
      agentNotes: String(p.agentNotes || p.notes || '')
    };
  }

  function normalizeChange(c) {
    return {
      id: String(c.id || c.changeId || '').trim(),
      floorplan: String(c.floorplan || c.plan || '').trim(),
      changeDate: String(c.changeDate || c.date || '').trim(),
      changeType: String(c.changeType || c.type || 'Other').trim(),
      description: String(c.description || c.changeDescription || '').trim(),
      reason: String(c.reason || '').trim(),
      requestedBy: String(c.requestedBy || '').trim(),
      approvedBy: String(c.approvedBy || '').trim(),
      status: String(c.status || 'Purchasing').trim(),
      costImpact: String(c.costImpact || '').trim(),
      planSetUpdated: String(c.planSetUpdated || '').trim(),
      pricingUpdated: String(c.pricingUpdated || '').trim(),
      optionUpdated: String(c.optionUpdated || '').trim(),
      notes: String(c.notes || '').trim(),
      lastUpdated: String(c.lastUpdated || '').trim(),
      active: String(c.active || 'Yes').trim()
    };
  }

  function activeChanges() { return state.changes.filter(isActive); }
  function changesFor(name) { const n = String(name).toLowerCase(); return activeChanges().filter(c => c.floorplan.toLowerCase() === n); }
  function isActive(c) { return !/^no|false|0|archived$/i.test(String(c.active || 'Yes').trim()); }
  function isCompleteStatus(s) { return /^complete$/i.test(String(s || '').trim()); }
  function mapStatusForSelect(status) {
    const s = String(status || '').trim().toLowerCase();
    if (s === 'complete' || s === 'approved') return 'Complete';
    if (s === 'curtis design' || s === 'design' || s === 'in review') return 'Curtis Design';
    return 'Purchasing';
  }
  function upsertLocal(c) { const i = state.changes.findIndex(x => x.id === c.id); if (i >= 0) state.changes[i] = c; else state.changes.push(c); }
  function localChangeId(plan) { return 'CHG-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + slug(plan).slice(0,3).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase(); }
  function cleanUrl(u) { return String(u || '').trim().replace(/\?$/, ''); }
  function firstArray(...items) { return items.find(Array.isArray); }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item'; }
  function val(v) { return v == null || v === '' ? '' : String(v); }
  function toInputDate(v) { const s = String(v || '').trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = new Date(s); return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0,10) : d.toISOString().slice(0,10); }
  function setStatus(type, msg) { els.status.className = 'status-banner ' + type; els.status.textContent = msg; }
  function escapeHtml(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return [...(root || document).querySelectorAll(sel)]; }
})();
