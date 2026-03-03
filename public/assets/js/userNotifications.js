// public/assets/js/userNotifications.js
(function () {
  const token = API.getToken();
  if (!token) { location.href = "/user/login.html"; return; }

  const me = JSON.parse(localStorage.getItem("mh_user") || "null");
  if (!me || me.role !== "USER") {
    API.clearToken(); localStorage.removeItem("mh_user"); location.href = "/user/login.html"; return;
  }

  // Logout (sidebar e mobile)
  document.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("#btnLogout, #btnLogoutMobile");
    if (!btn) return;
    API.clearToken();
    localStorage.removeItem("mh_user");
    location.href = "/user/login.html";
  });

  const listShell = document.getElementById("listShell");
  const stateShell = document.getElementById("stateShell");
  const qInput = document.getElementById("q");

  const btnRefresh = document.getElementById("btnRefresh");
  const btnMarkAll = document.getElementById("btnMarkAll");

  const filterAll = document.getElementById("filterAll");
  const filterUnread = document.getElementById("filterUnread");

  let currentFilter = "all";
  let allItems = [];

  function esc(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDT(d) {
    const dt = new Date(d);
    return dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function setState(type, msg) {
    if (!msg) { stateShell.innerHTML = ""; return; }
    stateShell.innerHTML = `
      <div class="alert alert-${type}" role="alert" style="border-radius:16px;">
        ${msg}
      </div>
    `;
  }

  function getBadgeEl() {
    return document.getElementById("notifBadge");
  }

  async function refreshBadge() {
    try {
      const r = await API.request("/api/notifications/unread-count", { auth: true });
      const el = getBadgeEl();
      if (!el) return;
      const c = Number(r?.count || 0);
      if (c > 0) { el.textContent = String(c); el.style.display = "inline-flex"; }
      else { el.textContent = ""; el.style.display = "none"; }
    } catch { /* ignore */ }
  }

  function applyFilter() {
    const q = String(qInput.value || "").trim().toLowerCase();
    let items = allItems.slice();

    if (currentFilter === "unread") items = items.filter(x => !x.isRead);

    if (q) {
      items = items.filter(x => {
        const t = `${x.title || ""} ${x.message || ""}`.toLowerCase();
        return t.includes(q);
      });
    }

    render(items);
  }

  function typeBadge(type) {
    const map = {
      EVENT_CREATED: ["Criado", "badge-soft-success"],
      EVENT_UPDATED: ["Atualizado", "badge-soft-warning"],
      EVENT_DELETED: ["Cancelado", "badge-soft-danger"],
      INVITE: ["Convite", "badge-soft-primary"],
      REMINDER: ["Lembrete", "badge-soft-info"],
      SYSTEM: ["Sistema", "badge-soft-secondary"]
    };
    const [label, cls] = map[type] || [type, "badge-soft-secondary"];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function render(items) {
    if (!items.length) {
      listShell.innerHTML = `
        <div class="card">
          <div class="card-body text-center text-muted py-5">
            <i data-lucide="bell-off" style="width:44px;height:44px;"></i>
            <div class="mt-2">Nenhuma notificação aqui.</div>
          </div>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    listShell.innerHTML = items.map(n => `
      <div class="card mb-2 notif-item ${n.isRead ? "is-read" : ""}" data-id="${esc(n.id)}">
        <div class="card-body">
          <div class="d-flex align-items-start gap-3">
            <div class="notif-dot ${n.isRead ? "read" : ""}"></div>
            <div class="flex-grow-1">
              <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                  ${typeBadge(n.type)}
                  <div class="fw-semibold">${esc(n.title || "Notificação")}</div>
                </div>
                <div class="small text-muted">${fmtDT(n.createdAt)}</div>
              </div>
              <div class="text-muted mt-1">${esc(n.message || "")}</div>

              <div class="d-flex gap-2 mt-3 flex-wrap">
                ${n.eventId ? `
                  <a class="btn btn-sm btn-outline-secondary" href="/user/agenda.html#event=${esc(n.eventId)}">
                    <span class="d-inline-flex align-items-center gap-2">
                      <i data-lucide="external-link"></i> Ver na agenda
                    </span>
                  </a>` : ``}

                ${n.isRead ? `` : `
                  <button class="btn btn-sm btn-wine btn-mark-read">
                    <span class="d-inline-flex align-items-center gap-2">
                      <i data-lucide="check"></i> Marcar como lida
                    </span>
                  </button>
                `}
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join("");

    lucide.createIcons();
  }

  async function load() {
    try {
      setState("", "");
      const unreadOnly = currentFilter === "unread" ? "1" : "0";
      const data = await API.request(`/api/notifications?unreadOnly=${unreadOnly}&limit=200&page=1`, { auth: true });
      allItems = Array.isArray(data?.items) ? data.items : [];
      applyFilter();
      await refreshBadge();
    } catch (err) {
      setState("danger", "Não foi possível carregar as notificações.");
      console.error(err);
    }
  }

  // Events
  btnRefresh?.addEventListener("click", load);

  btnMarkAll?.addEventListener("click", async () => {
    try {
      await API.request("/api/notifications/mark-all-read", { auth: true, method: "POST" });
      await load();
    } catch (err) {
      setState("danger", "Não foi possível marcar como lidas.");
      console.error(err);
    }
  });

  filterAll?.addEventListener("click", () => {
    currentFilter = "all";
    filterAll.classList.add("active");
    filterUnread.classList.remove("active");
    load();
  });

  filterUnread?.addEventListener("click", () => {
    currentFilter = "unread";
    filterUnread.classList.add("active");
    filterAll.classList.remove("active");
    load();
  });

  qInput?.addEventListener("input", applyFilter);

  listShell?.addEventListener("click", async (e) => {
    const card = e.target?.closest?.(".notif-item");
    const btn = e.target?.closest?.(".btn-mark-read");
    if (!card || !btn) return;

    const id = card.getAttribute("data-id");
    try {
      await API.request(`/api/notifications/${id}/read`, { auth: true, method: "POST" });
      card.classList.add("is-read");
      btn.remove();
      await refreshBadge();
    } catch (err) {
      setState("danger", "Não foi possível marcar como lida.");
      console.error(err);
    }
  });

  // Init
  load();
  setInterval(refreshBadge, 30000);
})();
