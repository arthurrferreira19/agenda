(function () {
  const el = document.getElementById("sidebarMount");
  if (!el) return;

  const path = location.pathname;
  const isActive = (p) => (path.endsWith(p) ? "active" : "");

  const me = JSON.parse(localStorage.getItem("mh_user") || "null");
  const initial = (me?.name || "U").trim().slice(0, 1).toUpperCase();

  el.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="d-flex align-items-center justify-content-between gap-2">
          <div>
            <p class="sidebar-title mb-0">Maximum Help</p>
            <p class="sidebar-sub mb-0">Área do Usuário</p>
          </div>
          <span class="badge badge-wine">USER</span>
        </div>
      </div>

      <div class="sidebar-user">
        <div class="avatar">
          <span>${initial}</span>
        </div>
        <div class="flex-grow-1">
          <div class="fw-semibold">${me?.name ? String(me.name) : "Usuário"}</div>
          <div class="small text-muted">${me?.email ? String(me.email) : ""}</div>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-label">Navegação</div>
        <a class="side-link ${isActive("agenda.html")}" href="/user/agenda.html">
          <i data-lucide="calendar-days"></i>
          <span>Agenda</span>
        </a>
      </div>

      <div class="side-footer">
        <button class="btn btn-outline-secondary w-100" id="btnLogout">
          <span class="d-inline-flex align-items-center gap-2">
            <i data-lucide="log-out"></i> Sair
          </span>
        </button>
      </div>
    </aside>
  `;
})();