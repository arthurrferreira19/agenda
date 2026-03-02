(function () {
  const el = document.getElementById("sidebarMount");
  if (!el) return;

  const path = location.pathname;
  const isActive = (p) => (path.endsWith(p) ? "active" : "");

  el.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="d-flex align-items-center justify-content-between gap-2">
          <div>
            <p class="sidebar-title mb-1">Maximum Calendar</p>
            <p class="sidebar-sub" id="sbUser">Acesso: ...</p>
          </div>
          <div class="icon-pill" style="width:44px;height:44px;">
            <i data-lucide="calendar-days"></i>
          </div>
        </div>
      </div>

      <div class="mt-3">
        <div class="nav-group-title">Navegação</div>
        <a class="side-link ${isActive("dashboardAdmin.html")}" href="/admin/dashboardAdmin.html">
          <i data-lucide="layout-dashboard"></i>
          Dashboard
        </a>

        <div class="nav-group-title">Gerenciamento</div>
        <a class="side-link ${isActive("usersAdmin.html")}" href="/admin/usersAdmin.html">
          <i data-lucide="users"></i>
          Usuários
        </a>
        <a class="side-link ${isActive("roomsAdmin.html")}" href="/admin/roomsAdmin.html">
          <i data-lucide="door-open"></i>
          Salas
        </a>

        <div class="nav-group-title">Calendário</div>
        <a class="side-link ${isActive("agendaAdmin.html")}" href="/admin/agendaAdmin.html">
          <i data-lucide="calendar"></i>
          Agenda
        </a>
      </div>

      <div class="side-footer">
        <a class="side-link" href="#" id="btnLogout">
          <i data-lucide="log-out"></i>
          Sair do Painel
        </a>
      </div>
    </aside>
  `;

  const user = JSON.parse(localStorage.getItem("mh_user") || "null");
  const sbUser = document.getElementById("sbUser");
  if (sbUser) sbUser.textContent = user ? `Acesso: ${user.name}` : "Acesso: -";

  const btnLogout = document.getElementById("btnLogout");
  btnLogout?.addEventListener("click", (e) => {
    e.preventDefault();
    API.clearToken();
    localStorage.removeItem("mh_user");
    location.href = "/admin/login.html";
  });

  if (window.lucide) lucide.createIcons();
})();