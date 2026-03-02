(function () {
  const token = API.getToken();
  if (!token) { location.href = "/admin/login.html"; return; }

  const usersBody = document.getElementById("usersBody");
  const emptyState = document.getElementById("emptyState");
  const q = document.getElementById("q");
  const status = document.getElementById("status");

  const modalEl = document.getElementById("modalUser");
  const modal = new bootstrap.Modal(modalEl);
  const modalTitle = document.getElementById("modalTitle");
  const modalErr = document.getElementById("modalErr");

  const userForm = document.getElementById("userForm");
  const userId = document.getElementById("userId");
  const nameInp = document.getElementById("name");
  const emailInp = document.getElementById("email");
  const passInp = document.getElementById("password");
  const roleInp = document.getElementById("role");
  const btnSave = document.getElementById("btnSave");

  const btnTogglePass = document.getElementById("btnTogglePass");
  const eyeIcon = document.getElementById("eyeIcon");

  const newPassword = document.getElementById("newPassword");
  const btnResetPass = document.getElementById("btnResetPass");
  const btnToggleNewPass = document.getElementById("btnToggleNewPass");
  const eyeIcon2 = document.getElementById("eyeIcon2");

  const confirmEl = document.getElementById("modalConfirm");
  const confirmModal = new bootstrap.Modal(confirmEl);
  const confirmText = document.getElementById("confirmText");
  const btnConfirm = document.getElementById("btnConfirm");
  let confirmAction = null;

  let USERS = [];

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDate(d) {
    if (!d) return "—";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function showModalError(msg) {
    modalErr.innerHTML = msg
      ? `<div class="alert alert-soft mb-0">${esc(msg)}</div>`
      : "";
  }

  function setBusy(button, busy, labelBusy = "Salvando...") {
    if (!button) return;
    button.disabled = busy;
    if (!button.dataset.original) button.dataset.original = button.innerHTML;
    button.innerHTML = busy
      ? `<span class="d-inline-flex align-items-center gap-2">
          <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          ${labelBusy}
        </span>`
      : button.dataset.original;
  }

  function openCreate() {
    modalTitle.textContent = "Adicionar Usuário";
    userId.value = "";
    nameInp.value = "";
    emailInp.value = "";
    passInp.value = "";
    roleInp.value = "USER";
    newPassword.value = "";
    showModalError("");

    userForm.classList.remove("was-validated");
    modal.show();
    if (window.lucide) lucide.createIcons();
  }

  function openEdit(u) {
    modalTitle.textContent = "Editar Usuário";
    userId.value = u.id;
    nameInp.value = u.name || "";
    emailInp.value = u.email || "";
    passInp.value = ""; // manter em branco
    roleInp.value = u.role || "USER";
    newPassword.value = "";
    showModalError("");

    userForm.classList.remove("was-validated");
    modal.show();
    if (window.lucide) lucide.createIcons();
  }

  // toggle show/hide (senha do input)
  btnTogglePass.addEventListener("click", () => {
    passInp.type = passInp.type === "password" ? "text" : "password";
    eyeIcon.setAttribute("data-lucide", passInp.type === "password" ? "eye" : "eye-off");
    if (window.lucide) lucide.createIcons();
  });

  btnToggleNewPass.addEventListener("click", () => {
    newPassword.type = newPassword.type === "password" ? "text" : "password";
    eyeIcon2.setAttribute("data-lucide", newPassword.type === "password" ? "eye" : "eye-off");
    if (window.lucide) lucide.createIcons();
  });

  async function loadUsers() {
    const data = await API.request("/api/users", { auth: true });
    USERS = data.users || [];
    render();
  }

  function filterUsers() {
    const term = (q.value || "").toLowerCase().trim();
    const st = status.value;

    return USERS.filter(u => {
      const matchesTerm =
        !term ||
        String(u.name || "").toLowerCase().includes(term) ||
        String(u.email || "").toLowerCase().includes(term);

      const matchesStatus =
        st === "all" ||
        (st === "active" && u.isActive) ||
        (st === "inactive" && !u.isActive);

      return matchesTerm && matchesStatus;
    });
  }

  function render() {
    const list = filterUsers();
    usersBody.innerHTML = "";

    emptyState.classList.toggle("d-none", list.length !== 0);

    for (const u of list) {
      const badge = u.isActive
        ? `<span class="badge text-bg-success">Ativo</span>`
        : `<span class="badge text-bg-secondary">Desativado</span>`;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <div class="fw-semibold">${esc(u.name)}</div>
          <div class="small text-secondary">${badge} • ${esc(u.role)}</div>
        </td>
        <td>${esc(u.email)}</td>
        <td>
          <span class="text-secondary">••••••••</span>
          <button class="btn btn-sm btn-outline-secondary ms-2" data-act="reset" data-id="${esc(u.id)}">
            <span class="d-inline-flex align-items-center gap-1">
              <i data-lucide="key-round"></i> Resetar
            </span>
          </button>
        </td>
        <td>${esc(fmtDate(u.lastLoginAt))}</td>
        <td class="text-end">
          <div class="d-inline-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" data-act="edit" data-id="${esc(u.id)}">
              <span class="d-inline-flex align-items-center gap-1">
                <i data-lucide="pencil"></i> Editar
              </span>
            </button>
            <button class="btn btn-sm btn-outline-secondary" data-act="toggle" data-id="${esc(u.id)}">
              <span class="d-inline-flex align-items-center gap-1">
                <i data-lucide="${u.isActive ? "user-x" : "user-check"}"></i>
                ${u.isActive ? "Desativar" : "Ativar"}
              </span>
            </button>
            <button class="btn btn-sm btn-outline-danger" data-act="delete" data-id="${esc(u.id)}">
              <span class="d-inline-flex align-items-center gap-1">
                <i data-lucide="trash-2"></i> Excluir
              </span>
            </button>
          </div>
        </td>
      `;
      usersBody.appendChild(row);
    }

    if (window.lucide) lucide.createIcons();
  }

  function askConfirm(text, action) {
    confirmText.textContent = text;
    confirmAction = action;
    confirmModal.show();
  }

  btnConfirm.addEventListener("click", async () => {
    try {
      btnConfirm.disabled = true;
      await confirmAction?.();
      confirmModal.hide();
      await loadUsers();
    } catch (e) {
      alert(e.message || "Erro ao executar ação.");
    } finally {
      btnConfirm.disabled = false;
      confirmAction = null;
    }
  });

  usersBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;
    const u = USERS.find(x => String(x.id) === String(id));
    if (!u) return;

    if (act === "edit") openEdit(u);

    if (act === "reset") {
      openEdit(u);
      // foca no campo reset
      setTimeout(() => newPassword.focus(), 250);
    }

    if (act === "toggle") {
      askConfirm(
        u.isActive ? "Desativar este usuário?" : "Ativar este usuário?",
        async () => {
          await API.request(`/api/users/${id}/active`, {
            method: "PATCH",
            auth: true,
            body: { isActive: !u.isActive }
          });
        }
      );
    }

    if (act === "delete") {
      askConfirm(
        "Excluir este usuário permanentemente?",
        async () => {
          await API.request(`/api/users/${id}`, { method: "DELETE", auth: true });
        }
      );
    }
  });

  // Abrir modal pelo botão topo
  document.querySelector('[data-bs-target="#modalUser"]')?.addEventListener("click", openCreate);

  // Salvar (criar/editar)
  userForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showModalError("");

    // validação bootstrap
    userForm.classList.add("was-validated");
    if (!userForm.checkValidity()) return;

    const id = userId.value || "";
    const payload = {
      name: nameInp.value.trim(),
      email: emailInp.value.trim(),
      role: roleInp.value
    };

    const creating = !id;

    // Em criação senha é obrigatória
    if (creating) {
      if (!passInp.value || passInp.value.length < 6) {
        showModalError("Senha obrigatória (mín. 6) ao criar usuário.");
        return;
      }
      payload.password = passInp.value;
    }

    try {
      setBusy(btnSave, true);

      if (creating) {
        await API.request("/api/users", { method: "POST", auth: true, body: payload });
      } else {
        await API.request(`/api/users/${id}`, { method: "PUT", auth: true, body: payload });

        // Se preencheu "Senha" no form de edição, aplica reset também
        if (passInp.value && passInp.value.length >= 6) {
          await API.request(`/api/users/${id}/password`, {
            method: "PATCH",
            auth: true,
            body: { password: passInp.value }
          });
        }
      }

      modal.hide();
      await loadUsers();
    } catch (err) {
      showModalError(err.message || "Erro ao salvar usuário.");
    } finally {
      setBusy(btnSave, false);
    }
  });

  // Resetar senha dedicado
  btnResetPass.addEventListener("click", async () => {
    showModalError("");
    const id = userId.value || "";
    if (!id) { showModalError("Abra um usuário em edição para resetar a senha."); return; }
    if (!newPassword.value || newPassword.value.length < 6) {
      showModalError("Nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    try {
      btnResetPass.disabled = true;
      await API.request(`/api/users/${id}/password`, {
        method: "PATCH",
        auth: true,
        body: { password: newPassword.value }
      });
      showModalError("Senha atualizada com sucesso ✅");
      newPassword.value = "";
    } catch (err) {
      showModalError(err.message || "Erro ao resetar senha.");
    } finally {
      btnResetPass.disabled = false;
    }
  });

  q.addEventListener("input", render);
  status.addEventListener("change", render);

  if (window.lucide) lucide.createIcons();
  loadUsers().catch(err => alert(err.message || "Erro ao carregar usuários."));
})();