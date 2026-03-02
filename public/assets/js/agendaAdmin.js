// public/assets/js/agendaAdmin.js
(function () {
    const token = API.getToken();
    if (!token) { location.href = "/admin/login.html"; return; }

    const me = JSON.parse(localStorage.getItem("mh_user") || "null");

    // View buttons
    const viewDayBtn = document.getElementById("viewDay");
    const viewWeekBtn = document.getElementById("viewWeek");
    const viewMonthBtn = document.getElementById("viewMonth");

    // Shells
    const weekDayShell = document.getElementById("weekDayShell");
    const monthShell = document.getElementById("monthShell");

    // Calendar DOM
    const daysHeader = document.getElementById("daysHeader");
    const timeCol = document.getElementById("timeCol");
    const daysGrid = document.getElementById("daysGrid");
    const rangeLabel = document.getElementById("rangeLabel");
    const monthBody = document.getElementById("monthBody");

    // Nav buttons
    const btnPrev = document.getElementById("btnPrev");
    const btnToday = document.getElementById("btnToday");
    const btnNext = document.getElementById("btnNext");

    // Modal
    const modalEl = document.getElementById("modalEvent");
    const modal = new bootstrap.Modal(modalEl);
    const modalTitle = document.getElementById("modalTitle");
    const modalErr = document.getElementById("modalErr");

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

        for (const ev of EVENTS) {
            const start = new Date(ev.start);
            const end = new Date(ev.end);

            for (let dayIndex = 0; dayIndex < columns; dayIndex++) {
                const dayDate = addDays(base, dayIndex);
                dayDate.setHours(0, 0, 0, 0);

                const dayEnd = new Date(dayDate);
                dayEnd.setHours(24, 0, 0, 0);

                // evento não toca esse dia
                if (!(start < dayEnd && end > dayDate)) continue;

                const col = daysGrid.querySelector(`.day-col[data-day-index="${dayIndex}"]`);
                if (!col) continue;

                const segStart = start < dayDate ? dayDate : start;
                const segEnd = end > dayEnd ? dayEnd : end;

                const topMin = minutesSinceMidnight(segStart);
                const endMin = minutesSinceMidnight(segEnd);
                const durMin = Math.max(15, endMin - topMin);

                const topPx = (topMin / 60) * HOUR_HEIGHT;
                const heightPx = (durMin / 60) * HOUR_HEIGHT;

                const card = document.createElement("div");
                card.className = "event-card";
                card.style.top = `${topPx + 2}px`;
                card.style.height = `${Math.max(28, heightPx - 4)}px`;

                // cor por sala (MAXIMUM)
                if (ev.eventType === "MAXIMUM" && ev.roomId) {
                    const c = ROOM_COLOR.get(String(ev.roomId)) || "#7a1f3d";
                    card.style.borderColor = "rgba(15,23,42,.14)";
                    card.style.background = `linear-gradient(135deg, ${c}33, ${c}22)`;
                }

                const timeLabel =
                    `${String(segStart.getHours()).padStart(2, "0")}:${String(segStart.getMinutes()).padStart(2, "0")}` +
                    `–${String(segEnd.getHours()).padStart(2, "0")}:${String(segEnd.getMinutes()).padStart(2, "0")}`;

                card.innerHTML = `
          <div class="event-title">${esc(ev.title)}</div>
          <div class="event-time">${esc(timeLabel)} • ${esc(ev.eventType)}</div>
          <div class="event-meta">${esc(ev.description || "")}</div>
        `;

                card.addEventListener("click", () => openEdit(ev, isMineOrAdmin(ev)));
                col.appendChild(card);
            }
        }

        if (window.lucide) lucide.createIcons();
    }

    // ---------- Month view
    function buildMonth() {
        monthBody.innerHTML = "";

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

            const dayEvents = EVENTS.filter(ev => {
                const s = new Date(ev.start);
                const e = new Date(ev.end);
                return s < dayEnd && e > dayStart;
            }).slice(0, 4);

            const evHtml = dayEvents.map(ev => {
                const bg = (ev.eventType === "MAXIMUM" && ev.roomId)
                    ? (ROOM_COLOR.get(String(ev.roomId)) || "#7a1f3d")
                    : "#7a1f3d";

                return `<div class="month-ev" data-eid="${esc(ev.id)}" style="background:${bg}22;border-color:${bg}33;">
          ${esc(ev.title)}
        </div>`;
            }).join("");

            cell.innerHTML = `
        <div class="month-day">${dt.getDate()}</div>
        <div class="month-events">${evHtml || ""}</div>
      `;

            cell.addEventListener("dblclick", () => {
                const start = new Date(dt); start.setHours(9, 0, 0, 0);
                const end = new Date(dt); end.setHours(10, 0, 0, 0);
                openCreate(start, end);
            });

            monthBody.appendChild(cell);
        }

        // click em evento do mês
        monthBody.querySelectorAll(".month-ev").forEach(el => {
            el.addEventListener("click", () => {
                const eid = el.dataset.eid;
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

            if (!eventId.value) {
                await API.request("/api/events", { method: "POST", auth: true, body: payload });
            } else {
                await API.request(`/api/events/${eventId.value}`, { method: "PUT", auth: true, body: payload });
            }

            modal.hide();
            await refresh();
        } catch (err) {
            // ✅ Conflito de PARTICIPANTES
            if (err.status === 409 && err.data?.memberConflicts?.length) {
                const conflicts = err.data.memberConflicts;

                const nameById = new Map((MEMBERS || []).map(m => [String(m.id), m.name]));
                const lines = conflicts.slice(0, 10).map(c => {
                    const nm = nameById.get(String(c.memberId)) || `Membro ${String(c.memberId).slice(-6)}`;
                    const s = new Date(c.start).toLocaleString("pt-BR");
                    const e = new Date(c.end).toLocaleString("pt-BR");
                    return `• ${nm} já tem: "${c.title}" (${s} — ${e})`;
                });

                showModalError(`Conflito de agenda detectado:\n\n${lines.join("\n")}${conflicts.length > 10 ? `\n\n(+${conflicts.length - 10} conflitos)` : ""}`);
                return;
            }

            // ✅ Conflito de SALA
            if (err.status === 409 && err.data?.conflict) {
                const c = err.data.conflict;
                const s = new Date(c.start).toLocaleString("pt-BR");
                const e = new Date(c.end).toLocaleString("pt-BR");
                showModalError(`Sala ocupada neste intervalo.\nConflito: "${c.title}" (${s} — ${e})`);
                return;
            }

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
    }

    function applyViewModeUI() {
        setActiveViewButtons();
        weekDayShell.classList.toggle("d-none", viewMode === "MONTH");
        monthShell.classList.toggle("d-none", viewMode !== "MONTH");
    }

    viewDayBtn.addEventListener("click", async () => { viewMode = "DAY"; applyViewModeUI(); await refresh(); });
    viewWeekBtn.addEventListener("click", async () => { viewMode = "WEEK"; applyViewModeUI(); await refresh(); });
    viewMonthBtn.addEventListener("click", async () => { viewMode = "MONTH"; applyViewModeUI(); await refresh(); });

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
})();