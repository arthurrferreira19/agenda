// public/assets/js/userSettings.js
(function () {
  const token = API.getToken();
  if (!token) { location.href = "/user/login.html"; return; }

  const meName = document.getElementById("meName");
  const meEmail = document.getElementById("meEmail");
  const workStart = document.getElementById("workStart");
  const workEnd = document.getElementById("workEnd");
  const uiShowKpis = document.getElementById("uiShowKpis");
  const uiShowFilters = document.getElementById("uiShowFilters");

  const btnSave = document.getElementById("btnSave");
  const stateShell = document.getElementById("stateShell");

  const currentPassword = document.getElementById("currentPassword");
  const newPassword = document.getElementById("newPassword");
  const btnChangePassword = document.getElementById("btnChangePassword");

  const btnLogoutMobile = document.getElementById("btnLogoutMobile");

  // Templates
  const tplTitle = document.getElementById("tplTitle");
  const tplType = document.getElementById("tplType");
  const tplDuration = document.getElementById("tplDuration");
  const btnAddTpl = document.getElementById("btnAddTpl");
  const tplList = document.getElementById("tplList");

  function showState(type, msg) {
    if (!stateShell) return;
    if (!msg) { stateShell.innerHTML = ""; return; }
    stateShell.innerHTML = `
      <div class="alert alert-${type}" style="border-radius:14px;">
        ${msg}
      </div>
    `;
  }

  function getTemplates() {
    try { return JSON.parse(localStorage.getItem("mh_event_templates") || "[]") || []; } catch (_) { return []; }
  }
  function setTemplates(arr) {
    localStorage.setItem("mh_event_templates", JSON.stringify(arr || []));
  }
  function renderTemplates() {
    const arr = getTemplates();
    if (!tplList) return;
    if (!arr.length) {
      tplList.innerHTML = `<div class="text-muted">Nenhum template criado.</div>`;
      return;
    }
    tplList.innerHTML = `
      <div class="d-flex flex-column gap-2">
        ${arr.map((t, i) => `
          <div class="d-flex align-items-center justify-content-between gap-2 p-2 border rounded-3">
            <div>
              <div class="fw-semibold">${String(t.title||"Template")}</div>
              <div class="small text-muted">${String(t.eventType)} • ${Number(t.durationMin||60)} min</div>
            </div>
            <button class="btn btn-sm btn-outline-danger" data-del="${i}">
              <span class="d-inline-flex align-items-center gap-1"><i data-lucide="trash-2"></i> Remover</span>
            </button>
          </div>
        `).join("")}
      </div>
    `;
    tplList.querySelectorAll("[data-del]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const idx = Number(btn.getAttribute("data-del"));
        const next = getTemplates().filter((_,i)=>i!==idx);
        setTemplates(next);
        renderTemplates();
        window.MHIcons?.refresh?.();
      });
    });
    window.MHIcons?.refresh?.();
  }

  async function loadMe() {
    const data = await API.request("/api/users/me", { auth: true });
    const me = data?.me || {};
    if (meName) meName.value = me.name || "";
    if (meEmail) meEmail.value = me.email || "";

    const prefs = me.preferences || {};
    if (workStart) workStart.value = prefs.workHours?.start || "08:00";
    if (workEnd) workEnd.value = prefs.workHours?.end || "18:00";

    const ui = me.ui || {};
    if (uiShowKpis) uiShowKpis.checked = ui.showKpis !== false;
    if (uiShowFilters) uiShowFilters.checked = ui.showFilters !== false;

    // reminders checkboxes
    const reminders = Array.isArray(prefs.reminders) ? prefs.reminders.map(Number) : [15,30,60];
    document.querySelectorAll("#remindersWrap input[type=checkbox]").forEach(ch=>{
      const v = Number(ch.value);
      ch.checked = reminders.includes(v);
    });
  }

  function collectReminders() {
    const vals = [];
    document.querySelectorAll("#remindersWrap input[type=checkbox]").forEach(ch=>{
      if (ch.checked) vals.push(Number(ch.value));
    });
    return vals.length ? vals : [15,30,60];
  }

  async function saveMe() {
    showState("", "");
    const payload = {
      name: meName?.value || "",
      email: meEmail?.value || "",
      preferences: {
        workHours: { start: workStart?.value || "08:00", end: workEnd?.value || "18:00" },
        reminders: collectReminders()
      },
      ui: {
        showKpis: !!uiShowKpis?.checked,
        showFilters: !!uiShowFilters?.checked
      }
    };
    await API.request("/api/users/me", { auth: true, method: "PUT", body: payload });

    // também aplica na UI local (agenda)
    const uiPref = { kpis: !!uiShowKpis?.checked, filters: !!uiShowFilters?.checked };
    localStorage.setItem("mh_user_ui", JSON.stringify(uiPref));

    showState("success", "Preferências salvas com sucesso.");
  }

  async function changePassword() {
    showState("", "");
    await API.request("/api/users/me/password", {
      auth: true,
      method: "PATCH",
      body: { currentPassword: currentPassword?.value || "", newPassword: newPassword?.value || "" }
    });
    if (currentPassword) currentPassword.value = "";
    if (newPassword) newPassword.value = "";
    showState("success", "Senha atualizada.");
  }

  // logout (mobile)
  document.addEventListener("click", (e) => {
    const t = e.target;
    const btn = t?.closest?.("#btnLogout, #btnLogoutMobile");
    if (!btn) return;
    API.clearToken();
    localStorage.removeItem("mh_user");
    location.href = "/user/login.html";
  });

  btnSave?.addEventListener("click", async () => {
    try { await saveMe(); } catch (e) { showState("danger", e?.message || "Erro ao salvar."); }
  });
  btnChangePassword?.addEventListener("click", async ()=>{
    try { await changePassword(); } catch (e) { showState("danger", e?.message || "Erro ao atualizar senha."); }
  });

  btnAddTpl?.addEventListener("click", ()=>{
    const title = String(tplTitle?.value||"").trim();
    if (!title) return;
    const arr = getTemplates();
    arr.unshift({ title, eventType: String(tplType?.value||"MAXIMUM"), durationMin: Number(tplDuration?.value||60) });
    setTemplates(arr.slice(0,30));
    tplTitle.value = "";
    renderTemplates();
  });

  (async function init(){
    try {
      await loadMe();
      renderTemplates();
      window.MHIcons?.refresh?.();
    } catch (e) {
      if (e?.status === 401) {
        API.clearToken();
        localStorage.removeItem("mh_user");
        location.href = "/user/login.html";
        return;
      }
      showState("danger", e?.message || "Erro ao carregar dados.");
    }
  })();
})();