(function () {
  if (window.lucide) lucide.createIcons();

  const whoami = document.getElementById("whoami");
  const btnLogout = document.getElementById("btnLogout");

  const token = API.getToken();
  if (!token) {
    window.location.href = "/admin/login.html";
    return;
  }

  const user = JSON.parse(localStorage.getItem("mh_user") || "null");
  whoami.textContent = user
    ? `Acesso: ${user.name} • ${user.email} • ${user.role}`
    : "Acesso: (usuário)";

  btnLogout.addEventListener("click", () => {
    API.clearToken();
    localStorage.removeItem("mh_user");
    window.location.href = "/admin/login.html";
  });
})();