// ---------- API config ----------
// window.API_BASE_URL is set in index.html, e.g.
// "https://taskflow-backend-production.up.railway.app/api"
const API_BASE_URL = window.API_BASE_URL;

const TOKEN_KEY = "taskflow_token";
const USER_KEY = "taskflow_user";

// ---------- Auth elements ----------
const authScreen = document.getElementById("authScreen");
const appShell = document.getElementById("appShell");
const authForm = document.getElementById("authForm");
const authEmailInput = document.getElementById("authEmail");
const authPasswordInput = document.getElementById("authPassword");
const authTabLogin = document.getElementById("authTabLogin");
const authTabRegister = document.getElementById("authTabRegister");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authErrorEl = document.getElementById("authError");
const profileMenu = document.getElementById("profileMenu");
const userAvatarEl = document.getElementById("userAvatar");
const userEmailLabelEl = document.getElementById("userEmailLabel");

let authMode = "login"; // "login" | "register"

// ---------- Elements ----------
const addTaskBtn = document.getElementById("addTaskBtn");
const tableBody = document.getElementById("taskTableBody");
const modal = document.getElementById("taskModal");
const closeBtn = document.querySelector(".close-btn");
const cancelBtn = document.querySelector(".cancel-btn");
const taskForm = document.getElementById("taskForm");

const taskNameInput = document.getElementById("taskName");
const taskDateInput = document.getElementById("taskDate");
const taskPriorityInput = document.getElementById("taskPriority");
const taskStatusInput = document.getElementById("taskStatus");

const totalTasksCountEl = document.getElementById("totalTasksCount");
const completedCountEl = document.getElementById("completedCount");
const pendingCountEl = document.getElementById("pendingCount");
const overdueCountEl = document.getElementById("overdueCount");

const searchInput = document.querySelector(".header-actions input[type='text']");

const calendarGrid = document.getElementById("calendarGrid");
const calMonthLabel = document.getElementById("calMonthLabel");
const calPrevBtn = document.getElementById("calPrevBtn");
const calNextBtn = document.getElementById("calNextBtn");

const calendarPageGrid = document.getElementById("calendarPageGrid");
const calPageMonthLabel = document.getElementById("calPageMonthLabel");
const calPagePrevBtn = document.getElementById("calPageprevBtn");
const calPageNextBtn = document.getElementById("calPageNextBtn");

const dayPanelTitle = document.getElementById("dayPanelTitle");
const dayPanelList = document.getElementById("dayPanelList");
const dayPanelAddBtn = document.getElementById("dayPanelAddBtn");

const navItems = document.querySelectorAll(".sidebar ul li[data-view]");
const dashboardView = document.getElementById("dashboardView");
const calendarPageView = document.getElementById("calendarPageView");
const stubView = document.getElementById("stubView");
const pageTitleEl = document.getElementById("pageTitle");
const pageSubtitleEl = document.getElementById("pageSubtitle");
const stubHeadingEl = document.getElementById("stubHeading");

const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const menuToggle = document.getElementById("menuToggle");

// Which day is selected on the full Calendar page (YYYY-MM-DD or null)
let selectedDateKey = null;

// Which month the calendar is currently showing (independent of "today")
let calendarViewDate = new Date();
calendarViewDate.setDate(1);

// ---------- State ----------
// Single source of truth for what's on screen. Populated from the API
// after login, kept in sync by re-fetching after every add/update/delete.
let tasks = [];
let searchTerm = "";

// ---------- API helper ----------
async function apiRequest(path, { method = "GET", body } = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) {
        // Token missing/expired — send the user back to the login screen.
        logout();
        throw new Error("Your session expired. Please log in again.");
    }

    if (response.status === 204) return null;

    let data = null;
    try {
        data = await response.json();
    } catch {
        // no JSON body
    }

    if (!response.ok) {
        throw new Error((data && data.error) || "Something went wrong. Please try again.");
    }

    return data;
}

// ---------- Auth flow ----------
function setAuthMode(mode) {
    authMode = mode;
    authTabLogin.classList.toggle("active", mode === "login");
    authTabRegister.classList.toggle("active", mode === "register");
    authSubmitBtn.textContent = mode === "login" ? "Log In" : "Sign Up";
    authPasswordInput.setAttribute("autocomplete", mode === "login" ? "current-password" : "new-password");
    hideAuthError();
}

function showAuthError(message) {
    authErrorEl.textContent = message;
    authErrorEl.style.display = "block";
}

function hideAuthError() {
    authErrorEl.style.display = "none";
}

