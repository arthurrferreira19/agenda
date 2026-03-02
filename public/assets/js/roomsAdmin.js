(function () {
  const token = API.getToken();
  if (!token) { location.href = "/admin/login.html"; return; }

  const roomsBody = document.getElementById("roomsBody");
  const emptyState = document.getElementById("emptyState");
  const q = document.getElementById("q");
  const status = document.getElementById("status");

  const modalEl = document.getElementById("modalRoom");
  const modal = new bootstrap.Modal(modalEl);
  const modalTitle = document.getElementById("modalTitle");
  const modalErr = document.getElementById("modalErr");

  const roomForm = document.getElementById("roomForm");
  const roomId = document.getElementById("roomId");
  const nameInp = document.getElementById("name");
  const floorInp = document.getElementById("floor");
  const capInp = document.getElementById("capacity");
  const colorInp = document.getElementById("color");
  const colorPicker = document.getElementById("colorPicker");
  const colorWarning = document.getElementById("colorWarning");

  const tv = document.getElementById("tv");
  const computer = document.getElementById("computer");
  const speakers = document.getElementById("speakers");
  const microphone = document.getElementById("microphone");
  const minibar = document.getElementById("minibar");

  const btnSave = document.getElementById("btnSave");

  const confirmEl = document.getElementById("modalConfirm");
  const confirmModal = new bootstrap.Modal(confirmEl);
  const confirmText = document.getElementById("confirmText");
  const btnConfirm = document.getElementById("btnConfirm");
  let confirmAction = null;

  // Até 10 cores (bolinhas)
  const COLORS = [
    "#7a1f3d", // wine
    "#2563eb", // blue
    "#16a34a", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#0ea5e9", // sky
    "#14b8a6", // teal
    "#111827", // dark
    "#ec4899"  // pink
  ];

  let ROOMS = [];

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showModalError(msg) {
    modalErr.innerHTML = msg ? `<div class="alert alert-soft mb-0">${esc(msg)}</div>` : "";
  }

  function setBusy(button, busy, labelBusy = "Salvando...") {
    button.disabled = busy;
    if (!button.dataset.original) button.dataset.original = button.innerHTML;
    button.innerHTML = busy
      ? `<span class="d-inline-flex align-items-center gap-2">
          <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          ${labelBusy}
        </span>`
      : button.dataset.original;
  }

  function featureText(f) {
    const items = [];
    if (f?.tv) items.push("TV");
    if (f?.computer) items.push("Computador");
    if (f?.speakers) items.push("Alto Falantes");
    if (f?.microphone) items.push("Microfone");
    if (f?.minibar) items.push("Frigobar");
    return items.length ? items.join(", ") : "—";
  }

  function colorInUseWarning(selectedColor, editingId) {
    const inUse = ROOMS.find(r =>
      String(r.color).toLowerCase() === String(selectedColor).toLowerCase() &&
      String(r.id) !== String(editingId || "")
    );

    if (inUse) {
      colorWarning.innerHTML = `
        <div class="alert alert-soft mb-0">
          <span class="fw-semibold">Atenção:</span> esta cor já está em uso na sala
          <span class="fw-semibold">${esc(inUse.name)}</span>.
        </div>
      `;
    } else {
      colorWarning.innerHTML = "";
    }
  }

  function buildColorPicker() {
    colorPicker.innerHTML = "";

    COLORS.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn p-0";
      btn.style.width = "34px";
      btn.style.height = "34px";
      btn.style.borderRadius = "999px";
      btn.style.border = "1px solid rgba(15,23,42,.18)";
      btn.style.background = c;
      btn.style.boxShadow = "0 10px 20px rgba(15,23,42,.10)";
      btn.title = c;

      btn.addEventListener("click", () => {
        colorInp.value = c;

        // visual "selecionado"
        [...colorPicker.querySelectorAll("button")].forEach(b => {
          b.style.outline = "none";
          b.style.transform = "none";
        });
        btn.style.outline = "3px solid rgba(122,31,61,.25)";
        btn.style.transform = "translateY(-1px)";

        colorInUseWarning(c, roomId.value);
      });

      colorPicker.appendChild(btn);
    });
  }

  async function loadRooms() {
    const data = await API.request("/api/rooms", { auth: true });
    ROOMS = data.rooms || [];
    render();
  }

  function filterRooms() {
    const term = (q.value || "").toLowerCase().trim();
    const st = status.value;

    return ROOMS.filter(r => {
      const matchesTerm =
        !term ||
        String(r.name || "").toLowerCase().includes(term) ||
        String(r.floor || "").toLowerCase().includes(term);

      const matchesStatus =
        st === "all" ||
        (st === "active" && r.isActive) ||
        (st === "inactive" && !r.isActive);

      return matchesTerm && matchesStatus;
    });
  }

  function render() {
    const list = filterRooms();
    roomsBody.innerHTML = "";
    emptyState.classList.toggle("d-none", list.length !== 0);

    for (const r of list) {
      const badge = r.isActive
        ? `<span class="badge text-bg-success">Ativa</span>`
        : `<span class="badge text-bg-secondary">Desativada</span>`;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <div class="fw-semibold">${esc(r.name)}</div>
          <div class="small text-secondary">${badge}</div>
        </td>
        <td>${esc(r.floor)}</td>
        <td>${esc(r.capacity)}</td>
        <td>
          <span style="
            display:inline-block;width:16px;height:16px;border-radius:999px;
            background:${esc(r.color)};border:1px solid rgba(15,23,42,.18);
            box-shadow: 0 6px 14px rgba(15,23,42,.10);
            vertical-align:middle;margin-right:6px;
          "></span>
          <span class="text-secondary small">${esc(r.color)}</span>
        </td>
        <td class="text-secondary">${esc(featureText(r.features))}</td>
        <td class="text-end">
          <div class="d-inline-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary" data-act="edit" data-id="${esc(r.id)}">
              <span class="d-inline-flex align-items-center gap-1">
                <i data-lucide="pencil"></i> Editar
              </span>
            </button>
            <button class="btn btn-sm btn-outline-secondary" data-act="toggle" data-id="${esc(r.id)}">
              <span class="d-inline-flex align-items-center gap-1">
                <i data-lucide="${r.isActive ? "pause-circle" : "play-circle"}"></i>
                ${r.isActive ? "Desativar" : "Ativar"}
              </span>
            </button>
            <button class="btn btn-sm btn-outline-danger" data-act="delete" data-id="${esc(r.id)}">
              <span class="d-inline-flex align-items-center gap-1">
                <i data-lucide="trash-2"></i> Excluir
              </span>
            </button>
          </div>
        </td>
      `;
      roomsBody.appendChild(row);
    }

    if (window.lucide) lucide.createIcons();
  }

  function openCreate() {
    modalTitle.textContent = "Adicionar Sala";
    roomId.value = "";
    nameInp.value = "";
    floorInp.value = "";
    capInp.value = "";
    colorInp.value = "";
    colorWarning.innerHTML = "";
    showModalError("");

    tv.checked = false;
    computer.checked = false;
    speakers.checked = false;
    microphone.checked = false;
    minibar.checked = false;

    roomForm.classList.remove("was-validated");

    // limpa visual seleção no color picker
    [...colorPicker.querySelectorAll("button")].forEach(b => {
      b.style.outline = "none";
      b.style.transform = "none";
    });

    modal.show();
    if (window.lucide) lucide.createIcons();
  }

  function openEdit(r) {
    modalTitle.textContent = "Editar Sala";
    roomId.value = r.id;
    nameInp.value = r.name || "";
    floorInp.value = r.floor || "";
    capInp.value = r.capacity ?? "";
    colorInp.value = r.color || "";
    showModalError("");

    tv.checked = Boolean(r.features?.tv);
    computer.checked = Boolean(r.features?.computer);
    speakers.checked = Boolean(r.features?.speakers);
    microphone.checked = Boolean(r.features?.microphone);
    minibar.checked = Boolean(r.features?.minibar);

    roomForm.classList.remove("was-validated");

    // marca bolinha selecionada
    [...colorPicker.querySelectorAll("button")].forEach(b => {
      b.style.outline = "none";
      b.style.transform = "none";
    });
    const idx = COLORS.findIndex(c => String(c).toLowerCase() === String(r.color).toLowerCase());
    if (idx >= 0) {
      const btn = colorPicker.querySelectorAll("button")[idx];
      btn.style.outline = "3px solid rgba(122,31,61,.25)";
      btn.style.transform = "translateY(-1px)";
    }

    colorInUseWarning(colorInp.value, roomId.value);
    modal.show();
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
      await loadRooms();
    } catch (e) {
      alert(e.message || "Erro ao executar ação.");
    } finally {
      btnConfirm.disabled = false;
      confirmAction = null;
    }
  });

  roomsBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;
    const r = ROOMS.find(x => String(x.id) === String(id));
    if (!r) return;

    if (act === "edit") openEdit(r);

    if (act === "toggle") {
      askConfirm(
        r.isActive ? "Desativar esta sala?" : "Ativar esta sala?",
        async () => {
          await API.request(`/api/rooms/${id}/active`, {
            method: "PATCH",
            auth: true,
            body: { isActive: !r.isActive }
          });
        }
      );
    }

    if (act === "delete") {
      askConfirm(
        "Excluir esta sala permanentemente?",
        async () => {
          await API.request(`/api/rooms/${id}`, { method: "DELETE", auth: true });
        }
      );
    }
  });

  document.getElementById("btnAddRoom")?.addEventListener("click", openCreate);

  roomForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showModalError("");

    roomForm.classList.add("was-validated");
    if (!roomForm.checkValidity()) return;

    if (!colorInp.value) {
      showModalError("Selecione uma cor.");
      return;
    }

    const id = roomId.value || "";
    const payload = {
      name: nameInp.value.trim(),
      floor: floorInp.value.trim(),
      capacity: Number(capInp.value),
      color: colorInp.value,
      features: {
        tv: tv.checked,
        computer: computer.checked,
        speakers: speakers.checked,
        microphone: microphone.checked,
        minibar: minibar.checked
      }
    };

    try {
      setBusy(btnSave, true);

      if (!id) {
        await API.request("/api/rooms", { method: "POST", auth: true, body: payload });
      } else {
        await API.request(`/api/rooms/${id}`, { method: "PUT", auth: true, body: payload });
      }

      modal.hide();
      await loadRooms();
    } catch (err) {
      showModalError(err.message || "Erro ao salvar sala.");
    } finally {
      setBusy(btnSave, false);
    }
  });

  q.addEventListener("input", render);
  status.addEventListener("change", render);

  buildColorPicker();
  if (window.lucide) lucide.createIcons();
  loadRooms().catch(err => alert(err.message || "Erro ao carregar salas."));
})();