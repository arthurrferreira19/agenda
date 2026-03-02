// public/assets/js/userAgenda.js
(function () {
  const token = API.getToken();
  if (!token) { location.href = "/user/login.html"; return; }

  const me = JSON.parse(localStorage.getItem("mh_user") || "null");
  if (!me || me.role !== "USER") { API.clearToken(); localStorage.removeItem("mh_user"); location.href = "/user/login.html"; return; }

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

  // Modals
  const modalEventEl = document.getElementById("modalEvent");
  const modalDetailsEl = document.getElementById("modalDetails");
  const modalEvent = modalEventEl ? new bootstrap.Modal(modalEventEl) : null;
  const modalDetails = modalDetailsEl ? new bootstrap.Modal(modalDetailsEl) : null;

  // Form fields
  const modalEventTitle = document.getElementById("modalEventTitle");
  const eventId = document.getElementById("eventId");
  const title = document.getElementById("title");
  const eventType = document.getElementById("eventType");
  const start = document.getElementById("start");
  const end = document.getElementById("end");
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
  let SELECTED_DAY_KEY = null; // para destacar dia selecionado no mês
  let anchor = new Date(); // data base
  let EVENTS = [];
  let ROOMS = [];
  let detailsEvent = null;

  // ---------- Mobile / Colors ----------
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
// ---------- Helpers ----------
  function esc(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showState(type, msg) {
    if (!msg) { stateShell.innerHTML = ""; return; }
    stateShell.innerHTML = `<div class="alert alert-${type} fade-in" style="border-radius:16px;">${esc(msg)}</div>`;
  }

  function showFormErr(msg) {
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
    // ex: 02/03/2026 – 08/03/2026
    return `${fmtDate(from)} – ${fmtDate(to)}`;
  }

  function minutesFromStartOfDay(dt) {
    const d = new Date(dt);
    return d.getHours() * 60 + d.getMinutes();
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
      roomId.innerHTML = ROOMS.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");
    } catch (e) {
      // rooms é opcional para usuário, mas type MAXIMUM precisa
      ROOMS = [];
      roomId.innerHTML = `<option value="">(Sem salas)</option>`;
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
      const disabled = String(m.id) === String(me.id) ? "disabled" : ""; // criador já é checado no back
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
      // range ampliado para pegar eventos que começam/terminam fora do mês mas intersectam
      const from = startOfDay(addDays(first, -7));
      const to = addDays(endOfDay(addDays(last, 7)), 1);
      return { from, to };
    }
    // WEEK
    const from = startOfWeek(anchor);
    const to = addDays(from, 7);
    return { from, to };
  }

  async function loadEvents() {
    const { from, to } = getRange();
    try {
      showState("", "");
      rangeLabel.textContent = VIEW === "MONTH"
        ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(anchor)
        : fmtRange(from, addDays(to, -1));

      // ✅ rota protegida: enviar Bearer token
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
      // ✅ se expirar / não autorizado, volta pro login (sem depender de texto)
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
    daysGrid.innerHTML = "";
    daysGrid.style.display = "grid";
    daysGrid.style.gridTemplateColumns = `repeat(${days.length}, 1fr)`;

    days.forEach((d) => {
      const col = document.createElement("div");
      col.className = "day-col";
      col.dataset.date = d.toISOString();

      // slots (linhas)
      for (let h = 0; h < 24; h++) {
        const slot = document.createElement("div");
        slot.className = "hour-row";
        slot.dataset.hour = String(h);
        col.appendChild(slot);
      }

      // clique em vazio -> cria
      col.addEventListener("click", (ev) => {
        const target = ev.target.closest(".hour-row");
        if (!target) return;
        // não abrir se clicou em evento
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
    // limpa eventos antigos
    daysGrid.querySelectorAll(".event-card").forEach(el => el.remove());

    // ✅ Agrupamento por (dia + hora):
    // se existir mais de 1 evento no mesmo horário (interseção com a hora), renderiza "N eventos".
    const slots = new Map();
    const slotKey = (day, hour) => `${startOfDay(day).toISOString().slice(0, 10)}::${hour}`;

    days.forEach((d) => {
      for (let h = 0; h < 24; h++) slots.set(slotKey(d, h), []);
    });

    for (const ev of EVENTS) {
      for (const d of days) {
        const day0 = startOfDay(d);
        const day1 = addDays(day0, 1);
        if (!(ev.start < day1 && ev.end > day0)) continue;

        for (let h = 0; h < 24; h++) {
          const hs = new Date(day0);
          hs.setHours(h, 0, 0, 0);
          const he = new Date(day0);
          he.setHours(h + 1, 0, 0, 0);
          if (ev.start < he && ev.end > hs) {
            slots.get(slotKey(d, h))?.push(ev);
          }
        }
      }
    }

    // renderiza cards
    for (const d of days) {
      const col = daysGrid.querySelector(`.day-col[data-date="${d.toISOString()}"]`);
      if (!col) continue;

      for (let h = 0; h < 24; h++) {
        const list = slots.get(slotKey(d, h)) || [];
        if (!list.length) continue;

        const top = h * 48;
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "event-card";
        pill.style.top = `${top}px`;
        pill.style.height = `${48 - 6}px`;

        // cor por sala (ou fallback)
        if (list.length === 1) {
          const c = eventColor(list[0]);
          pill.style.borderColor = c;
          pill.style.background = `linear-gradient(135deg, ${hexToRgba(c, .18)}, ${hexToRgba(c, .10)})`;
          pill.style.boxShadow = `0 10px 24px ${hexToRgba(c, .18)}`;
          pill.style.setProperty("--evc", c);
        } else {
          pill.style.borderColor = "rgba(15,23,42,.18)";
          pill.style.background = "rgba(15,23,42,.06)";
        }

        if (list.length === 1) {
          const ev = list[0];
          pill.title = ev.title;
          pill.innerHTML = `
            <div class="event-title">${esc(ev.title)}</div>
            <div class="event-meta">${esc(fmtTime(ev.start))} - ${esc(fmtTime(ev.end))} • ${esc(roleBadge(ev.eventType))}</div>
          `;
          pill.addEventListener("click", (e) => { e.stopPropagation(); openDetails(ev); });
        } else {
          pill.title = `${list.length} eventos`;
          pill.innerHTML = `
            <div class="event-title">${list.length} eventos</div>
            <div class="event-meta">${pad(h)}:00 - ${pad(h + 1)}:00 • clique para ver</div>
          `;
          pill.addEventListener("click", (e) => {
            e.stopPropagation();
            openSlotDetails(d, h, list);
          });
        }

        col.appendChild(pill);
      }
    }
  }

  function openSlotDetails(day, hour, list) {
    // reutiliza modalDetails para listar múltiplos
    dTitle.textContent = `${list.length} eventos`;
    dType.textContent = "";
    const hs = new Date(startOfDay(day));
    hs.setHours(hour, 0, 0, 0);
    const he = new Date(hs);
    he.setHours(hour + 1, 0, 0, 0);
    dWhen.textContent = `${fmtDate(hs)} • ${pad(hour)}:00 - ${pad(hour + 1)}:00`;

    dDesc.innerHTML = list
      .sort((a, b) => a.start - b.start)
      .map(ev => {
        const who = String(ev.createdBy) === String(me.id) ? "Você" : memberName(ev.createdBy);
        return `
          <button type="button" class="month-ev w-100 text-start" style="display:block;border-left:4px solid ${eventColor(ev)}" data-ev-id="${esc(ev.id)}">
            <div class="fw-semibold" style="line-height:1.05;">${esc(ev.title)}</div>
            <div class="small text-muted">${esc(fmtTime(ev.start))} - ${esc(fmtTime(ev.end))} • ${esc(roleBadge(ev.eventType))} • ${esc(who)}</div>
          </button>
        `;
      }).join("");

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

  
function buildWeekStrip(weekStart) {
  if (!weekStrip) return;
  // se não estiver no modo WEEK mobile, ou se não houver weekStart, esconde
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
      // muda apenas o dia âncora dentro da semana (não precisa recarregar do servidor)
      anchor = startOfDay(d);
      // atualiza UI sem nova busca (EVENTS já tem a semana inteira)
      buildWeekStrip(startOfWeek(anchor));
      setActiveViewButtons();
      renderWeekDay();
    });
  });

  // tenta manter o dia ativo visível
  const activeBtn = weekStrip.querySelector(".wday.active");
  activeBtn?.scrollIntoView?.({ inline: "center", block: "nearest" });
}

function renderWeekDay() {
    // Week strip (mobile) - permite navegar pelos dias da semana sem 7 colunas
    if (VIEW === "WEEK" && isMobile()) buildWeekStrip(startOfWeek(anchor));
    else buildWeekStrip(null);

    const days = [];
    if (VIEW === "DAY") {
      days.push(startOfDay(anchor));
    } else {
      // Mobile-first: "Semana" vira navegação por dia (sem 7 colunas) para não gerar scroll lateral
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
    monthHead.innerHTML = "";
    monthBody.innerHTML = "";

    const names = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    monthHead.innerHTML = names.map(n => `<div class="month-hcell">${n}</div>`).join("");

    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const firstWeekStart = startOfWeek(first);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const lastWeekEnd = addDays(startOfWeek(addDays(last, 1)), 7);

    const days = [];
    for (let d = new Date(firstWeekStart); d < lastWeekEnd; d = addDays(d, 1)) {
      days.push(new Date(d));
    }

    // mapa de eventos por dia
    const map = new Map();
    // Indexa eventos por CADA dia que eles intersectam (inclui eventos que atravessam dias)
    for (const ev of EVENTS) {
      const evStart = startOfDay(ev.start);
      const evEnd = new Date(ev.end);
      // garante pelo menos 1 dia
      for (let d = new Date(evStart); d < evEnd; d = addDays(d, 1)) {
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

      const maxShow = isMobile() ? 2 : 3;
      const moreCount = Math.max(0, evs.length - maxShow);
      const showPlus = (!isMobile() && evs.length === 0); // só permite criar pelo dia quando NÃO há eventos (pedido)
      const isToday = sameDay(d, new Date());
      const selected = (SELECTED_DAY_KEY && SELECTED_DAY_KEY === key);

      cell.className = `month-cell ${inMonth ? "" : "muted"} ${isToday ? "is-today" : ""} ${selected ? "selected" : ""}`;

      cell.innerHTML = `
        <div class="month-top">
          <span class="month-day">${d.getDate()}</span>
          ${showPlus ? `<button class="btn btn-sm btn-ghost month-add" type="button" title="Novo evento"><i data-lucide="plus"></i></button>` : `<span class="month-spacer"></span>`}
        </div>
        <div class="month-events ${isMobile() ? "compact" : ""}">
          ${evs.slice(0, maxShow).map(ev => `
            <button type="button" class="month-ev" data-ev-id="${esc(ev.id)}" style="border-left:4px solid ${eventColor(ev)}" title="${esc(ev.title)}">
              <span class="dot" style="background:${eventColor(ev)}"></span>
              <span class="txt">${esc(fmtTime(ev.start))} ${esc(ev.title)}</span>
            </button>
          `).join("")}
          ${moreCount ? `<button type="button" class="month-more">+${moreCount} mais</button>` : ""}
        </div>
      `;

      // criar evento (somente quando dia estiver vazio, desktop)
      cell.querySelector(".month-add")?.addEventListener("click", (e) => {
        e.stopPropagation();
        const s = new Date(d);
        s.setHours(9, 0, 0, 0);
        const e2 = new Date(s);
        e2.setHours(s.getHours() + 1);
        openCreate({ start: s, end: e2 });
      });

      // clique no dia: se vazio cria; se tiver eventos abre (1 = detalhes; 2+ = lista)
      cell.addEventListener("click", () => {
        // destaca dia selecionado visualmente
        SELECTED_DAY_KEY = key;
        // re-render apenas no mês para atualizar destaque
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

      // clique em evento específico
      Array.from(cell.querySelectorAll(".month-ev")).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-ev-id");
          const ev = EVENTS.find(x => String(x.id) === String(id));
          if (ev) openDetails(ev);
        });
      });

      // "+N mais" abre lista do dia
      cell.querySelector(".month-more")?.addEventListener("click", (e) => {
        e.stopPropagation();
        SELECTED_DAY_KEY = key;
        if (VIEW === "MONTH") buildMonth();
        openDayDetails(d, evs);
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
    const t = String(eventType.value || "").toUpperCase();

    if (t === "MAXIMUM") {
      roomRow.classList.remove("d-none");
      addressRow.classList.add("d-none");
    } else if (t === "PRESENCIAL") {
      roomRow.classList.add("d-none");
      addressRow.classList.remove("d-none");
    } else {
      roomRow.classList.add("d-none");
      addressRow.classList.add("d-none");
    }
  }

  eventType?.addEventListener("change", setTypeUI);

  function openCreate({ start: s, end: e } = {}) {
    detailsEvent = null;
    modalEventTitle.textContent = "Novo evento";
    eventId.value = "";
    title.value = "";
    description.value = "";
    clientAddress.value = "";
    eventType.value = "MAXIMUM";
    setTypeUI();

    selectedMembers = new Set();
    renderMembers();

    const now = new Date();
    const s0 = s || new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    const e0 = e || new Date(s0.getTime() + 60 * 60 * 1000);

    start.value = toLocalInput(s0);
    end.value = toLocalInput(e0);

    if (ROOMS.length) roomId.value = ROOMS[0].id;

    btnDeleteEvent.classList.add("d-none");
    showFormErr("");
    modalEvent?.show();
    window.MHIcons?.refresh?.();
  }

  function openEdit(ev) {
    detailsEvent = ev;
    modalEventTitle.textContent = "Editar evento";
    eventId.value = ev.id;
    title.value = ev.title || "";
    description.value = ev.description || "";
    clientAddress.value = ev.clientAddress || "";
    eventType.value = String(ev.eventType || "MAXIMUM").toUpperCase();
    start.value = toLocalInput(ev.start);
    end.value = toLocalInput(ev.end);

    setTypeUI();
    if (ev.roomId && ROOMS.length) roomId.value = ev.roomId;

    selectedMembers = new Set((ev.participants || []).map(x => String(x)));
    renderMembers();

    const isOwner = String(ev.createdBy) === String(me.id);
    btnDeleteEvent.classList.toggle("d-none", !isOwner);
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
      // fallback
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

  async function saveEvent() {
    showFormErr("");

    const payload = {
      title: String(title.value || "").trim(),
      description: String(description.value || "").trim(),
      start: new Date(start.value).toISOString(),
      end: new Date(end.value).toISOString(),
      eventType: String(eventType.value || "").toUpperCase(),
      roomId: roomId.value || null,
      clientAddress: String(clientAddress.value || "").trim(),
      participants: Array.from(selectedMembers)
    };

    if (!payload.title) return showFormErr("Informe um título.");
    if (!payload.start || !payload.end) return showFormErr("Informe início e fim.");

    // regras simples no front (o back valida de novo)
    if (payload.eventType === "MAXIMUM" && !payload.roomId) return showFormErr("Selecione uma sala.");
    if (payload.eventType === "PRESENCIAL" && !payload.clientAddress) return showFormErr("Informe o endereço do cliente.");

    const id = eventId.value;

    btnSaveEvent.disabled = true;
    btnSaveEvent.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Salvando...`;

    try {
      const doSave = async (confirmConflicts) => {
        const body = confirmConflicts ? { ...payload, confirmConflicts: true } : payload;
        if (id) {
          await API.request(`/api/events/${encodeURIComponent(id)}`, { method: "PUT", body, auth: true });
        } else {
          await API.request("/api/events", { method: "POST", body, auth: true });
        }
      };

      try {
        await doSave(false);
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
          const ok = confirm(`${e.message}\n\n${lines.join("\n")}\n\nDeseja criar mesmo assim?`);
          if (ok) await doSave(true);
          else throw new Error("Criação cancelada.");
        } else {
          throw e;
        }
      }

      showState("success", id ? "Evento atualizado!" : "Evento criado!");

      modalEvent?.hide();
      await refresh();
      setTimeout(() => showState("", ""), 1200);
    } catch (e) {
      if (e?.message === "Criação cancelada.") return;
      showFormErr(e.message || "Erro ao salvar.");
    } finally {
      btnSaveEvent.disabled = false;
      btnSaveEvent.innerHTML = `<span class="d-inline-flex align-items-center gap-2"><i data-lucide="save"></i> Salvar</span>`;
      window.MHIcons?.refresh?.();
    }
  }

  async function deleteEvent() {
    const id = eventId.value;
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

    // mobile bottom
    mViewDay?.classList.toggle("active", VIEW === "DAY");
    mViewWeek?.classList.toggle("active", VIEW === "WEEK");
    mViewMonth?.classList.toggle("active", VIEW === "MONTH");
  }

  function applyView() {
    setActiveViewButtons();

    if (VIEW === "MONTH") {
      weekDayShell.classList.add("d-none");
      monthShell.classList.remove("d-none");
      weekStrip?.classList.add("d-none");
    } else {
      monthShell.classList.add("d-none");
      weekDayShell.classList.remove("d-none");
      // strip só aparece em WEEK + mobile (controlado no buildWeekStrip)
      if (!(VIEW === "WEEK" && isMobile())) weekStrip?.classList.add("d-none");
    }
  }

  viewDayBtn?.addEventListener("click", async () => { VIEW = "DAY"; localStorage.setItem("mh_agenda_view","DAY"); applyView(); await refresh(); });
  viewWeekBtn?.addEventListener("click", async () => { VIEW = "WEEK"; localStorage.setItem("mh_agenda_view","WEEK"); applyView(); await refresh(); });
  viewMonthBtn?.addEventListener("click", async () => { VIEW = "MONTH"; localStorage.setItem("mh_agenda_view","MONTH"); applyView(); await refresh(); });

  mViewDay?.addEventListener("click", async () => { VIEW = "DAY"; localStorage.setItem("mh_agenda_view","DAY"); applyView(); await refresh(); });
  mViewWeek?.addEventListener("click", async () => { VIEW = "WEEK"; localStorage.setItem("mh_agenda_view","WEEK"); applyView(); await refresh(); });
  mViewMonth?.addEventListener("click", async () => { VIEW = "MONTH"; localStorage.setItem("mh_agenda_view","MONTH"); applyView(); await refresh(); });

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

  // Responsivo: em telas pequenas, começa em DIA
  function applyResponsiveDefault() {
    // Mobile-first: começa em DIA, mas não bloqueia o usuário de escolher "Semana"
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
    applyResponsiveDefault();
    applyView();

    await loadRooms();
    await loadMembers();
    await refresh();
  }

  init();
})();