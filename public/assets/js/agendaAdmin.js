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


  // Bootstrap safety: se scripts externos forem bloqueados (CSP), não deixa a agenda "morrer".
  function getModal(el) {
    if (!el) return null;
    try {
      if (window.bootstrap && window.bootstrap.Modal) return new window.bootstrap.Modal(el);
    } catch (_) {}
    // Fallback bem simples (não tem backdrop/esc/etc) — só para não quebrar o grid.
    return {
      show() { el.classList.add("show"); el.style.display = "block"; el.removeAttribute("aria-hidden"); },
      hide() { el.classList.remove("show"); el.style.display = "none"; el.setAttribute("aria-hidden","true"); }
    };
  }

    // Nav buttons
    const btnPrev = document.getElementById("btnPrev");
    const btnToday = document.getElementById("btnToday");
    const btnNext = document.getElementById("btnNext");

    // Modal
    const modalEl = document.getElementById("modalEvent");
    const modal = getModal(modalEl);
    const modalTitle = document.getElementById("modalTitle");
    const modalErr = document.getElementById("modalErr");

    // Slot modal (multi-event)
    const modalSlotEl = document.getElementById("modalSlot");
    const modalSlot = getModal(modalSlotEl);
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

    // Recorrência (criação em lote)
    const isRecurringInp = document.getElementById("isRecurring");
    const recurrenceWrap = document.getElementById("recurrenceWrap");
    const recurrenceEveryInp = document.getElementById("recurrenceEvery");
    const customEveryWrap = document.getElementById("customEveryWrap");
    const customEveryDaysInp = document.getElementById("customEveryDays");
    const recurrenceCalendarInp = document.getElementById("recurrenceCalendar");
    const recurrenceWorkdaysInp = document.getElementById("recurrenceWorkdays");


    function setRecurrenceUI() {
        const on = !!isRecurringInp?.checked && !eventId?.value;
        recurrenceWrap?.classList.toggle("d-none", !on);

        const isCustom = (recurrenceEveryInp?.value === "CUSTOM");
        customEveryWrap?.classList.toggle("d-none", !on || !isCustom);
    }

    isRecurringInp?.addEventListener("change", setRecurrenceUI);
    recurrenceEveryInp?.addEventListener("change", setRecurrenceUI);

    // ----- Recorrência helpers (dias corridos / úteis com feriados BR)
    const HOL_CACHE = new Map(); // year -> Set("YYYY-MM-DD")

    function ymd(d) {
        const dt = new Date(d);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const day = String(dt.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    async function getHolidaySet(year) {
        if (HOL_CACHE.has(year)) return HOL_CACHE.get(year);
        try {
            const list = await API.request(`/api/holidays/${year}`, { auth: true });
            const set = new Set(Array.isArray(list) ? list : []);
            HOL_CACHE.set(year, set);
            return set;
        } catch {
            const set = new Set();
            HOL_CACHE.set(year, set);
            return set;
        }
    }

    function isWeekend(dt) {
        const day = dt.getDay();
        return day === 0 || day === 6;
    }

    async function addWorkdays(base, days) {
        let cur = new Date(base);
        let remaining = Number(days) || 0;
        if (remaining <= 0) return cur;

        while (remaining > 0) {
            cur.setDate(cur.getDate() + 1);

            if (isWeekend(cur)) continue;

            const set = await getHolidaySet(cur.getFullYear());
            if (set.has(ymd(cur))) continue;

            remaining -= 1;
        }
        return cur;
    }

    function addCalendarDays(base, days) {
        const cur = new Date(base);
        cur.setDate(cur.getDate() + (Number(days) || 0));
        return cur;
    }

    function getRecurrenceEveryDays() {
        const v = recurrenceEveryInp?.value;
        if (!v) return null;
        if (v === "CUSTOM") {
            const n = Number(customEveryDaysInp?.value);
            return Number.isFinite(n) && n > 0 ? n : null;
        }
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : null;
    }

    function isWorkdaysMode() {
        return !!recurrenceWorkdaysInp?.checked;
    }



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

        const PX_PER_HOUR = 48;
        const PX_PER_MIN = PX_PER_HOUR / 60;

        const base = viewMode === "DAY" ? startOfDay(cursorDate) : startOfWeek(cursorDate);
        const days = [];
        for (let i = 0; i < columns; i++) days.push(addDays(base, i));

        const minutesFromDayStart = (dt, day0) => Math.round((dt.getTime() - day0.getTime()) / 60000);

        for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
            const d = days[dayIndex];
            const col = daysGrid.querySelector(`.day-col[data-day="${dayIndex}"]`);
            if (!col) continue;

            const day0 = startOfDay(d);
            const day1 = addDays(day0, 1);

            const slices = [];
            for (const ev of EVENTS) {
                if (!(ev.start < day1 && ev.end > day0)) continue;

                const s = new Date(Math.max(ev.start.getTime(), day0.getTime()));
                const e = new Date(Math.min(ev.end.getTime(), day1.getTime()));
                if (e <= s) continue;

                const startMin = clamp(minutesFromDayStart(s, day0), 0, 24 * 60);
                const endMin = clamp(minutesFromDayStart(e, day0), 0, 24 * 60);

                slices.push({ ev, startMin, endMin, lane: 0, group: -1 });
            }

            if (!slices.length) continue;

            // lanes (greedy)
            slices.sort((a, b) => (a.startMin - b.startMin) || (a.endMin - b.endMin));

            const active = [];
            const used = new Set();

            const releaseEnded = (t) => {
                for (let i = active.length - 1; i >= 0; i--) {
                    if (active[i].endMin <= t) {
                        used.delete(active[i].lane);
                        active.splice(i, 1);
                    }
                }
            };
            const nextFreeLane = () => {
                for (let l = 0; l < 30; l++) if (!used.has(l)) return l;
                return 0;
            };

            for (let i = 0; i < slices.length; i++) {
                const it = slices[i];
                releaseEnded(it.startMin);

                const lane = nextFreeLane();
                it.lane = lane;
                used.add(lane);
                active.push({ endMin: it.endMin, lane, idx: i });
            }

            // grupos (union-find)
            const parent = Array.from({ length: slices.length }, (_, i) => i);
            const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
            const uni = (a, b) => {
                a = find(a); b = find(b);
                if (a !== b) parent[b] = a;
            };

            for (let i = 0; i < slices.length; i++) {
                for (let j = i + 1; j < slices.length; j++) {
                    if (slices[j].startMin >= slices[i].endMin) break;
                    uni(i, j);
                }
            }

            const groupMaxLane = new Map();
            for (let i = 0; i < slices.length; i++) {
                const g = find(i);
                slices[i].group = g;
                groupMaxLane.set(g, Math.max(groupMaxLane.get(g) ?? -1, slices[i].lane));
            }

            // render blocos (um único bloco por evento, sem cortar por hora)
            for (const it of slices) {
                const lanes = (groupMaxLane.get(it.group) ?? 0) + 1;
                const widthPct = 100 / lanes;
                const leftPct = it.lane * widthPct;

                const top = it.startMin * PX_PER_MIN;
                const height = Math.max((it.endMin - it.startMin) * PX_PER_MIN, 18);

                const pill = document.createElement("button");
                pill.type = "button";
                pill.className = "event-card";
                pill.style.top = `${top}px`;
                pill.style.height = `${height}px`;
                pill.style.left = `${leftPct}%`;
                pill.style.width = `${widthPct}%`;

                const c = eventColor(it.ev);
                pill.style.borderColor = c;
                pill.style.background = `linear-gradient(135deg, ${hexToRgba(c, .18)}, ${hexToRgba(c, .10)})`;
                pill.style.boxShadow = `0 10px 24px ${hexToRgba(c, .18)}`;
                pill.style.setProperty("--evc", c);

                pill.title = it.ev.title || "Evento";
                pill.innerHTML = `
                    <div class="event-title">${esc(it.ev.title || "Evento")}</div>
                    <div class="event-meta">${esc(fmtTime(it.ev.start))} - ${esc(fmtTime(it.ev.end))}</div>
                `;
                pill.addEventListener("click", (e) => { e.stopPropagation(); openDetails(it.ev); });

                col.appendChild(pill);
            }
        }
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

        // Recorrência (apenas para criação)
        if (isRecurringInp) isRecurringInp.checked = false;
        if (recurrenceCalendarInp) recurrenceCalendarInp.checked = true;
        if (recurrenceEveryInp) recurrenceEveryInp.value = "7";
        if (customEveryDaysInp) customEveryDaysInp.value = "";
        setRecurrenceUI();


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

        // Recorrência desabilitada na edição (somente na criação)
        if (isRecurringInp) isRecurringInp.checked = false;
        if (customEveryDaysInp) customEveryDaysInp.value = "";
        setRecurrenceUI();


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

            const saveOne = async (body, confirmConflicts) => {
                const finalBody = confirmConflicts ? { ...body, confirmConflicts: true } : body;
                if (!eventId.value) {
                    await API.request("/api/events", { method: "POST", auth: true, body: finalBody });
                } else {
                    await API.request(`/api/events/${eventId.value}`, { method: "PUT", auth: true, body: finalBody });
                }
            };

            const doSave = async () => {
                // edição = único
                if (eventId.value) {
                    await saveOne(payload, false);
                    return { created: 1 };
                }

                // criação pode ser recorrente
                const recurring = !!isRecurringInp?.checked;
                if (!recurring) {
                    await saveOne(payload, false);
                    return { created: 1 };
                }

                const everyDays = getRecurrenceEveryDays();
                if (!everyDays) throw new Error("Informe a recorrência (quantos dias).");

                const baseStart = new Date(payload.start);
                const baseEnd = new Date(payload.end);
                const dur = baseEnd.getTime() - baseStart.getTime();
                if (!(dur > 0)) throw new Error("O fim precisa ser maior que o início.");

                const limit = new Date(baseStart);
                limit.setFullYear(limit.getFullYear() + 1);

                const occs = [];
                let curStart = new Date(baseStart);
                let count = 0;
                while (curStart <= limit && count < 200) {
                    const curEnd = new Date(curStart.getTime() + dur);
                    occs.push({ start: new Date(curStart), end: curEnd });
                    count += 1;

                    curStart = isWorkdaysMode()
                        ? await addWorkdays(curStart, everyDays)
                        : addCalendarDays(curStart, everyDays);
                }

                let created = 0;
                for (const occ of occs) {
                    const body = { ...payload, start: occ.start.toISOString(), end: occ.end.toISOString() };

                    try {
                        await API.request("/api/events", { method: "POST", auth: true, body });
                        created += 1;
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
                            const ok = confirm(`${err.message}\n\n${lines.join("\n")}\n\nDeseja criar mesmo assim esta ocorrência?`);
                            if (!ok) throw new Error("Criação recorrente cancelada.");
                            await API.request("/api/events", { method: "POST", auth: true, body: { ...body, confirmConflicts: true } });
                            created += 1;
                        } else {
                            throw err;
                        }
                    }
                }

                return { created };
            };
            };

            try {
                const r = await doSave();
                var __createdCount = r?.created || 1;
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
            if (__createdCount > 1) alert(`Eventos criados: ${__createdCount}`);
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
            if (__createdCount > 1) alert(`Eventos criados: ${__createdCount}`);
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