authTabLogin.addEventListener("click", () => setAuthMode("login"));
authTabRegister.addEventListener("click", () => setAuthMode("register"));

authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAuthError();

    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;

    authSubmitBtn.disabled = true;
    const originalLabel = authSubmitBtn.textContent;
    authSubmitBtn.textContent = "Please wait...";

    try {
        const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
        const data = await apiRequest(endpoint, { method: "POST", body: { email, password } });

        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));

        authForm.reset();
        await enterApp(data.user);
    } catch (err) {
        showAuthError(err.message || "Something went wrong.");
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = originalLabel;
    }
});

function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    tasks = [];
    appShell.style.display = "none";
    authScreen.style.display = "flex";
    setAuthMode("login");
}

profileMenu?.addEventListener("click", () => {
    if (confirm("Log out of TaskFlow?")) logout();
});

async function enterApp(user) {
    userEmailLabelEl.textContent = user.email;
    userAvatarEl.textContent = user.email.slice(0, 2).toUpperCase();

    authScreen.style.display = "none";
    appShell.style.display = "flex";

    await refreshTasksFromServer();
}

// On page load: if we already have a token, skip straight to the app.
async function bootstrap() {
    const token = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (token && storedUser) {
        try {
            await enterApp(JSON.parse(storedUser));
            return;
        } catch (err) {
            // token invalid/expired — apiRequest already logged us out
        }
    }

    authScreen.style.display = "flex";
    appShell.style.display = "none";
}

// ---------- Helpers ----------
function todayStr() {
    return new Date().toISOString().split("T")[0];
}

function isOverdue(task) {
    return task.status !== "Completed" && task.date && task.date < todayStr();
}

