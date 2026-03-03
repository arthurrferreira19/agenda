// public/assets/js/userAgenda.js
(function () {
  const token = API.getToken();
  if (!token) { location.href = "/user/login.html"; return; }

  const me = JSON.parse(localStorage.getItem("mh_user") || "null");
  if (!me || me.role !== "USER") {
    API.clearToken();
    localStorage.removeItem("mh_user");
    location.href = "/user/login.html";
    return;
  }

  // Logout (sidebar e mobile)
  document.addEventListener("click", (e) => {
    const t = e.target;
    const btn = t?.closest?.("#btnLogout, #btnLogoutMobile");
    if (!btn) return;
    API.clearToken();
    localStorage.removeItem("mh_user");
    location.href = "/user/login.html";
  });

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
  const stateShell = document.getElementById("stateShell");
  const weekStrip = document.getElementById("weekStrip");

  // Month DOM
  const monthHead = document.getElementById("monthHead");
  const monthBody = document.getElementById("monthBody");

  // Controls
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnToday = document.getElementById("btnToday");
  const btnNewEvent = document.getElementById("btnNewEvent");
  const monthColsSelect = document.getElementById("monthColsSelect");

  // Bootstrap safety (CSP)
  function getModal(el) {
    if (!el) return null;
    try {
      if (window.bootstrap && window.bootstrap.Modal) return new window.bootstrap.Modal(el);
    } catch (_) { /* ignore */ }

    return {
      show() { el.classList.add("show"); el.style.display = "block"; el.removeAttribute("aria-hidden"); },
      hide() { el.classList.remove("show"); el.style.display = "none"; el.setAttribute("aria-hidden", "true"); }
    };
  }

  // Modals
  const modalEventEl = document.getElementById("modalEvent");
  const modalDetailsEl = document.getElementById("modalDetails");
  const modalEvent = getModal(modalEventEl);
  const modalDetails = getModal(modalDetailsEl);

  // Form fields
  const modalEventTitle = document.getElementById("modalEventTitle");
  const eventId = document.getElementById("eventId");
  const title = document.getElementById("title");
  const eventType = document.getElementById("eventType");
  const start = document.getElementById("start");
  const end = document.getElementById("end");

  // Recorrência (criação em lote)
  const isRecurringInp = document.getElementById("isRecurring");
  const recurrenceWrap = document.getElementById("recurrenceWrap");
  const recurrenceEveryInp = document.getElementById("recurrenceEvery");
  const customEveryWrap = document.getElementById("customEveryWrap");
  const customEveryDaysInp = document.getElementById("customEveryDays");
  const recurrenceCalendarInp = document.getElementById("recurrenceCalendar");
  const recurrenceWorkdaysInp = document.getElementById("recurrenceWorkdays");

  const roomRow = document.getElementById("roomRow");
  const roomId = document.getElementById("roomId");
  const addressRow = document.getElementById("addressRow");
  const clientAddress = document.getElementById("clientAddress");
  const description = document.getElementById("description");
  const eventErr = document.getElementById("eventErr");
  const btnSaveEvent = document.getElementById("btnSaveEvent");
  const btnDeleteEvent = document.getElementById("btnDeleteEvent");

  // Participants
  const memberSearch = document.getElementById("memberSearch");
  const membersList = document.getElementById("membersList");
  let MEMBERS = [];
  let selectedMembers = new Set();

  // Mobile bottom nav
  const mViewDay = document.getElementById("mViewDay");
  const mViewWeek = document.getElementById("mViewWeek");
  const mViewMonth = document.getElementById("mViewMonth");

  // Details
  const dTitle = document.getElementById("dTitle");
  const dWhen = document.getElementById("dWhen");
  const dType = document.getElementById("dType");
  const dDesc = document.getElementById("dDesc");
  const dExtra = document.getElementById("dExtra");
  const dMeet = document.getElementById("dMeet");
  const dMeetLink = document.getElementById("dMeetLink");
  const btnCopyMeet = document.getElementById("btnCopyMeet");
  const btnEditFromDetails = document.getElementById("btnEditFromDetails");
  const dPerm = document.getElementById("dPerm");

  let VIEW = (window.matchMedia && window.matchMedia("(max-width: 991px)").matches) ? "DAY" : "WEEK"; // DAY | WEEK | MONTH
  let SELECTED_DAY_KEY = null;
  let anchor = new Date();
  let EVENTS = [];
  let ROOMS = [];
  let detailsEvent = null;

  // ---------- Mobile / Helpers ----------
  const isMobile = () => window.matchMedia && window.matchMedia("(max-width: 991px)").matches;

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
    const full = h.length === 3 ? h.split("").map(x => x + x).join("") : h;
    if (full.length !== 6) return `rgba(122,31,61,${a || .18})`;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a ?? .18})`;
  }

  function eventColor(ev) {
    const roomColor = getRoomColorById(ev.roomId || ev.room || ev.room_id);
    if (roomColor) return roomColor;

    const key = `${ev.eventType || "EVENT"}::${ev.title || ""}`;
    return PALETTE[hashIdx(key, PALETTE.length)];
  }

  function esc(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showState(type, msg) {
    if (!stateShell) return;
    if (!msg) { stateShell.innerHTML = ""; return; }
    stateShell.innerHTML = `<div class="alert alert-${type} fade-in" style="border-radius:16px;">${esc(msg)}</div>`;
  }

  function showFormErr(msg) {
    if (!eventErr) return;
    if (!msg) { eventErr.innerHTML = ""; return; }
    eventErr.innerHTML = `<div class="alert alert-danger fade-in" style="border-radius:16px;">${esc(msg)}</div>`;
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  // yyyy-mm-ddThh:mm local
  function toLocalInput(dt) {
    const d = new Date(dt);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  function startOfWeek(d) {
    const x = startOfDay(d);
    const day = x.getDay(); // 0 dom .. 6 sáb
    const diff = (day + 6) % 7; // segunda=0
    x.setDate(x.getDate() - diff);
    return x;
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function fmtDayShort(d) {
    return new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(d).replace(".", "");
  }

  function fmtDate(d) {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  }

  function fmtTime(d) {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
  }

  function fmtRange(from, to) {
    return `${fmtDate(from)} – ${fmtDate(to)}`;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function uniqStrings(arr) {
    return Array.from(new Set((arr || []).map(x => String(x))));
  }

  function roleBadge(type) {
    const t = String(type || "").toUpperCase();
    if (t === "ONLINE") return "Online";
    if (t === "PRESENCIAL") return "Presencial";
    return "Maximum";
  }

  function roomName(id) {
    const r = ROOMS.find(x => String(x.id) === String(id));
    return r ? r.name : "Sala";
  }

  function memberName(id) {
    const m = MEMBERS.find(x => String(x.id) === String(id));
    return m ? m.name : "Membro";
  }

  // ---------- Data ----------
  async function loadRooms() {
    try {
      const data = await API.request("/api/rooms/active", { auth: true });
      ROOMS = (data.rooms || []).map(r => ({ id: r.id, name: r.name, color: r.color }));
      if (roomId) roomId.innerHTML = ROOMS.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");
    } catch (e) {
      ROOMS = [];
      if (roomId) roomId.innerHTML = `<option value="">(Sem salas)</option>`;
    }
  }

  async function loadMembers() {
    try {
      const data = await API.request("/api/users/members", { auth: true });
      MEMBERS = (data.members || []).map(m => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role
      }));
    } catch {
      MEMBERS = [];
    }
    renderMembers();
  }

  function renderMembers() {
    if (!membersList) return;
    const term = String(memberSearch?.value || "").trim().toLowerCase();
    const list = MEMBERS
      .filter(m => !term || `${m.name} ${m.email}`.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));

    membersList.innerHTML = list.map(m => {
      const checked = selectedMembers.has(String(m.id)) ? "checked" : "";
      const disabled = String(m.id) === String(me.id) ? "disabled" : "";
      return `
        <label class="d-flex align-items-center gap-2 py-1" style="cursor:pointer;">
          <input type="checkbox" class="form-check-input" data-member-id="${esc(m.id)}" ${checked} ${disabled}>
          <div class="flex-grow-1">
            <div class="fw-semibold" style="line-height:1.05;">${esc(m.name)}</div>
            <div class="small text-muted">${esc(m.email || "")}</div>
          </div>
          <span class="badge text-bg-light">${esc(m.role || "")}</span>
        </label>
      `;
    }).join("");

    membersList.querySelectorAll("input[type=checkbox][data-member-id]").forEach(chk => {
      chk.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-member-id");
        if (!id) return;
        if (e.target.checked) selectedMembers.add(String(id));
        else selectedMembers.delete(String(id));
      });
    });

    window.MHIcons?.refresh?.();
  }

  memberSearch?.addEventListener("input", renderMembers);

  function getRange() {
    if (VIEW === "DAY") {
      const from = startOfDay(anchor);
      const to = addDays(from, 1);
      return { from, to };
    }
    if (VIEW === "MONTH") {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      const from = startOfDay(addDays(first, -7));
      const to = addDays(endOfDay(addDays(last, 7)), 1);
      return { from, to };
    }
    const from = startOfWeek(anchor);
    const to = addDays(from, 7);
    return { from, to };
  }

  async function loadEvents() {
    const { from, to } = getRange();
    try {
      showState("", "");
      if (rangeLabel) {
        rangeLabel.textContent = VIEW === "MONTH"
          ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(anchor)
          : fmtRange(from, addDays(to, -1));
      }

      const data = await API.request(
        `/api/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        { auth: true }
      );

      EVENTS = (data.events || []).map(ev => ({
        ...ev,
        start: new Date(ev.start),
        end: new Date(ev.end)
      }));
    } catch (e) {
      if (e?.status === 401) {
        API.clearToken();
        localStorage.removeItem("mh_user");
        location.href = "/user/login.html";
        return;
      }
      showState("danger", e.message || "Erro ao carregar eventos.");
      EVENTS = [];
    }
  }

  // ---------- Render Week/Day ----------
  function buildTimeCol() {
    if (!timeCol) return;
    timeCol.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (let h = 0; h < 24; h++) {
      const div = document.createElement("div");
      div.className = "time-slot";
      div.textContent = `${pad(h)}:00`;
      frag.appendChild(div);
    }
    timeCol.appendChild(frag);
  }

  function buildDaysHeader(days) {
    if (!daysHeader) return;
    daysHeader.innerHTML = "";
    daysHeader.style.display = "grid";
    daysHeader.style.gridTemplateColumns = `repeat(${days.length}, 1fr)`;

    days.forEach((d) => {
      const isToday = sameDay(d, new Date());
      const cell = document.createElement("div");
      cell.className = "cal-day-head";
      cell.innerHTML = `
        <div class="d-flex align-items-center justify-content-between">
          <span class="${isToday ? "text-wine fw-semibold" : ""}">${esc(fmtDayShort(d))}</span>
          <span class="badge ${isToday ? "badge-wine" : "badge-soft"}">${pad(d.getDate())}/${pad(d.getMonth() + 1)}</span>
        </div>
      `;
      daysHeader.appendChild(cell);
    });
  }

  function buildGrid(days) {
    if (!daysGrid) return;
    daysGrid.innerHTML = "";
    daysGrid.style.display = "grid";
    daysGrid.style.gridTemplateColumns = `repeat(${days.length}, 1fr)`;

    days.forEach((d) => {
      const col = document.createElement("div");
      col.className = "day-col";
      col.dataset.date = d.toISOString();

      for (let h = 0; h < 24; h++) {
        const slot = document.createElement("div");
        slot.className = "hour-row";
        slot.dataset.hour = String(h);
        col.appendChild(slot);
      }

      col.addEventListener("click", (ev) => {
        const target = ev.target.closest(".hour-row");
        if (!target) return;
        if (ev.target.closest(".event-card")) return;

        const hour = parseInt(target.dataset.hour, 10);
        const s = new Date(d);
        s.setHours(hour, 0, 0, 0);
        const e2 = new Date(s);
        e2.setHours(s.getHours() + 1);

        openCreate({ start: s, end: e2 });
      });

      daysGrid.appendChild(col);
    });
  }

  function renderEventsInGrid(days) {
    if (!daysGrid) return;

    daysGrid.querySelectorAll(".event-card").forEach(el => el.remove());

    const PX_PER_HOUR = 48; // deve bater com CSS
    const PX_PER_MIN = PX_PER_HOUR / 60;

    const minutesFromDayStart = (dt, day0) => Math.round((dt.getTime() - day0.getTime()) / 60000);

    for (const d of days) {
      const col = daysGrid.querySelector(`.day-col[data-date="${d.toISOString()}"]`);
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

      // layout de sobreposição
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

      // grupos para width consistente
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
          <div class="event-meta">${esc(fmtTime(it.ev.start))} - ${esc(fmtTime(it.ev.end))} • ${esc(roleBadge(it.ev.eventType))}</div>
        `;
        pill.addEventListener("click", (e) => { e.stopPropagation(); openDetails(it.ev); });

        col.appendChild(pill);
      }
    }
  }

  function buildWeekStrip(weekStart) {
    if (!weekStrip) return;
    if (!(VIEW === "WEEK" && isMobile()) || !weekStart) {
      weekStrip.classList.add("d-none");
      weekStrip.innerHTML = "";
      return;
    }
    weekStrip.classList.remove("d-none");
    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));

    weekStrip.innerHTML = days.map(d => {
      const active = sameDay(d, anchor) ? "active" : "";
      return `
        <button type="button" class="wday ${active}" data-wday="${d.toISOString()}">
          <div class="dow">${esc(fmtDayShort(d))}</div>
          <div class="num">${d.getDate()}</div>
        </button>
      `;
    }).join("");

    weekStrip.querySelectorAll("button[data-wday]").forEach(btn => {
      btn.addEventListener("click", () => {
        const iso = btn.getAttribute("data-wday");
        if (!iso) return;
        const d = new Date(iso);
        anchor = startOfDay(d);
        buildWeekStrip(startOfWeek(anchor));
        setActiveViewButtons();
        renderWeekDay();
      });
    });

    const activeBtn = weekStrip.querySelector(".wday.active");
    activeBtn?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }

  function renderWeekDay() {
    if (VIEW === "WEEK" && isMobile()) buildWeekStrip(startOfWeek(anchor));
    else buildWeekStrip(null);

    const days = [];
    if (VIEW === "DAY") {
      days.push(startOfDay(anchor));
    } else {
      if (isMobile()) {
        days.push(startOfDay(anchor));
      } else {
        const from = startOfWeek(anchor);
        for (let i = 0; i < 7; i++) days.push(addDays(from, i));
      }
    }

    buildTimeCol();
    buildDaysHeader(days);
    buildGrid(days);
    renderEventsInGrid(days);
  }

  // ---------- Month ----------
  function buildMonth() {
    if (!monthHead || !monthBody) return;

    monthHead.innerHTML = "";
    monthBody.innerHTML = "";

    const names = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const cols = getMonthCols();
    applyMonthCols(cols);

    monthHead.innerHTML = Array.from({ length: cols }, (_, i) => names[i % 7])
      .map(n => `<div class="month-hcell">${n}</div>`).join("");

    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const firstWeekStart = startOfWeek(first);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const lastWeekEnd = addDays(startOfWeek(addDays(last, 1)), 7);

    const days = [];
    for (let d = new Date(firstWeekStart); d < lastWeekEnd; d = addDays(d, 1)) {
      days.push(new Date(d));
    }
    while (days.length % cols !== 0) {
      days.push(addDays(days[days.length - 1], 1));
    }

    // mapa de eventos por dia (intersecta)
    const map = new Map();
    for (const ev of EVENTS) {
      const evStartDay = startOfDay(ev.start);
      const evEnd = new Date(ev.end);
      const endDay = startOfDay(evEnd);
      // inclui o dia final se houver qualquer tempo dentro dele
      const lastDay = (evEnd > endDay) ? addDays(endDay, 1) : endDay;

      for (let d = new Date(evStartDay); d < lastDay; d = addDays(d, 1)) {
        const key = startOfDay(d).toISOString().slice(0, 10);
        const arr = map.get(key) || [];
        arr.push(ev);
        map.set(key, arr);
      }
    }

    days.forEach((d) => {
      const inMonth = d.getMonth() === anchor.getMonth();
      const key = startOfDay(d).toISOString().slice(0, 10);
      const evs = map.get(key) || [];

      const cell = document.createElement("div");
      const maxMarkers = isMobile() ? 6 : 10;
      const moreCount = Math.max(0, evs.length - maxMarkers);
      const showPlus = (!isMobile() && evs.length === 0);
      const isToday = sameDay(d, new Date());
      const selected = (SELECTED_DAY_KEY && SELECTED_DAY_KEY === key);

      cell.className = `month-cell ${inMonth ? "" : "muted"} ${isToday ? "is-today" : ""} ${selected ? "selected" : ""}`;

      const markersHtml = evs.slice(0, maxMarkers).map(ev => {
        const c = eventColor(ev);
        const rName = (ROOMS.find(r => String(r.id) === String(ev.roomId || ev.room || ev.room_id))?.name) || "";
        const tip = `${fmtTime(ev.start)} ${ev.title}${rName ? ` • ${rName}` : ""}`;
        return `<span class="month-marker square" data-ev-id="${esc(ev.id)}" style="background:${c}" title="${esc(tip)}"></span>`;
      }).join("");

      cell.innerHTML = `
        <div class="month-top">
          <span class="month-day">${d.getDate()}</span>
          ${showPlus ? `<button class="btn btn-sm btn-ghost month-add" type="button" title="Novo evento"><i data-lucide="plus"></i></button>` : `<span class="month-spacer"></span>`}
        </div>
        <div class="month-markers">
          ${markersHtml || ""}
          ${moreCount ? `<span class="month-count">+${moreCount}</span>` : ""}
        </div>
      `;

      cell.querySelector(".month-add")?.addEventListener("click", (e) => {
        e.stopPropagation();
        const s = new Date(d);
        s.setHours(9, 0, 0, 0);
        const e2 = new Date(s);
        e2.setHours(s.getHours() + 1);
        openCreate({ start: s, end: e2 });
      });

      cell.addEventListener("click", () => {
        SELECTED_DAY_KEY = key;
        if (VIEW === "MONTH") buildMonth();

        if (!evs.length) {
          const s = new Date(d); s.setHours(9, 0, 0, 0);
          const e2 = new Date(s); e2.setHours(10, 0, 0, 0);
          openCreate({ start: s, end: e2 });
          return;
        }
        if (evs.length === 1) {
          openDetails(evs[0]);
          return;
        }
        openDayDetails(d, evs);
      });

      Array.from(cell.querySelectorAll(".month-marker[data-ev-id]")).forEach((mk) => {
        mk.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = mk.getAttribute("data-ev-id");
          const ev = EVENTS.find(x => String(x.id) === String(id));
          if (ev) openDetails(ev);
        });
      });

      monthBody.appendChild(cell);
    });

    window.MHIcons?.refresh?.();
  }

  function openDayDetails(day, list) {
    dTitle.textContent = `${list.length} eventos`;
    dType.textContent = "";
    dWhen.textContent = `${fmtDate(day)}`;

    dDesc.innerHTML = list
      .slice()
      .sort((a, b) => a.start - b.start)
      .map(ev => `
        <button type="button" class="month-ev w-100 text-start" style="display:block;border-left:4px solid ${eventColor(ev)}" data-ev-id="${esc(ev.id)}">
          <div class="fw-semibold" style="line-height:1.05;">${esc(ev.title)}</div>
          <div class="small text-muted">${esc(fmtTime(ev.start))} - ${esc(fmtTime(ev.end))} • ${esc(roleBadge(ev.eventType))}</div>
        </button>
      `).join("");

    dExtra.textContent = "";
    dMeet.classList.add("d-none");
    dMeetLink.textContent = "";
    dPerm.textContent = "Selecione um evento para ver detalhes.";
    btnEditFromDetails.disabled = true;
    detailsEvent = null;

    modalDetails?.show();
    window.MHIcons?.refresh?.();

    dDesc.querySelectorAll("button[data-ev-id]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-ev-id");
        const ev = list.find(x => String(x.id) === String(id));
        if (ev) openDetails(ev);
      });
    });
  }

  // ---------- Modal logic ----------
  function setTypeUI() {
    const t = String(eventType?.value || "").toUpperCase();

    if (t === "MAXIMUM") {
      roomRow?.classList.remove("d-none");
      addressRow?.classList.add("d-none");
    } else if (t === "PRESENCIAL") {
      roomRow?.classList.add("d-none");
      addressRow?.classList.remove("d-none");
    } else {
      roomRow?.classList.add("d-none");
      addressRow?.classList.add("d-none");
    }
  }

  eventType?.addEventListener("change", setTypeUI);

  function setRecurrenceUI() {
    const on = !!isRecurringInp?.checked && !eventId?.value;
    recurrenceWrap?.classList.toggle("d-none", !on);

    const isCustom = (recurrenceEveryInp?.value === "CUSTOM");
    customEveryWrap?.classList.toggle("d-none", !on || !isCustom);
  }

  isRecurringInp?.addEventListener("change", setRecurrenceUI);
  recurrenceEveryInp?.addEventListener("change", setRecurrenceUI);

  function openCreate({ start: s, end: e } = {}) {
    detailsEvent = null;
    if (modalEventTitle) modalEventTitle.textContent = "Novo evento";
    if (eventId) eventId.value = "";
    if (title) title.value = "";
    if (description) description.value = "";
    if (clientAddress) clientAddress.value = "";
    if (eventType) eventType.value = "MAXIMUM";
    setTypeUI();

    selectedMembers = new Set();
    renderMembers();

    const now = new Date();
    const s0 = s || new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    const e0 = e || new Date(s0.getTime() + 60 * 60 * 1000);

    if (start) start.value = toLocalInput(s0);
    if (end) end.value = toLocalInput(e0);

    if (ROOMS.length && roomId) roomId.value = ROOMS[0].id;

    btnDeleteEvent?.classList.add("d-none");
    showFormErr("");
    if (isRecurringInp) isRecurringInp.checked = false;
    if (customEveryDaysInp) customEveryDaysInp.value = "";
    if (recurrenceCalendarInp) recurrenceCalendarInp.checked = true;
    if (recurrenceWorkdaysInp) recurrenceWorkdaysInp.checked = false;
    setRecurrenceUI();

    modalEvent?.show();
    window.MHIcons?.refresh?.();
  }

  function openEdit(ev) {
    detailsEvent = ev;
    if (modalEventTitle) modalEventTitle.textContent = "Editar evento";
    if (eventId) eventId.value = ev.id;

    // Recorrência desabilitada na edição (somente criação)
    if (isRecurringInp) isRecurringInp.checked = false;
    if (customEveryDaysInp) customEveryDaysInp.value = "";
    setRecurrenceUI();

    if (title) title.value = ev.title || "";
    if (description) description.value = ev.description || "";
    if (clientAddress) clientAddress.value = ev.clientAddress || "";
    if (eventType) eventType.value = String(ev.eventType || "MAXIMUM").toUpperCase();
    if (start) start.value = toLocalInput(ev.start);
    if (end) end.value = toLocalInput(ev.end);

    setTypeUI();
    if (ev.roomId && ROOMS.length && roomId) roomId.value = ev.roomId;

    selectedMembers = new Set((ev.participants || []).map(x => String(x)));
    renderMembers();

    const isOwner = String(ev.createdBy) === String(me.id);
    btnDeleteEvent?.classList.toggle("d-none", !isOwner);

    showFormErr("");
    modalEvent?.show();
    window.MHIcons?.refresh?.();
  }

  function openDetails(ev) {
    detailsEvent = ev;

    dTitle.textContent = ev.title || "-";
    dType.textContent = roleBadge(ev.eventType);
    dWhen.textContent = `${fmtDate(ev.start)} • ${fmtTime(ev.start)} - ${fmtTime(ev.end)}`;

    const desc = (ev.description || "").trim();
    dDesc.innerHTML = desc ? esc(desc).replaceAll("\n", "<br/>") : "<span class='text-muted'>Sem descrição.</span>";

    const extras = [];
    if (String(ev.eventType).toUpperCase() === "MAXIMUM" && ev.roomId) extras.push(`Sala: ${roomName(ev.roomId)}`);
    if (String(ev.eventType).toUpperCase() === "PRESENCIAL" && ev.clientAddress) extras.push(`Endereço: ${ev.clientAddress}`);
    dExtra.textContent = extras.join(" • ");

    if (String(ev.eventType).toUpperCase() === "ONLINE" && ev.meetLink) {
      dMeet.classList.remove("d-none");
      dMeetLink.textContent = ev.meetLink;
    } else {
      dMeet.classList.add("d-none");
      dMeetLink.textContent = "";
    }

    const isOwner = String(ev.createdBy) === String(me.id);
    const parts = uniqStrings(ev.participants || []);
    const ppl = [String(ev.createdBy), ...parts].filter(Boolean);
    const names = ppl.slice(0, 6).map(memberName).join(", ");
    dPerm.textContent = isOwner
      ? `Criado por você • Participantes: ${names}${ppl.length > 6 ? "…" : ""}`
      : `Criado por ${memberName(ev.createdBy)} • Participantes: ${names}${ppl.length > 6 ? "…" : ""}`;

    btnEditFromDetails.disabled = !isOwner;

    modalDetails?.show();
    window.MHIcons?.refresh?.();
  }

  btnCopyMeet?.addEventListener("click", async () => {
    const text = dMeetLink.textContent || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showState("success", "Link copiado!");
      setTimeout(() => showState("", ""), 1200);
    } catch {
      const tmp = document.createElement("textarea");
      tmp.value = text;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      tmp.remove();
      showState("success", "Link copiado!");
      setTimeout(() => showState("", ""), 1200);
    }
  });

  btnEditFromDetails?.addEventListener("click", () => {
    if (!detailsEvent) return;
    modalDetails?.hide();
    openEdit(detailsEvent);
  });

  btnNewEvent?.addEventListener("click", () => openCreate());

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
      const set = new Set(Array.isArray(list) ? list : (list?.holidays || []));
      HOL_CACHE.set(year, set);
      return set;
    } catch {
      const set = new Set(); // fallback: weekend-only
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

  // ✅ SALVAR EVENTO (corrigido, sem try quebrado)
  async function saveEvent() {
    showFormErr("");

    const payload = {
      title: String(title?.value || "").trim(),
      description: String(description?.value || "").trim(),
      start: new Date(start?.value).toISOString(),
      end: new Date(end?.value).toISOString(),
      eventType: String(eventType?.value || "").toUpperCase(),
      roomId: roomId?.value || null,
      clientAddress: String(clientAddress?.value || "").trim(),
      participants: Array.from(selectedMembers)
    };

    if (!payload.title) return showFormErr("Informe um título.");
    if (!payload.start || !payload.end) return showFormErr("Informe início e fim.");

    if (payload.eventType === "MAXIMUM" && !payload.roomId) return showFormErr("Selecione uma sala.");
    if (payload.eventType === "PRESENCIAL" && !payload.clientAddress) return showFormErr("Informe o endereço do cliente.");

    const id = eventId?.value || "";

    btnSaveEvent.disabled = true;
    btnSaveEvent.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Salvando...`;

    try {
      const saveOne = async (body, confirmConflicts = false) => {
        const finalBody = confirmConflicts ? { ...body, confirmConflicts: true } : body;
        if (id) {
          await API.request(`/api/events/${encodeURIComponent(id)}`, { method: "PUT", body: finalBody, auth: true });
        } else {
          await API.request("/api/events", { method: "POST", body: finalBody, auth: true });
        }
      };

      // ---------- edição: sempre 1 ----------
      if (id) {
        await saveOne(payload, false);
        showState("success", "Evento atualizado!");
        modalEvent?.hide();
        await refresh();
        setTimeout(() => showState("", ""), 1200);
        return;
      }

      // ---------- criação ----------
      const recurring = !!isRecurringInp?.checked;

      if (!recurring) {
        // evento único
        try {
          await saveOne(payload, false);
        } catch (e) {
          // conflito: pergunta uma vez
          if (e?.status === 409 && (e.data?.memberConflicts?.length || e.data?.conflict)) {
            const lines = [];
            if (e.data?.memberConflicts?.length) {
              const sample = e.data.memberConflicts.slice(0, 6);
              lines.push("Conflito de participantes:");
              sample.forEach(c => {
                lines.push(`- ${memberName(c.memberId)}: ${c.title} (${fmtTime(new Date(c.start))}-${fmtTime(new Date(c.end))})`);
              });
              if (e.data.memberConflicts.length > 6) lines.push(`... +${e.data.memberConflicts.length - 6} outros`);
            }
            if (e.data?.conflict) {
              const c = e.data.conflict;
              lines.push(`Sala ocupada: ${c.title} (${fmtTime(new Date(c.start))}-${fmtTime(new Date(c.end))})`);
            }
            const ok = confirm(`${e.message}\n\n${lines.join("\n")}\n\nDeseja criar mesmo assim?`);
            if (!ok) throw new Error("Criação cancelada.");
            await saveOne(payload, true);
          } else {
            throw e;
          }
        }

        showState("success", "Evento criado!");
        modalEvent?.hide();
        await refresh();
        setTimeout(() => showState("", ""), 1200);
        return;
      }

      // ---------- recorrente ----------
      const everyDays = getRecurrenceEveryDays();
      if (!everyDays) throw new Error("Informe a recorrência (quantos dias).");

      const baseStart = new Date(payload.start);
      const baseEnd = new Date(payload.end);
      const dur = baseEnd.getTime() - baseStart.getTime();
      if (!(dur > 0)) throw new Error("O fim deve ser após o início.");

      const limit = new Date(baseStart);
      limit.setFullYear(limit.getFullYear() + 1);

      // gera ocorrências até 1 ano (máx. 200)
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
          await API.request("/api/events", { method: "POST", body, auth: true });
          created += 1;
        } catch (e) {
          if (e?.status === 409 && (e.data?.memberConflicts?.length || e.data?.conflict)) {
            const lines = [];
            if (e.data?.memberConflicts?.length) {
              const sample = e.data.memberConflicts.slice(0, 6);
              lines.push("Conflito de participantes:");
              sample.forEach(c => {
                lines.push(`- ${memberName(c.memberId)}: ${c.title} (${fmtTime(new Date(c.start))}-${fmtTime(new Date(c.end))})`);
              });
              if (e.data.memberConflicts.length > 6) lines.push(`... +${e.data.memberConflicts.length - 6} outros`);
            }
            if (e.data?.conflict) {
              const c = e.data.conflict;
              lines.push(`Sala ocupada: ${c.title} (${fmtTime(new Date(c.start))}-${fmtTime(new Date(c.end))})`);
            }

            const ok = confirm(`${e.message}\n\n${lines.join("\n")}\n\nDeseja criar mesmo assim esta ocorrência?`);
            if (!ok) throw new Error("Criação recorrente cancelada.");

            // tenta novamente com confirmação
            await API.request("/api/events", { method: "POST", body: { ...body, confirmConflicts: true }, auth: true });
            created += 1;
          } else {
            throw e;
          }
        }
      }

      showState("success", created > 1 ? `Eventos criados: ${created}` : "Evento criado!");
      modalEvent?.hide();
      await refresh();
      setTimeout(() => showState("", ""), 1200);

    } catch (e) {
      if (e?.message === "Criação cancelada." || e?.message === "Criação recorrente cancelada.") return;
      showFormErr(e.message || "Erro ao salvar.");
    } finally {
      btnSaveEvent.disabled = false;
      btnSaveEvent.innerHTML = `<span class="d-inline-flex align-items-center gap-2"><i data-lucide="save"></i> Salvar</span>`;
      window.MHIcons?.refresh?.();
    }
  }

  async function deleteEvent() {
    const id = eventId?.value;
    if (!id) return;

    btnDeleteEvent.disabled = true;
    btnDeleteEvent.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Excluindo...`;

    try {
      await API.request(`/api/events/${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
      modalEvent?.hide();
      showState("success", "Evento excluído!");
      await refresh();
      setTimeout(() => showState("", ""), 1200);
    } catch (e) {
      showFormErr(e.message || "Erro ao excluir.");
    } finally {
      btnDeleteEvent.disabled = false;
      btnDeleteEvent.innerHTML = `<span class="d-inline-flex align-items-center gap-2"><i data-lucide="trash-2"></i> Excluir</span>`;
      window.MHIcons?.refresh?.();
    }
  }

  btnSaveEvent?.addEventListener("click", saveEvent);
  btnDeleteEvent?.addEventListener("click", deleteEvent);

  // ---------- Navigation ----------
  function setActiveViewButtons() {
    viewDayBtn?.classList.toggle("active", VIEW === "DAY");
    viewWeekBtn?.classList.toggle("active", VIEW === "WEEK");
    viewMonthBtn?.classList.toggle("active", VIEW === "MONTH");

    mViewDay?.classList.toggle("active", VIEW === "DAY");
    mViewWeek?.classList.toggle("active", VIEW === "WEEK");
    mViewMonth?.classList.toggle("active", VIEW === "MONTH");
  }

  function applyView() {
    setActiveViewButtons();

    if (VIEW === "MONTH") {
      weekDayShell?.classList.add("d-none");
      monthShell?.classList.remove("d-none");
      weekStrip?.classList.add("d-none");
    } else {
      monthShell?.classList.add("d-none");
      weekDayShell?.classList.remove("d-none");
      if (!(VIEW === "WEEK" && isMobile())) weekStrip?.classList.add("d-none");
    }
  }

  viewDayBtn?.addEventListener("click", async () => { VIEW = "DAY"; localStorage.setItem("mh_agenda_view", "DAY"); applyView(); await refresh(); });
  viewWeekBtn?.addEventListener("click", async () => { VIEW = "WEEK"; localStorage.setItem("mh_agenda_view", "WEEK"); applyView(); await refresh(); });
  viewMonthBtn?.addEventListener("click", async () => { VIEW = "MONTH"; localStorage.setItem("mh_agenda_view", "MONTH"); applyView(); await refresh(); });

  mViewDay?.addEventListener("click", async () => { VIEW = "DAY"; localStorage.setItem("mh_agenda_view", "DAY"); applyView(); await refresh(); });
  mViewWeek?.addEventListener("click", async () => { VIEW = "WEEK"; localStorage.setItem("mh_agenda_view", "WEEK"); applyView(); await refresh(); });
  mViewMonth?.addEventListener("click", async () => { VIEW = "MONTH"; localStorage.setItem("mh_agenda_view", "MONTH"); applyView(); await refresh(); });

  btnToday?.addEventListener("click", async () => { anchor = new Date(); await refresh(); });

  btnPrev?.addEventListener("click", async () => {
    if (VIEW === "DAY") anchor = addDays(anchor, -1);
    else if (VIEW === "WEEK") anchor = addDays(anchor, -7);
    else anchor = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
    await refresh();
  });

  btnNext?.addEventListener("click", async () => {
    if (VIEW === "DAY") anchor = addDays(anchor, 1);
    else if (VIEW === "WEEK") anchor = addDays(anchor, 7);
    else anchor = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    await refresh();
  });

  function applyResponsiveDefault() {
    const small = window.matchMedia("(max-width: 991px)").matches;
    const saved = localStorage.getItem("mh_agenda_view");
    if (saved === "DAY" || saved === "WEEK" || saved === "MONTH") {
      VIEW = saved;
      return;
    }
    if (small) VIEW = "DAY";
  }

  // ---------- Main ----------
  async function refresh() {
    await loadEvents();
    if (VIEW === "MONTH") buildMonth();
    else renderWeekDay();
    window.MHIcons?.refresh?.();
  }

  async function init() {
    // Controle: quantos dias por linha no mês (7/14/21)
    if (monthColsSelect) {
      try { monthColsSelect.value = String(getMonthCols()); } catch (_) {}
      monthColsSelect.addEventListener("change", () => {
        const v = Number(monthColsSelect.value || 7);
        applyMonthCols([7, 14, 21].includes(v) ? v : 7);
        if (VIEW === "MONTH") buildMonth();
      });
    }

    applyResponsiveDefault();
    applyView();

    await loadRooms();
    await loadMembers();
    await refresh();
  }

  init();
})();