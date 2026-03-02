// public/assets/js/agendaAdmin.js
(function () {
    const token = API.getToken();
    if (!token) { location.href = "/admin/login.html"; return; }

    const me = JSON.parse(localStorage.getItem("mh_user") || "null");

    // View buttons
    const viewDayBtn = document.getElementById("viewDay");
    const viewWeekBtn = document.getElementById("viewWeek");
    const viewMonthBtn = document.getElementById("viewMonth");

    // Mobile bottom nav
    const aMViewDay = document.getElementById("aMViewDay");
    const aMViewWeek = document.getElementById("aMViewWeek");
    const aMViewMonth = document.getElementById("aMViewMonth");

    // Shells
    const weekDayShell = document.getElementById("weekDayShell");
    const monthShell = document.getElementById("monthShell");

    // Calendar DOM
    const daysHeader = document.getElementById("daysHeader");
    const timeCol = document.getElementById("timeCol");
    const daysGrid = document.getElementById("daysGrid");
    const rangeLabel = document.getElementById("rangeLabel");
    const monthHead = document.getElementById("monthHead");
    const monthBody = document.getElementById("monthBody");
    const monthColsSelect = document.getElementById("monthColsSelect");

    // Nav buttons
    const btnPrev = document.getElementById("btnPrev");
    const btnToday = document.getElementById("btnToday");
    const btnNext = document.getElementById("btnNext");

    // Modal
    const modalEl = document.getElementById("modalEvent");
    const modal = new bootstrap.Modal(modalEl);
    const modalTitle = document.getElementById("modalTitle");
    const modalErr = document.getElementById("modalErr");

    // Slot modal (multi-event)
    const modalSlotEl = document.getElementById("modalSlot");
    const modalSlot = modalSlotEl ? new bootstrap.Modal(modalSlotEl) : null;
    const slotTitle = document.getElementById("slotTitle");
    const slotWhen = document.getElementById("slotWhen");
    const slotList = document.getElementById("slotList");

    // Form fields
    const eventForm = document.getElementById("eventForm");
    const eventId = document.getElementById("eventId");
    const titleInp = document.getElementById("title");
    const descInp = document.getElementById("description");
    const eventTypeInp = document.getElementById("eventType");
    const roomWrap = document.getElementById("roomWrap");
    const roomIdInp = document.getElementById("roomId");
    const addrWrap = document.getElementById("addrWrap");
    const clientAddressInp = document.getElementById("clientAddress");
    const onlineWrap = document.getElementById("onlineWrap");

    // Members
    const memberSearch = document.getElementById("memberSearch");
    const membersList = document.getElementById("membersList");

    // Date fields
    const startInp = document.getElementById("start");
    const endInp = document.getElementById("end");
    const btnSave = document.getElementById("btnSave");
    const btnDelete = document.getElementById("btnDelete");

    // Calendar constants
    const HOUR_HEIGHT = 48;
    const START_HOUR = 0;
    const END_HOUR = 24;

    // Recorrência
    const isRecurringInp = document.getElementById("isRecurring");
    const recurrenceWrap = document.getElementById("recurrenceWrap");
    const recurrenceFreqInp = document.getElementById("recurrenceFreq");
    const customEveryWrap = document.getElementById("customEveryWrap");
    const customEveryDaysInp = document.getElementById("customEveryDays");
    const recurrenceUntilInp = document.getElementById("recurrenceUntil");
    const recurrenceCountInp = document.getElementById("recurrenceCount");

    // State
    let viewMode = "WEEK";
    let cursorDate = new Date();

    let EVENTS = [];
    let ROOMS = [];
    let ROOM_COLOR = new Map();
    let MEMBERS = [];
    let selectedMembers = new Set();

    // ---------- Utils
    function esc(s) {
        return String(s ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function showModalError(msg) {
        // suporta \n
        if (!msg) { modalErr.innerHTML = ""; return; }
        const safe = esc(msg).replaceAll("\n", "<br>");
        modalErr.innerHTML = `<div class="alert alert-soft mb-0">${safe}</div>`;
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

    function startOfWeek(d) {
        const dt = new Date(d);
        const day = dt.getDay(); // 0 dom ... 6 sab
        const diff = (day === 0 ? -6 : 1) - day; // monday as start
        dt.setDate(dt.getDate() + diff);
        dt.setHours(0, 0, 0, 0);
        return dt;
    }


function getMonthCols() {
    const saved = Number(localStorage.getItem("mh_month_cols") || 7);
    const allowed = [7, 14, 21];
    return allowed.includes(saved) ? saved : 7;
}

function applyMonthCols(cols) {
    try { localStorage.setItem("mh_month_cols", String(cols)); } catch (_) {}
    if (monthShell) monthShell.style.setProperty("--month-cols", String(cols));
    if (monthHead) monthHead.style.setProperty("--month-cols", String(cols));
    if (monthBody) monthBody.style.setProperty("--month-cols", String(cols));
}

    function startOfDay(d) {
        const dt = new Date(d);
        dt.setHours(0, 0, 0, 0);
        return dt;
    }

    function startOfMonth(d) {
        const dt = new Date(d);
        dt.setDate(1);
        dt.setHours(0, 0, 0, 0);
        return dt;
    }

    function addDays(d, n) {
        const dt = new Date(d);
        dt.setDate(dt.getDate() + n);
        return dt;
    }

    function addMonths(d, n) {
        const dt = new Date(d);
        dt.setMonth(dt.getMonth() + n);
        return dt;
    }

    function toLocalInputValue(date) {
        const d = new Date(date);
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function minutesSinceMidnight(d) {
        return d.getHours() * 60 + d.getMinutes();
    }

    function isMineOrAdmin(ev) {
        const isAdmin = me?.role === "ADMIN";
        const isOwner = me?.id && String(ev.createdBy || "") === String(me.id);
        return Boolean(isAdmin || isOwner);
    }

    // ---------- API loaders
    async function fetchRooms() {
        const data = await API.request("/api/rooms/active", { auth: true });
        ROOMS = data.rooms || [];
        ROOM_COLOR = new Map(ROOMS.map(r => [String(r.id), String(r.color || "").toLowerCase()]));

        roomIdInp.innerHTML = ROOMS.map(r => {
            const label = `${r.name} • Andar ${r.floor} • ${r.capacity} lugares`;
            return `<option value="${esc(r.id)}">${esc(label)}</option>`;
        }).join("");

        if (!ROOMS.length) {
            roomIdInp.innerHTML = `<option value="">Nenhuma sala cadastrada</option>`;
        }
    }

    async function fetchMembers() {
        membersList.innerHTML = `<div class="text-secondary small px-2 py-2">Carregando membros...</div>`;
        try {
            const data = await API.request("/api/users/members", { auth: true });
            MEMBERS = data.members || [];
            renderMembers();

            if (!MEMBERS.length) {
                membersList.innerHTML = `<div class="text-secondary small px-2 py-2">Nenhum membro cadastrado (ou todos desativados).</div>`;
            }
        } catch (err) {
            MEMBERS = [];
            membersList.innerHTML = `<div class="text-danger small px-2 py-2">Erro ao carregar membros: ${esc(err.message || "desconhecido")}</div>`;
            showModalError(`Não foi possível carregar participantes. Motivo: ${err.message || "erro desconhecido"}`);
        }
    }

    async function fetchEvents(from, to) {
        const data = await API.request(
            `/api/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
            { auth: true }
        );
        EVENTS = data.events || [];
    }

    // ---------- Members UI
    function renderMembers() {
        const term = (memberSearch.value || "").toLowerCase().trim();
        const list = MEMBERS.filter(m =>
            !term ||
            String(m.name || "").toLowerCase().includes(term) ||
            String(m.email || "").toLowerCase().includes(term)
        );

        if (!list.length) {
            membersList.innerHTML = `<div class="text-secondary small px-2 py-2">Nenhum membro encontrado.</div>`;
            return;
        }

        membersList.innerHTML = list.map(m => {
            const id = String(m.id);
            const checked = selectedMembers.has(id) ? "checked" : "";
            return `
        <div class="form-check py-1">
          <input class="form-check-input" type="checkbox" id="mb_${esc(id)}" data-mid="${esc(id)}" ${checked}>
          <label class="form-check-label" for="mb_${esc(id)}">
            <span class="fw-semibold">${esc(m.name)}</span>
            <span class="text-secondary small"> • ${esc(m.email)} • ${esc(m.role)}</span>
          </label>
        </div>
      `;
        }).join("");
    }

    membersList.addEventListener("change", (e) => {
        const cb = e.target.closest("input[data-mid]");
        if (!cb) return;
        const id = cb.dataset.mid;
        if (cb.checked) selectedMembers.add(id);
        else selectedMembers.delete(id);
    });

    memberSearch.addEventListener("input", renderMembers);

    // ---------- Week/Day header
    function buildHeaderWeek(weekStart) {
        daysHeader.innerHTML = "";
        const fmtDow = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
        for (let i = 0; i < 7; i++) {
            const dt = addDays(weekStart, i);
            const el = document.createElement("div");
            el.className = "cal-day-head";
            el.innerHTML = `
        <div class="dow">${fmtDow[i]}</div>
        <div class="date">${dt.getDate()} ${dt.toLocaleString("pt-BR", { month: "short" })}</div>
      `;
            daysHeader.appendChild(el);
        }
    }

    function buildHeaderDay(day) {
        daysHeader.innerHTML = "";
        const dt = new Date(day);
        const el = document.createElement("div");
        el.className = "cal-day-head";
        el.style.gridColumn = "span 7";
        el.innerHTML = `
      <div class="dow">${esc(dt.toLocaleString("pt-BR", { weekday: "short" }))}</div>
      <div class="date">${dt.getDate()} ${esc(dt.toLocaleString("pt-BR", { month: "short" }))} ${dt.getFullYear()}</div>
    `;
        daysHeader.appendChild(el);
    }

    // ---------- Grid builder
    function buildGrid(columns) {
        timeCol.innerHTML = "";
        for (let h = START_HOUR; h < END_HOUR; h++) {
            const t = document.createElement("div");
            t.className = "time-slot";
            t.textContent = `${String(h).padStart(2, "0")}:00`;
            timeCol.appendChild(t);
        }

        daysGrid.innerHTML = "";
        daysGrid.style.gridTemplateColumns = `repeat(${columns}, minmax(140px, 1fr))`;

        const base = viewMode === "DAY" ? startOfDay(cursorDate) : startOfWeek(cursorDate);

        for (let d = 0; d < columns; d++) {
            const col = document.createElement("div");
            col.className = "day-col";
            col.dataset.dayIndex = String(d);

            // linhas de hora (apenas para marcação visual)
            for (let h = START_HOUR; h < END_HOUR; h++) {
                const row = document.createElement("div");
                row.className = "hour-row";
                row.style.height = `${HOUR_HEIGHT}px`;
                col.appendChild(row);
            }

            // Dblclick abre criação
            col.addEventListener("dblclick", (e) => {
                const rect = col.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const hour = Math.max(0, Math.min(23, Math.floor(y / HOUR_HEIGHT)));

                const start = addDays(base, d);
                start.setHours(hour, 0, 0, 0);
                const end = new Date(start);
                end.setHours(start.getHours() + 1);

                openCreate(start, end);
            });

            daysGrid.appendChild(col);
        }
    }

    // ---------- Render events on grid
    function renderEventsGrid(columns) {
        daysGrid.querySelectorAll(".event-card").forEach(el => el.remove());
        const base = viewMode === "DAY" ? startOfDay(cursorDate) : startOfWeek(cursorDate);

        // Agrupa por (dia + hora) para exibir "N eventos" no mesmo slot
        const slots = new Map();
        const key = (dayIndex, hour) => `${dayIndex}::${hour}`;
        for (let d = 0; d < columns; d++) for (let h = 0; h < 24; h++) slots.set(key(d, h), []);

        for (const ev of EVENTS) {
            const s = new Date(ev.start);
            const e = new Date(ev.end);
            for (let dayIndex = 0; dayIndex < columns; dayIndex++) {
                const day0 = addDays(base, dayIndex);
                day0.setHours(0, 0, 0, 0);
                const day1 = new Date(day0);
                day1.setHours(24, 0, 0, 0);
                if (!(s < day1 && e > day0)) continue;
                for (let h = 0; h < 24; h++) {
                    const hs = new Date(day0); hs.setHours(h, 0, 0, 0);
                    const he = new Date(day0); he.setHours(h + 1, 0, 0, 0);
                    if (s < he && e > hs) slots.get(key(dayIndex, h))?.push(ev);
                }
            }
        }

        for (let dayIndex = 0; dayIndex < columns; dayIndex++) {
            const col = daysGrid.querySelector(`.day-col[data-day-index="${dayIndex}"]`);
            if (!col) continue;

            for (let h = 0; h < 24; h++) {
                const list = slots.get(key(dayIndex, h)) || [];
                if (!list.length) continue;

                const card = document.createElement("div");
                card.className = "event-card";
                card.style.top = `${h * HOUR_HEIGHT + 2}px`;
                card.style.height = `${HOUR_HEIGHT - 6}px`;

                if (list.length === 1) {
                    const ev = list[0];
                    const s = new Date(ev.start);
                    const e = new Date(ev.end);
                    const timeLabel = `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}` +
                        `–${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`;
                    card.innerHTML = `
                      <div class="event-title">${esc(ev.title)}</div>
                      <div class="event-time">${esc(timeLabel)} • ${esc(ev.eventType)}</div>
                    `;
                    card.addEventListener("click", () => openEdit(ev, isMineOrAdmin(ev)));
                } else {
                    card.innerHTML = `
                      <div class="event-title">${list.length} eventos</div>
                      <div class="event-time">${String(h).padStart(2, "0")}:00–${String(h + 1).padStart(2, "0")}:00 • clique para ver</div>
                    `;
                    card.addEventListener("click", () => openSlot(dayIndex, h, list));
                }
                col.appendChild(card);
            }
        }

        if (window.lucide) lucide.createIcons();
    }

    function openSlot(dayIndex, hour, list) {
        if (!modalSlot) return;
        const base = viewMode === "DAY" ? startOfDay(cursorDate) : startOfWeek(cursorDate);
        const day = addDays(base, dayIndex);
        const hs = new Date(day); hs.setHours(hour, 0, 0, 0);
        const he = new Date(hs); he.setHours(hour + 1, 0, 0, 0);

        slotTitle.textContent = `${list.length} eventos`;
        slotWhen.textContent = `${hs.toLocaleDateString("pt-BR")} • ${String(hour).padStart(2, "0")}:00–${String(hour + 1).padStart(2, "0")}:00`;
        slotList.innerHTML = list
            .slice()
            .sort((a, b) => new Date(a.start) - new Date(b.start))
            .map(ev => {
                const s = new Date(ev.start);
                const e = new Date(ev.end);
                return `
                  <button type="button" class="month-ev w-100 text-start" data-ev-id="${esc(ev.id)}">
                    <div class="fw-semibold" style="line-height:1.05;">${esc(ev.title)}</div>
                    <div class="small text-muted">${esc(s.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))} - ${esc(e.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))} • ${esc(ev.eventType)}</div>
                  </button>
                `;
            }).join("");
        modalSlot.show();

        slotList.querySelectorAll("button[data-ev-id]").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-ev-id");
                const ev = list.find(x => String(x.id) === String(id));
                modalSlot.hide();
                if (ev) openEdit(ev, isMineOrAdmin(ev));
            });
        });
    }

    // ---------- Month view
    function buildMonth() {
        monthBody.innerHTML = "";

        const cols = getMonthCols();
        applyMonthCols(cols);
        if (monthHead) {
            const names = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
            monthHead.innerHTML = Array.from({ length: cols }, (_, i) => `<div>${names[i % 7]}</div>`).join("");
        }

        const monthStart = startOfMonth(cursorDate);
        rangeLabel.textContent = monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

        // grid sempre 6 semanas (42)
        let gridStart = startOfWeek(monthStart);

        for (let i = 0; i < 42; i++) {
            const dt = addDays(gridStart, i);
            const inMonth = dt.getMonth() === monthStart.getMonth();

            const cell = document.createElement("div");
            cell.className = `month-cell ${inMonth ? "" : "muted"}`;

            const dayStart = new Date(dt); dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dt); dayEnd.setHours(24, 0, 0, 0);

            const dayEventsAll = EVENTS.filter(ev => {
                const s = new Date(ev.start);
                const e = new Date(ev.end);
                return s < dayEnd && e > dayStart;
            });

            // Mês (admin): indicadores no lugar de títulos dentro do quadrinho
            const maxMarkers = (window.innerWidth <= 991) ? 6 : 10;
            const dayEvents = dayEventsAll.slice(0, maxMarkers);
            const moreCount = Math.max(0, dayEventsAll.length - maxMarkers);

            const markersHtml = dayEvents.map(ev => {
                const c = eventColor(ev);
                const tip = `${new Date(ev.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ${ev.title}`;
                return `<span class="month-marker square" data-eid="${esc(ev.id)}" style="background:${c}" title="${esc(tip)}"></span>`;
            }).join("");

            cell.innerHTML = `
        <div class="month-top">
          <span class="month-day">${dt.getDate()}</span>
          <span class="month-spacer"></span>
        </div>
        <div class="month-markers">
          ${markersHtml || ""}
          ${moreCount ? `<span class="month-count">+${moreCount}</span>` : ""}
        </div>
      `;

            cell.addEventListener("dblclick", () => {
                const start = new Date(dt); start.setHours(9, 0, 0, 0);
                const end = new Date(dt); end.setHours(10, 0, 0, 0);
                openCreate(start, end);
            });

            monthBody.appendChild(cell);
        }

        // click em indicador do mês
        monthBody.querySelectorAll(".month-marker[data-eid]").forEach(el => {
            el.addEventListener("click", (e) => {
                e.stopPropagation();
                const eid = el.getAttribute("data-eid");
                const ev = EVENTS.find(x => String(x.id) === String(eid));
                if (!ev) return;
                openEdit(ev, isMineOrAdmin(ev));
            });
        });

        if (window.lucide) lucide.createIcons();
    }

    // ---------- Modal: type UI
    function syncTypeUI() {
        const t = eventTypeInp.value;
        roomWrap.classList.toggle("d-none", t !== "MAXIMUM");
        addrWrap.classList.toggle("d-none", t !== "PRESENCIAL");
        onlineWrap.classList.toggle("d-none", t !== "ONLINE");
    }
    eventTypeInp.addEventListener("change", syncTypeUI);

    // ---------- Open modal
    function openCreate(start, end) {
        modalTitle.textContent = "Novo evento";
        eventId.value = "";

        titleInp.value = "";
        descInp.value = "";
        eventTypeInp.value = "MAXIMUM";
        syncTypeUI();

        if (roomIdInp.options.length) roomIdInp.selectedIndex = 0;
        clientAddressInp.value = "";

        selectedMembers = new Set();
        renderMembers();

        startInp.value = toLocalInputValue(start);
        endInp.value = toLocalInputValue(end);

        btnDelete.classList.add("d-none");
        showModalError("");
        eventForm.classList.remove("was-validated");

        // habilita campos
        [titleInp, descInp, eventTypeInp, roomIdInp, clientAddressInp, startInp, endInp].forEach(i => i.disabled = false);
        memberSearch.disabled = false;
        membersList.querySelectorAll("input").forEach(i => i.disabled = false);
        btnSave.disabled = false;

        modal.show();
    }

    function openEdit(ev, canEdit) {
        modalTitle.textContent = canEdit ? "Editar evento" : "Evento (somente leitura)";
        eventId.value = ev.id;

        titleInp.value = ev.title || "";
        descInp.value = ev.description || "";
        eventTypeInp.value = ev.eventType || "MAXIMUM";
        syncTypeUI();

        if (ev.roomId) roomIdInp.value = String(ev.roomId);
        else if (roomIdInp.options.length) roomIdInp.selectedIndex = 0;

        clientAddressInp.value = ev.clientAddress || "";

        selectedMembers = new Set((ev.participants || []).map(x => String(x)));
        renderMembers();

        startInp.value = toLocalInputValue(ev.start);
        endInp.value = toLocalInputValue(ev.end);

        // bloquear/permitir edição
        [titleInp, descInp, eventTypeInp, roomIdInp, clientAddressInp, startInp, endInp].forEach(i => i.disabled = !canEdit);
        btnSave.disabled = !canEdit;

        // checkboxes
        membersList.querySelectorAll("input[data-mid]").forEach(i => i.disabled = !canEdit);
        memberSearch.disabled = !canEdit;

        btnDelete.classList.toggle("d-none", !canEdit);

        showModalError("");
        eventForm.classList.remove("was-validated");
        modal.show();
    }

    // ---------- Submit
    eventForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        showModalError("");

        eventForm.classList.add("was-validated");
        if (!eventForm.checkValidity()) return;

        const t = eventTypeInp.value;

        const start = new Date(startInp.value);
        const end = new Date(endInp.value);

        if (end <= start) {
            showModalError("O fim precisa ser maior que o início.");
            return;
        }

        if (t === "PRESENCIAL" && !clientAddressInp.value.trim()) {
            showModalError("Informe o endereço do cliente (Presencial).");
            return;
        }

        if (t === "MAXIMUM" && (!roomIdInp.value || roomIdInp.value === "")) {
            showModalError("Selecione uma sala (Maximum).");
            return;
        }

        const payload = {
            title: titleInp.value.trim(),
            description: descInp.value.trim(),
            eventType: t,
            start: start.toISOString(),
            end: end.toISOString(),
            participants: Array.from(selectedMembers)
        };

        if (t === "MAXIMUM") payload.roomId = roomIdInp.value || null;
        if (t === "PRESENCIAL") payload.clientAddress = clientAddressInp.value.trim();

        try {
            setBusy(btnSave, true);

            const doSave = async (confirmConflicts) => {
                const body = confirmConflicts ? { ...payload, confirmConflicts: true } : payload;
                if (!eventId.value) {
                    await API.request("/api/events", { method: "POST", auth: true, body });
                } else {
                    await API.request(`/api/events/${eventId.value}`, { method: "PUT", auth: true, body });
                }
            };

            try {
                await doSave(false);
            } catch (err) {
                if (err?.status === 409 && (err.data?.memberConflicts?.length || err.data?.conflict)) {
                    const lines = [];
                    if (err.data?.memberConflicts?.length) {
                        const conflicts = err.data.memberConflicts;
                        const nameById = new Map((MEMBERS || []).map(m => [String(m.id), m.name]));
                        lines.push("Conflito de participantes:");
                        conflicts.slice(0, 8).forEach(c => {
                            const nm = nameById.get(String(c.memberId)) || `Membro ${String(c.memberId).slice(-6)}`;
                            lines.push(`• ${nm}: ${c.title}`);
                        });
                        if (conflicts.length > 8) lines.push(`... +${conflicts.length - 8} outros`);
                    }
                    if (err.data?.conflict) {
                        lines.push(`Sala ocupada: ${err.data.conflict.title}`);
                    }
                    const ok = confirm(`${err.message}\n\n${lines.join("\n")}\n\nDeseja salvar mesmo assim?`);
                    if (!ok) return;
                    await doSave(true);
                } else {
                    throw err;
                }
            }

            modal.hide();
            await refresh();
        } catch (err) {
            showModalError(err.message || "Erro ao salvar evento.");
        } finally {
            setBusy(btnSave, false);
        }
    });

    // ---------- Delete
    btnDelete.addEventListener("click", async () => {
        if (!eventId.value) return;
        if (!confirm("Excluir este evento?")) return;

        try {
            btnDelete.disabled = true;
            await API.request(`/api/events/${eventId.value}`, { method: "DELETE", auth: true });
            modal.hide();
            await refresh();
        } catch (err) {
            showModalError(err.message || "Erro ao excluir evento.");
        } finally {
            btnDelete.disabled = false;
        }
    });

    // ---------- View controls
    function setActiveViewButtons() {
        viewDayBtn.classList.toggle("active", viewMode === "DAY");
        viewWeekBtn.classList.toggle("active", viewMode === "WEEK");
        viewMonthBtn.classList.toggle("active", viewMode === "MONTH");

        aMViewDay?.classList.toggle("active", viewMode === "DAY");
        aMViewWeek?.classList.toggle("active", viewMode === "WEEK");
        aMViewMonth?.classList.toggle("active", viewMode === "MONTH");
    }

    function applyViewModeUI() {
        setActiveViewButtons();
        weekDayShell.classList.toggle("d-none", viewMode === "MONTH");
        monthShell.classList.toggle("d-none", viewMode !== "MONTH");
    }

    viewDayBtn.addEventListener("click", async () => { viewMode = "DAY"; applyViewModeUI(); await refresh(); });
    viewWeekBtn.addEventListener("click", async () => { viewMode = "WEEK"; applyViewModeUI(); await refresh(); });
    viewMonthBtn.addEventListener("click", async () => { viewMode = "MONTH"; applyViewModeUI(); await refresh(); });

    aMViewDay?.addEventListener("click", async () => { viewMode = "DAY"; applyViewModeUI(); await refresh(); });
    aMViewWeek?.addEventListener("click", async () => { viewMode = "WEEK"; applyViewModeUI(); await refresh(); });
    aMViewMonth?.addEventListener("click", async () => { viewMode = "MONTH"; applyViewModeUI(); await refresh(); });

    btnToday.addEventListener("click", async () => { cursorDate = new Date(); await refresh(); });

    btnPrev.addEventListener("click", async () => {
        if (viewMode === "DAY") cursorDate = addDays(cursorDate, -1);
        if (viewMode === "WEEK") cursorDate = addDays(cursorDate, -7);
        if (viewMode === "MONTH") cursorDate = addMonths(cursorDate, -1);
        await refresh();
    });

    btnNext.addEventListener("click", async () => {
        if (viewMode === "DAY") cursorDate = addDays(cursorDate, 1);
        if (viewMode === "WEEK") cursorDate = addDays(cursorDate, 7);
        if (viewMode === "MONTH") cursorDate = addMonths(cursorDate, 1);
        await refresh();
    });

    // ---------- Refresh
    async function refresh() {
        applyViewModeUI();

        if (viewMode === "DAY") {
            const from = startOfDay(cursorDate);
            const to = addDays(from, 1);
            rangeLabel.textContent = from.toLocaleDateString("pt-BR", { dateStyle: "full" });

            buildHeaderDay(from);
            buildGrid(1);
            await fetchEvents(from, to);
            renderEventsGrid(1);
        }

        if (viewMode === "WEEK") {
            const from = startOfWeek(cursorDate);
            const to = addDays(from, 7);
            rangeLabel.textContent = `${from.toLocaleDateString("pt-BR")} — ${addDays(from, 6).toLocaleDateString("pt-BR")}`;

            buildHeaderWeek(from);
            buildGrid(7);
            await fetchEvents(from, to);
            renderEventsGrid(7);
        }

        if (viewMode === "MONTH") {
            const from = startOfMonth(cursorDate);
            const to = startOfMonth(addMonths(from, 1));

            await fetchEvents(from, to);
            buildMonth();
        }

        if (window.lucide) lucide.createIcons();
    }

    // ---------- Init
    (async function init() {
        if (window.lucide) lucide.createIcons();

        await fetchRooms();
        await fetchMembers();

        syncTypeUI();
        applyViewModeUI();
        await refresh();
    })().catch(err => alert(err.message || "Erro ao carregar agenda."));
})()// ---------- Mobile / Colors ----------
  const isMobile = () => window.matchMedia && window.matchMedia("(max-width: 991px)").matches;

  const PALETTE = [
    "#7a1f3d", "#a12b56", "#3b82f6", "#10b981", "#f59e0b",
    "#8b5cf6", "#ef4444", "#14b8a6", "#0ea5e9", "#22c55e"
  ];

  function hashIdx(str, mod) {
    const s = String(str || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return mod ? (h % mod) : h;
  }

  function getRoomColorById(id) {
    if (!id) return null;
    const r = ROOMS.find(x => String(x.id) === String(id));
    return r?.color || null;
  }

  function hexToRgba(hex, a) {
    const h = String(hex || "").replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map(x=>x+x).join("") : h;
    if (full.length !== 6) return `rgba(122,31,61,${a||.18})`;
    const r = parseInt(full.slice(0,2),16);
    const g = parseInt(full.slice(2,4),16);
    const b = parseInt(full.slice(4,6),16);
    return `rgba(${r},${g},${b},${a ?? .18})`;
  }

  function eventColor(ev) {
    // prioridade: sala
    const roomColor = getRoomColorById(ev.roomId || ev.room || ev.room_id);
    if (roomColor) return roomColor;

    // sem sala: cor determinística por tipo/título
    const key = `${ev.eventType || "EVENT"}::${ev.title || ""}`;
    return PALETTE[hashIdx(key, PALETTE.length)];
  }
;