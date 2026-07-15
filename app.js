const cfg = window.ARIVE_CONFIG || {};
const STATUSES = ["Not Started", "In Review", "Approved Change", "No Change", "Complete"];
const STORAGE_KEY = "ariveBasePlanReviewData.v3";
let plans = [];
let selected = null;
let search = "";
let statusFilter = "All";

const $ = (id) => document.getElementById(id);

function emptyReview() {
  return {
    reviewStatus: "Not Started",
    meetingDate: "",
    changesDiscussed: "",
    decision: "",
    owner: "",
    nextAction: "",
    finalNotes: ""
  };
}

function normalizePlan(p, i) {
  return {
    id: p.id || slug(p.name || `plan-${i}`),
    order: Number(p.order || i + 1),
    name: p.name || "Unnamed Plan",
    agentNotes: p.agentNotes || p.salesAgentNotes || "",
    sales2025: Number(p.sales2025 || 0),
    sales2024: Number(p.sales2024 || 0),
    sales2023: Number(p.sales2023 || 0),
    total: Number(p.total || 0),
    ...emptyReview(),
    ...(p.review || {}),
    reviewStatus: p.reviewStatus || p.status || (p.review && p.review.reviewStatus) || "Not Started",
    meetingDate: p.meetingDate || (p.review && p.review.meetingDate) || "",
    changesDiscussed: p.changesDiscussed || (p.review && p.review.changesDiscussed) || "",
    decision: p.decision || (p.review && p.review.decision) || "",
    owner: p.owner || (p.review && p.review.owner) || "",
    nextAction: p.nextAction || (p.review && p.review.nextAction) || "",
    finalNotes: p.finalNotes || (p.review && p.review.finalNotes) || ""
  };
}

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function localLoad() {
  const base = (window.ARIVE_SAMPLE_PLANS || []).map(normalizePlan);
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  return base.map(p => ({ ...p, ...(saved[p.id] || {}) }));
}

