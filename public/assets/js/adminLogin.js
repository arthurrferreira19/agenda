(function () {
  const form = document.getElementById("formLogin");
  const alertBox = document.getElementById("alertBox");
  const btnTogglePass = document.getElementById("btnTogglePass");
  const password = document.getElementById("password");
  const remember = document.getElementById("remember");
  const year = document.getElementById("year");
  const forgotLink = document.getElementById("forgotLink");

  year.textContent = new Date().getFullYear();

  function showAlert(msg) {
    alertBox.innerHTML = `
      <div class="alert alert-soft fade-up mb-0" role="alert">
        <div class="d-flex align-items-start gap-2">
          <div style="margin-top:2px"><i data-lucide="alert-circle"></i></div>
          <div>${msg}</div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  function clearAlert() {
    alertBox.innerHTML = "";
  }

  // Lucide icons
  if (window.lucide) lucide.createIcons();

  btnTogglePass.addEventListener("click", () => {
    const isPass = password.type === "password";
    password.type = isPass ? "text" : "password";
    btnTogglePass.setAttribute("aria-label", isPass ? "Ocultar senha" : "Mostrar senha");
    const eye = document.getElementById("eyeIcon");
    if (eye) eye.setAttribute("data-lucide", isPass ? "eye-off" : "eye");
    if (window.lucide) lucide.createIcons();
  });

  forgotLink.addEventListener("click", (e) => {
    e.preventDefault();
    showAlert("Recuperação de senha ainda não configurada. Fale com o suporte interno para resetar o acesso.");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAlert();

    // Bootstrap validation
    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      return;
    }

    const email = document.getElementById("email").value.trim();
    const pass = password.value;

    const btn = document.getElementById("btnLogin");
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="d-inline-flex align-items-center gap-2">
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      Entrando...
    </span>`;

    try {
      const data = await API.request("/api/auth/admin/login", {
        method: "POST",
        body: { email, password: pass, remember: remember.checked }
      });

      // token + user
      API.setToken(data.token, remember.checked);
      localStorage.setItem("mh_user", JSON.stringify(data.user));

      // redirect
      window.location.href = "/admin/dashboardAdmin.html";
    } catch (err) {
      showAlert(err.message || "Falha ao autenticar.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });
})();