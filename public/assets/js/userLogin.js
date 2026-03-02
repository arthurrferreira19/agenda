// public/assets/js/userLogin.js
(function () {
  // Se já tem sessão e role USER, entra direto
  const token = API.getToken();
  const me = JSON.parse(localStorage.getItem("mh_user") || "null");
  if (token && me?.role === "USER") {
    location.href = "/user/agenda.html";
    return;
  }

  const form = document.getElementById("loginForm");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const remember = document.getElementById("remember");
  const err = document.getElementById("loginErr");
  const btn = document.getElementById("btnLogin");
  const togglePass = document.getElementById("togglePass");

  function esc(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showErr(msg) {
    if (!msg) { err.innerHTML = ""; return; }
    err.innerHTML = `<div class="alert alert-danger fade-in" style="border-radius:16px;">${esc(msg)}</div>`;
  }

  togglePass?.addEventListener("click", () => {
    const isPwd = password.type === "password";
    password.type = isPwd ? "text" : "password";
    togglePass.querySelector("i")?.setAttribute("data-lucide", isPwd ? "eye-off" : "eye");
    window.MHIcons?.refresh?.();
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showErr("");

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Entrando...`;

    try {
      const payload = {
        email: String(email.value || "").trim(),
        password: String(password.value || ""),
        remember: !!remember.checked
      };

      const data = await API.request("/api/auth/login", { method: "POST", body: payload });

      if (!data?.token || !data?.user) throw new Error("Resposta inválida do servidor.");

      // ✅ Somente USER
      if (data.user.role !== "USER") {
        // mantém login admin separado
        showErr("Acesso permitido apenas para usuários com perfil USER.");
        API.clearToken();
        localStorage.removeItem("mh_user");
        return;
      }

      API.setToken(data.token);
      localStorage.setItem("mh_user", JSON.stringify(data.user));

      location.href = "/user/agenda.html";
    } catch (err) {
      showErr(err?.message || "Falha ao entrar.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span class="d-inline-flex align-items-center gap-2"><i data-lucide="log-in"></i> Entrar</span>`;
      window.MHIcons?.refresh?.();
    }
  });
})();