function localSave(plan) {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  saved[plan.id] = {
    reviewStatus: plan.reviewStatus,
    meetingDate: plan.meetingDate,
    changesDiscussed: plan.changesDiscussed,
    decision: plan.decision,
    owner: plan.owner,
    nextAction: plan.nextAction,
    finalNotes: plan.finalNotes
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function jsonp(url, params = {}) {
  return new Promise((resolve, reject) => {
    const cb = `ariveCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const qs = new URLSearchParams({ ...params, callback: cb });
    const script = document.createElement("script");
    window[cb] = (data) => {
      delete window[cb];
      script.remove();
      resolve(data);
    };
    script.onerror = () => {
      delete window[cb];
      script.remove();
      reject(new Error("Could not load Google Sheet data"));
    };
    script.src = `${url}${url.includes("?") ? "&" : "?"}${qs.toString()}`;
    document.body.appendChild(script);
  });
}

async function remoteLoad() {
  if (!cfg.WEB_APP_URL) return localLoad();
  try {
    const data = await jsonp(cfg.WEB_APP_URL, { action: "list" });
    if (!data || !Array.isArray(data.plans)) throw new Error("Bad data shape");
    return data.plans.map(normalizePlan).sort((a,b) => a.order - b.order);
  } catch (err) {
    showToast("Using preview data until the Sheet connection is fixed");
    console.warn(err);
    return localLoad();
  }
}

function remoteSave(plan) {
  if (!cfg.WEB_APP_URL) {
    localSave(plan);
    return;
  }
  const form = document.createElement("form");
  form.method = "POST";
  form.action = cfg.WEB_APP_URL;
  form.target = "postFrame";
  form.style.display = "none";
  const payload = {
    action: "update",
    id: plan.id,
    name: plan.name,
    reviewStatus: plan.reviewStatus,
    meetingDate: plan.meetingDate,
    changesDiscussed: plan.changesDiscussed,
    decision: plan.decision,
    owner: plan.owner,
    nextAction: plan.nextAction,
    finalNotes: plan.finalNotes
  };
  Object.entries(payload).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.name = key;
    input.value = value || "";
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  setTimeout(() => form.remove(), 1000);
}

function init() {
  $("sheetLink").href = cfg.SHEET_URL || "#";
  STATUSES.forEach(s => {
    const opt = document.createElement("option"); opt.value = s; opt.textContent = s; $("reviewStatus").appendChild(opt);
  });
  $("searchInput").addEventListener("input", e => { search = e.target.value.toLowerCase(); render(); });
  $("statusFilter").addEventListener("change", e => { statusFilter = e.target.value; render(); });
  $("reviewStatus").addEventListener("change", e => { updateSelected({ reviewStatus: e.target.value }, true); });
  $("reviewForm").addEventListener("submit", e => { e.preventDefault(); saveForm(); });
  $("clearBtn").addEventListener("click", clearSelected);
  $("refreshBtn").addEventListener("click", load);
  $("exportBtn").addEventListener("click", exportCsv);
  load();
}

async function load() {
  setSaveState("Loading", "saving");
  plans = await remoteLoad();
  if (!selected && plans.length) selected = plans[0].id;
  setSaveState("Ready", "");
  render();
}

function visiblePlans() {
  return plans.filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search) || (p.agentNotes || "").toLowerCase().includes(search);
    const matchesStatus = statusFilter === "All" || p.reviewStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });
}

function render() {
  $("planCount").textContent = `${plans.length} plans`;
  const list = $("planList");
  list.innerHTML = "";
  visiblePlans().forEach(plan => {
    const row = document.createElement("div");
    row.className = `plan-row ${plan.id === selected ? "active" : ""} ${plan.reviewStatus === "Complete" ? "complete" : ""}`;
    row.title = plan.agentNotes || "No sales agent notes listed";
    row.addEventListener("click", (e) => {
      if (e.target.tagName.toLowerCase() === "select") return;
      selected = plan.id;
      render();
    });
    const name = document.createElement("div");
    name.className = "plan-name";
    name.innerHTML = `${escapeHtml(plan.name)}${plan.agentNotes ? '<span class="plan-note-dot"></span>' : ''}`;
    const select = document.createElement("select");
    STATUSES.forEach(s => {
      const opt = document.createElement("option"); opt.value = s; opt.textContent = s; select.appendChild(opt);
    });
    select.value = plan.reviewStatus;
    select.addEventListener("change", () => updatePlan(plan.id, { reviewStatus: select.value }, true));
    row.append(name, select);
    list.appendChild(row);
  });
  renderSelected();
  renderSnapshot();
}

function renderSelected() {
  const plan = getSelected();
  const disabled = !plan;
  ["reviewStatus","meetingDate","owner","changesDiscussed","decision","nextAction","finalNotes"].forEach(id => $(id).disabled = disabled);
  if (!plan) return;
  $("selectedPlanName").textContent = plan.name;
  $("selectedAgentNotes").textContent = plan.agentNotes || "No sales agent notes listed for this plan.";
  $("reviewStatus").value = plan.reviewStatus;
  $("meetingDate").value = plan.meetingDate || "";
  $("owner").value = plan.owner || "";
  $("changesDiscussed").value = plan.changesDiscussed || "";
  $("decision").value = plan.decision || "";
  $("nextAction").value = plan.nextAction || "";
  $("finalNotes").value = plan.finalNotes || "";
}

function renderSnapshot() {
  $("completeCount").textContent = plans.filter(p => p.reviewStatus === "Complete").length;
  $("reviewCount").textContent = plans.filter(p => p.reviewStatus === "In Review").length;
  const active = plans.filter(hasActiveNotes);
  $("activeCount").textContent = active.length;
  const wrap = $("activityList");
  wrap.innerHTML = "";
  if (!active.length) {
    wrap.innerHTML = '<p>No meeting changes logged yet. Select a floorplan and add notes to begin.</p>';
    return;
  }
  active.forEach(p => {
    const card = document.createElement("div");
    card.className = `activity-card ${p.reviewStatus === "Complete" ? "complete" : ""}`;
    card.innerHTML = `<strong>${escapeHtml(p.name)}</strong><span class="status-chip">${escapeHtml(p.reviewStatus)}</span>
      <p>${escapeHtml(p.changesDiscussed || p.decision || p.nextAction || "Notes started")}</p>
      ${p.owner ? `<p><b>Owner:</b> ${escapeHtml(p.owner)}</p>` : ""}`;
    card.addEventListener("click", () => { selected = p.id; render(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    wrap.appendChild(card);
  });
}

function hasActiveNotes(p) {
  return Boolean(p.changesDiscussed || p.decision || p.owner || p.nextAction || p.finalNotes || p.meetingDate || p.reviewStatus !== "Not Started");
}

function getSelected() { return plans.find(p => p.id === selected); }

function updateSelected(patch, saveNow = false) {
  const plan = getSelected();
  if (!plan) return;
  updatePlan(plan.id, patch, saveNow);
}

function updatePlan(id, patch, saveNow = false) {
  const idx = plans.findIndex(p => p.id === id);
  if (idx === -1) return;
  plans[idx] = { ...plans[idx], ...patch };
  if (saveNow) persist(plans[idx]);
  render();
}

function saveForm() {
  const plan = getSelected();
  if (!plan) return;
  const patch = {
    reviewStatus: $("reviewStatus").value,
    meetingDate: $("meetingDate").value,
    owner: $("owner").value,
    changesDiscussed: $("changesDiscussed").value,
    decision: $("decision").value,
    nextAction: $("nextAction").value,
    finalNotes: $("finalNotes").value
  };
  Object.assign(plan, patch);
  persist(plan);
  render();
}

function persist(plan) {
  setSaveState("Saving", "saving");
  remoteSave(plan);
  setTimeout(() => {
    setSaveState("Saved", "saved");
    showToast("Saved plan update");
    setTimeout(() => setSaveState("Ready", ""), 1400);
  }, 450);
}

function clearSelected() {
  const plan = getSelected();
  if (!plan) return;
  Object.assign(plan, emptyReview());
  persist(plan);
  render();
}

function setSaveState(text, cls) {
  const el = $("saveState");
  el.textContent = text;
  el.className = `save-state ${cls || ""}`;
}

function showToast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

function escapeHtml(v) {
  return String(v || "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
}

function exportCsv() {
  const headers = ["Floorplan","Review Status","Meeting Date","Changes Discussed","Decision / Direction","Owner","Next Action","Final Notes","Sales Agent Notes"];
  const rows = plans.map(p => [p.name,p.reviewStatus,p.meetingDate,p.changesDiscussed,p.decision,p.owner,p.nextAction,p.finalNotes,p.agentNotes]);
  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "arive-base-plan-review.csv"; a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", init);