function badgeClassForPriority(priority) {
    const p = priority.toLowerCase();
    if (p === "high") return "high";
    if (p === "medium") return "medium";
    return "low";
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${m}/${d}/${y}`;
}

// ---------- Fetch tasks from the API ----------
async function refreshTasksFromServer() {
    try {
        tasks = await apiRequest("/tasks");
    } catch (err) {
        console.error("Could not load tasks:", err);
        tasks = tasks || [];
    }
    render();
}

// ---------- Rendering ----------
function render() {
    renderTable();
    renderStats();
    renderCalendar();
    renderDayPanel();
}

function renderTable() {
    tableBody.innerHTML = "";

    const visibleTasks = tasks.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (visibleTasks.length === 0) {
        const emptyRow = document.createElement("tr");
        emptyRow.innerHTML = `
            <td colspan="5" style="text-align:center; color:#9ca3af; padding:24px;">
                ${tasks.length === 0 ? "No tasks yet — click \u201c+ New Task\u201d to add one." : "No tasks match your search."}
            </td>
        `;
        tableBody.appendChild(emptyRow);
        return;
    }

    visibleTasks.forEach(task => {
        const row = document.createElement("tr");
        if (isOverdue(task)) row.classList.add("overdue-row");

        row.innerHTML = `
            <td>${task.name}</td>
            <td>${formatDate(task.date)}${isOverdue(task) ? ' <span class="badge high">Overdue</span>' : ""}</td>
            <td><span class="badge ${badgeClassForPriority(task.priority)}">${task.priority}</span></td>
            <td>
                <select class="status-select" data-id="${task.id}">
                    <option ${task.status === "Pending" ? "selected" : ""}>Pending</option>
                    <option ${task.status === "In Progress" ? "selected" : ""}>In Progress</option>
                    <option ${task.status === "Completed" ? "selected" : ""}>Completed</option>
                </select>
            </td>
            <td><button type="button" class="delete-btn" data-id="${task.id}">Delete</button></td>
        `;

        tableBody.appendChild(row);
    });
}

function renderStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "Completed").length;
    const overdue = tasks.filter(isOverdue).length;
    const pending = total - completed - overdue;

    totalTasksCountEl.textContent = total;
    completedCountEl.textContent = completed;
    pendingCountEl.textContent = pending;
    overdueCountEl.textContent = overdue;
}

// ---------- Calendar ----------
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

function pad2(n) {
    return n.toString().padStart(2, "0");
}

function dateKey(year, monthIndex, day) {
    return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

// Blend from light red to strong red based on intensity (0-1)
function pendingHeatColor(intensity) {
    const start = [254, 226, 226]; // light red
    const end = [185, 28, 28];     // strong red
    const rgb = start.map((s, i) => Math.round(s + (end[i] - s) * intensity));
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function buildMonthData(viewDate) {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Only tasks that are still pending (Pending or In Progress, incl. overdue) count toward the heatmap
    const pendingTasks = tasks.filter(t => t.status !== "Completed");
    const totalPending = pendingTasks.length;

    const countsByDate = {};
    pendingTasks.forEach(t => {
        countsByDate[t.date] = (countsByDate[t.date] || 0) + 1;
    });

    return { year, month, firstWeekday, daysInMonth, countsByDate, totalPending };
}

// Renders one month grid into the given container.
// clickable=true wires up day-selection (used by the full Calendar page).
function renderCalendarGrid(gridEl, monthData, clickable) {
    if (!gridEl) return;

    const { year, month, firstWeekday, daysInMonth, countsByDate, totalPending } = monthData;
    const todayKey = todayStr();

    gridEl.innerHTML = "";

    for (let i = 0; i < firstWeekday; i++) {
        const blank = document.createElement("div");
        blank.className = "cal-day empty";
        gridEl.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const key = dateKey(year, month, day);
        const count = countsByDate[key] || 0;
        const shareOfTotal = totalPending > 0 ? count / totalPending : 0;
        // sqrt curve so a day doesn't need to hold the *majority* of all
        // pending tasks before it looks noticeably red
        const intensity = count > 0 ? Math.min(1, Math.sqrt(shareOfTotal)) : 0;

        const cell = document.createElement("div");
        cell.className = "cal-day";
        if (key === todayKey) cell.classList.add("today");
        if (clickable && key === selectedDateKey) cell.classList.add("selected");

        if (count > 0) {
            cell.style.background = pendingHeatColor(intensity);
            if (intensity > 0.5) cell.style.color = "#fff";
            cell.title = `${count} pending task${count > 1 ? "s" : ""} — ${Math.round(shareOfTotal * 100)}% of all pending tasks`;
        } else {
            cell.title = "No pending tasks";
        }

        cell.innerHTML = `${day}${count > 0 ? `<span class="cal-day-count">${count}</span>` : ""}`;

        if (clickable) {
            cell.addEventListener("click", () => {
                selectedDateKey = key;
                renderCalendar();
                renderDayPanel();
            });
        }

        gridEl.appendChild(cell);
    }
}

function renderCalendar() {
    const monthData = buildMonthData(calendarViewDate);
    const label = `${MONTH_NAMES[monthData.month]} ${monthData.year}`;

    if (calMonthLabel) calMonthLabel.textContent = label;
    if (calPageMonthLabel) calPageMonthLabel.textContent = label;

    renderCalendarGrid(calendarGrid, monthData, false);
    renderCalendarGrid(calendarPageGrid, monthData, true);
}

function goToMonth(offset) {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + offset, 1);
    renderCalendar();
}

calPrevBtn?.addEventListener("click", () => goToMonth(-1));
calNextBtn?.addEventListener("click", () => goToMonth(1));
calPagePrevBtn?.addEventListener("click", () => goToMonth(-1));
calPageNextBtn?.addEventListener("click", () => goToMonth(1));

// ---------- Day panel (Calendar page: tasks due on the selected day) ----------
function renderDayPanel() {
    if (!dayPanelList || !dayPanelTitle) return;

    if (!selectedDateKey) {
        dayPanelTitle.textContent = "Select a day";
        dayPanelList.innerHTML = `<li class="day-panel-empty">Click a day on the calendar to see what's due.</li>`;
        return;
    }

    const [y, m, d] = selectedDateKey.split("-");
    dayPanelTitle.textContent = new Date(y, m - 1, d).toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric"
    });

    const dayTasks = tasks.filter(t => t.date === selectedDateKey);

    if (dayTasks.length === 0) {
        dayPanelList.innerHTML = `<li class="day-panel-empty">Nothing due this day.</li>`;
        return;
    }

    dayPanelList.innerHTML = "";
    dayTasks.forEach(task => {
        const item = document.createElement("li");
        item.className = "day-panel-item";
        item.innerHTML = `
            <div>
                <div class="day-panel-item-name">${task.name}</div>
                <div class="day-panel-item-meta">
                    <span class="badge ${badgeClassForPriority(task.priority)}">${task.priority}</span>
                    <select class="status-select" data-id="${task.id}">
                        <option ${task.status === "Pending" ? "selected" : ""}>Pending</option>
                        <option ${task.status === "In Progress" ? "selected" : ""}>In Progress</option>
                        <option ${task.status === "Completed" ? "selected" : ""}>Completed</option>
                    </select>
                </div>
            </div>
            <button type="button" class="delete-btn" data-id="${task.id}">Delete</button>
        `;
        dayPanelList.appendChild(item);
    });
}

