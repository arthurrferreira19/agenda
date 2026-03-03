// public/assets/js/userKanban.js
(function () {
  const token = API.getToken();
  if (!token) { location.href = "/user/login.html"; return; }

  const btnAddTask = document.getElementById("btnAddTask");
  const taskModal = document.getElementById("taskModal");
  const btnCloseTaskModal = document.getElementById("btnCloseTaskModal");
  const btnSaveTask = document.getElementById("btnSaveTask");
  const taskTitle = document.getElementById("taskTitle");
  const taskDesc = document.getElementById("taskDesc");
  const taskCol = document.getElementById("taskCol");

  const countTodo = document.getElementById("countTodo");
  const countDoing = document.getElementById("countDoing");
  const countDone = document.getElementById("countDone");

  function getTasks() {
    try { return JSON.parse(localStorage.getItem("mh_kanban_tasks") || "[]") || []; } catch(_) { return []; }
  }
  function setTasks(arr) { localStorage.setItem("mh_kanban_tasks", JSON.stringify(arr || [])); }

  function openModal() {
    if (!taskModal) return;
    taskModal.classList.remove("d-none");
    document.body.style.overflow = "hidden";
    taskTitle.value = "";
    taskDesc.value = "";
    taskCol.value = "TODO";
    window.MHIcons?.refresh?.();
  }
  function closeModal() {
    if (!taskModal) return;
    taskModal.classList.add("d-none");
    document.body.style.overflow = "";
  }

  function esc(s){
    return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function render() {
    const tasks = getTasks();
    const cols = { TODO: [], DOING: [], DONE: [] };
    tasks.forEach(t => cols[t.col||"TODO"]?.push(t));

    document.querySelectorAll("[data-col]").forEach(colEl=>{
      const col = colEl.getAttribute("data-col");
      const arr = cols[col] || [];
      colEl.innerHTML = arr.map(t=>`
        <div class="mh-notif-item">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div>
              <div class="fw-semibold">${esc(t.title)}</div>
              <div class="small text-muted">${esc(t.desc||"")}</div>
            </div>
            <div class="d-flex flex-column gap-1">
              <button class="btn btn-sm btn-outline-secondary" data-move="${t.id}" data-to="TODO"><i data-lucide="arrow-left"></i></button>
              <button class="btn btn-sm btn-outline-secondary" data-move="${t.id}" data-to="DOING"><i data-lucide="play"></i></button>
              <button class="btn btn-sm btn-outline-secondary" data-move="${t.id}" data-to="DONE"><i data-lucide="check"></i></button>
              <button class="btn btn-sm btn-outline-danger" data-del="${t.id}"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
        </div>
      `).join("");
    });

    countTodo.textContent = String(cols.TODO.length);
    countDoing.textContent = String(cols.DOING.length);
    countDone.textContent = String(cols.DONE.length);

    document.querySelectorAll("[data-move]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-move");
        const to = btn.getAttribute("data-to");
        const next = getTasks().map(t => t.id===id ? { ...t, col: to } : t);
        setTasks(next);
        render();
      });
    });
    document.querySelectorAll("[data-del]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-del");
        setTasks(getTasks().filter(t=>t.id!==id));
        render();
      });
    });

    window.MHIcons?.refresh?.();
  }

  function saveTask() {
    const title = String(taskTitle.value||"").trim();
    if (!title) return;
    const desc = String(taskDesc.value||"").trim();
    const col = String(taskCol.value||"TODO");
    const tasks = getTasks();
    tasks.unshift({ id: String(Date.now()), title, desc, col });
    setTasks(tasks.slice(0,200));
    closeModal();
    render();
  }

  // logout
  document.addEventListener("click", (e) => {
    const t = e.target;
    const btn = t?.closest?.("#btnLogout, #btnLogoutMobile");
    if (!btn) return;
    API.clearToken();
    localStorage.removeItem("mh_user");
    location.href = "/user/login.html";
  });

  btnAddTask?.addEventListener("click", openModal);
  btnCloseTaskModal?.addEventListener("click", closeModal);
  taskModal?.addEventListener("click", (e)=>{ if (e.target === taskModal) closeModal(); });
  btnSaveTask?.addEventListener("click", saveTask);

  render();
  window.MHIcons?.refresh?.();
})();