dayPanelList?.addEventListener("click", async (e) => {
    if (e.target.classList.contains("delete-btn")) {
        await deleteTask(e.target.dataset.id);
    }
});

dayPanelList?.addEventListener("change", async (e) => {
    if (e.target.classList.contains("status-select")) {
        await updateTaskStatus(e.target.dataset.id, e.target.value);
    }
});

dayPanelAddBtn?.addEventListener("click", () => {
    if (selectedDateKey) taskDateInput.value = selectedDateKey;
    openModal();
});

// ---------- Sidebar navigation ----------
const VIEW_META = {
    dashboard: { title: "Personal Dashboard", subtitle: "Stay organized and productive." },
    calendar: { title: "Calendar", subtitle: "See what's due, day by day." },
    tasks: { title: "My Tasks", subtitle: "" },
    priorities: { title: "Priorities", subtitle: "" },
    reports: { title: "Reports", subtitle: "" },
    settings: { title: "Settings", subtitle: "" }
};

function switchView(viewName) {
    navItems.forEach(li => li.classList.toggle("active", li.dataset.view === viewName));

    dashboardView.style.display = viewName === "dashboard" ? "" : "none";
    calendarPageView.style.display = viewName === "calendar" ? "" : "none";
    stubView.style.display = (viewName !== "dashboard" && viewName !== "calendar") ? "" : "none";

    const meta = VIEW_META[viewName] || { title: viewName, subtitle: "" };
    pageTitleEl.textContent = meta.title;
    pageSubtitleEl.textContent = meta.subtitle;

    if (viewName !== "dashboard" && viewName !== "calendar") {
        stubHeadingEl.textContent = meta.title;
    }
}

navItems.forEach(li => {
    li.addEventListener("click", () => {
        switchView(li.dataset.view);
        closeSidebar();
    });
});

// ---------- Mobile sidebar drawer ----------
function openSidebar() {
    sidebar?.classList.add("open");
    sidebarOverlay?.classList.add("active");
}

function closeSidebar() {
    sidebar?.classList.remove("open");
    sidebarOverlay?.classList.remove("active");
}

menuToggle?.addEventListener("click", () => {
    if (sidebar?.classList.contains("open")) {
        closeSidebar();
    } else {
        openSidebar();
    }
});

sidebarOverlay?.addEventListener("click", closeSidebar);

// ---------- Modal open/close ----------
function openModal() {
    modal.classList.add("active");
    taskNameInput.focus();
}

function closeModal() {
    modal.classList.remove("active");
    taskForm.reset();
}

addTaskBtn.addEventListener("click", openModal);
closeBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);
window.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
});

// ---------- Task mutations (all go through the API, then re-render) ----------
async function addTask(task) {
    await apiRequest("/tasks", { method: "POST", body: task });
    await refreshTasksFromServer();
}

async function deleteTask(id) {
    await apiRequest(`/tasks/${id}`, { method: "DELETE" });
    await refreshTasksFromServer();
}

async function updateTaskStatus(id, status) {
    await apiRequest(`/tasks/${id}`, { method: "PUT", body: { status } });
    await refreshTasksFromServer();
}

// ---------- Add task ----------
taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = taskNameInput.value.trim();
    const date = taskDateInput.value;
    const priority = taskPriorityInput.value;
    const status = taskStatusInput.value;

    if (!name || !date) return;

    const saveBtn = taskForm.querySelector(".save-btn");
    saveBtn.disabled = true;

    try {
        await addTask({ name, date, priority, status });
        closeModal();
    } catch (err) {
        alert(err.message || "Could not save task.");
    } finally {
        saveBtn.disabled = false;
    }
});

// ---------- Delete task & change status (event delegation) ----------
tableBody.addEventListener("click", async (e) => {
    if (e.target.classList.contains("delete-btn")) {
        await deleteTask(e.target.dataset.id);
    }
});

tableBody.addEventListener("change", async (e) => {
    if (e.target.classList.contains("status-select")) {
        await updateTaskStatus(e.target.dataset.id, e.target.value);
    }
});

// ---------- Live search ----------
if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        searchTerm = e.target.value;
        renderTable();
    });
}

// ---------- Keep "Overdue" accurate as the clock ticks past midnight ----------
setInterval(renderStats, 60 * 1000);

// ---------- Initial paint ----------
bootstrap();
