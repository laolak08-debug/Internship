const state = {
  user: null,
  active: "overview",
  rows: [],
  lookups: {
    students: [],
    departments: [],
    companies: [],
    supervisors: [],
    internships: [],
  },
  editing: null,
};

const menuEl = document.querySelector("#menu");
const pageTitle = document.querySelector("#pageTitle");
const userName = document.querySelector("#userName");
const userRole = document.querySelector("#userRole");
const notice = document.querySelector("#notice");
const overviewSection = document.querySelector("#overviewSection");
const resourceSection = document.querySelector("#resourceSection");
const statsGrid = document.querySelector("#statsGrid");
const recentInternships = document.querySelector("#recentInternships");
const recentEvaluations = document.querySelector("#recentEvaluations");
const searchInput = document.querySelector("#searchInput");
const newButton = document.querySelector("#newButton");
const tableHead = document.querySelector("#tableHead");
const tableBody = document.querySelector("#tableBody");
const refreshButton = document.querySelector("#refreshButton");
const logoutButton = document.querySelector("#logoutButton");
const themeButton = document.querySelector("#themeButton");
const modal = document.querySelector("#recordModal");
const recordForm = document.querySelector("#recordForm");
const modalKicker = document.querySelector("#modalKicker");
const modalTitle = document.querySelector("#modalTitle");
const formFields = document.querySelector("#formFields");
const formError = document.querySelector("#formError");
const closeModal = document.querySelector("#closeModal");
const cancelModal = document.querySelector("#cancelModal");

const resources = {
  departments: {
    label: "Departments",
    singular: "Department",
    title: "ພາກວິຊາ / Departments",
    columns: [
      ["department_name", "Department"],
      ["student_count", "Students"],
    ],
    fields: [
      { name: "department_name", label: "Department name", required: true },
    ],
  },
  students: {
    label: "Students",
    singular: "Student",
    title: "ນັກສຶກສາ / Students",
    columns: [
      ["student_code", "Code"],
      ["name", "Name"],
      ["gender", "Gender"],
      ["department_name", "Department"],
      ["year", "Year"],
      ["status", "Status"],
    ],
    fields: [
      { name: "student_code", label: "Student code", required: true },
      { name: "name", label: "ຊື່ນັກສຶກສາ", required: true },
      { name: "gender", label: "Gender", type: "select", options: () => fixedOptions(["Male", "Female", "Other"]) },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone" },
      { name: "department_id", label: "Department", type: "select", options: () => optionsFrom("departments", "department_name") },
      { name: "year", label: "Year", type: "number" },
      { name: "status", label: "Status", type: "select", options: () => fixedOptions(["Active", "Graduated", "Paused", "Inactive"]) },
    ],
  },
  companies: {
    label: "Companies",
    singular: "Company",
    title: "ບໍລິສັດ / Companies",
    columns: [
      ["name", "Company"],
      ["industry", "Industry"],
      ["contact_person", "Contact"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["internship_count", "Internships"],
    ],
    fields: [
      { name: "name", label: "Company name", required: true },
      { name: "industry", label: "Industry" },
      { name: "contact_person", label: "Contact person" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone" },
      { name: "address", label: "Address", type: "textarea", full: true },
    ],
  },
  supervisors: {
    label: "Supervisors",
    singular: "Supervisor",
    title: "ຜູ້ຄວບຄຸມບໍລິສັດ / Supervisors",
    columns: [
      ["full_name", "Name"],
      ["company_name", "Company"],
      ["phone", "Phone"],
      ["email", "Email"],
    ],
    fields: [
      { name: "full_name", label: "Supervisor name", required: true },
      { name: "company_id", label: "Company", type: "select", required: true, options: () => optionsFrom("companies") },
      { name: "phone", label: "Phone" },
      { name: "email", label: "Email", type: "email" },
    ],
  },
  internships: {
    label: "Internships",
    singular: "Internship",
    title: "ການຝຶກງານ / Internships",
    columns: [
      ["student_name", "Student"],
      ["company_name", "Company"],
      ["supervisor_name", "Supervisor"],
      ["position", "Position"],
      ["start_date", "Start"],
      ["end_date", "End"],
      ["status", "Status"],
    ],
    fields: [
      { name: "student_id", label: "Student", type: "select", required: true, options: () => optionsFrom("students", "student_code") },
      { name: "company_id", label: "Company", type: "select", required: true, options: () => optionsFrom("companies") },
      { name: "supervisor_id", label: "Supervisor", type: "select", options: () => supervisorOptions() },
      { name: "position", label: "Position", required: true },
      { name: "start_date", label: "Start date", type: "date" },
      { name: "end_date", label: "End date", type: "date" },
      { name: "status", label: "Status", type: "select", options: () => fixedOptions(["Planning", "Active", "Completed", "On hold"]) },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },
  evaluations: {
    label: "Evaluations",
    singular: "Evaluation",
    title: "ການປະເມີນ / Evaluations",
    columns: [
      ["student_name", "Student"],
      ["company_name", "Company"],
      ["internship_position", "Position"],
      ["score", "Score"],
      ["comment", "Comment"],
      ["evaluation_date", "Date"],
    ],
    fields: [
      { name: "internship_id", label: "Internship", type: "select", required: true, options: () => internshipOptions() },
      { name: "score", label: "Score", type: "number" },
      { name: "evaluation_date", label: "Evaluation date", type: "date" },
      { name: "comment", label: "Comment", type: "textarea", full: true },
    ],
  },
};

const menuItems = [
  { key: "overview", label: "Overview" },
  { key: "departments", label: "Departments" },
  { key: "students", label: "Students" },
  { key: "companies", label: "Companies" },
  { key: "supervisors", label: "Supervisors" },
  { key: "internships", label: "Internships" },
  { key: "evaluations", label: "Evaluations" },
];

document.addEventListener("DOMContentLoaded", init);
refreshButton.addEventListener("click", () => loadActive());
logoutButton.addEventListener("click", logout);
themeButton.addEventListener("click", toggleTheme);
newButton.addEventListener("click", () => openModal(state.active));
searchInput.addEventListener("input", debounce(() => loadResource(state.active), 220));
recordForm.addEventListener("submit", saveRecord);
closeModal.addEventListener("click", () => modal.close());
cancelModal.addEventListener("click", () => modal.close());

async function init() {
  if (localStorage.getItem("ims-theme") === "dark") {
    document.body.classList.add("dark");
  }

  try {
    const payload = await api("/api/auth/me");
    state.user = payload.user;
    userName.textContent = state.user.name;
    userRole.textContent = state.user.role;
    renderMenu();
    await loadLookups();
    await showOverview();
  } catch {
    window.location.href = "index.html";
  }
}

function renderMenu() {
  menuEl.innerHTML = menuItems
    .filter((item) => !item.adminOnly || state.user.role === "admin")
    .map((item) => `<button type="button" data-key="${item.key}">${item.label}</button>`)
    .join("");

  menuEl.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", async () => {
      state.active = button.dataset.key;
      searchInput.value = "";
      await loadActive();
    });
  });

  setActiveMenu();
}

function setActiveMenu() {
  menuEl.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.key === state.active);
  });
}

async function loadActive() {
  setActiveMenu();
  if (state.active === "overview") {
    await showOverview();
  } else {
    await loadResource(state.active);
  }
}

async function showOverview() {
  state.active = "overview";
  setActiveMenu();
  pageTitle.textContent = "Overview";
  overviewSection.hidden = false;
  resourceSection.hidden = true;

  const summary = await api("/api/summary");
  const cards = [
    ["Departments", summary.totals.departments, "SQL table: Departments"],
    ["Students", summary.totals.students, "Visible student records"],
    ["Companies", summary.totals.companies, "SQL table: Companies"],
    ["Supervisors", summary.totals.supervisors, "SQL table: Supervisors"],
    ["Internships", summary.totals.internships, "SQL table: Internships"],
    ["Evaluations", summary.totals.evaluations, "SQL table: Evaluations"],
  ];

  statsGrid.innerHTML = cards
    .map(([label, value, hint]) => `
      <article class="stat-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(hint)}</small>
      </article>
    `)
    .join("");

  recentInternships.innerHTML = miniList(
    summary.recentInternships,
    (item) => item.position,
    (item) => `${item.student_name || "-"} · ${item.company_name || "-"} · ${item.status}`
  );
  recentEvaluations.innerHTML = miniList(
    summary.recentEvaluations,
    (item) => `${item.score ?? "-"} / 100`,
    (item) => `${item.student_name || "-"} · ${item.company_name || "-"} · ${item.comment || "-"}`
  );
}

async function loadResource(resource) {
  const config = resources[resource];
  pageTitle.textContent = config.title;
  overviewSection.hidden = true;
  resourceSection.hidden = false;
  newButton.hidden = !canCreate(resource);
  newButton.textContent = `New ${config.singular}`;

  const q = searchInput.value.trim();
  const payload = await api(`/api/${resource}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  state.rows = payload.data;
  renderTable(resource);
}

function renderTable(resource) {
  const config = resources[resource];
  const actionColumn = canUpdate(resource) || canDelete(resource);
  tableHead.innerHTML = `
    <tr>
      ${config.columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}
      ${actionColumn ? "<th>Actions</th>" : ""}
    </tr>
  `;

  if (!state.rows.length) {
    tableBody.innerHTML = `<tr><td class="table-empty" colspan="${config.columns.length + (actionColumn ? 1 : 0)}">No records found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = state.rows
    .map((row) => `
      <tr>
        ${config.columns.map(([key]) => `<td>${formatValue(key, row[key])}</td>`).join("")}
        ${actionColumn ? `<td>${actionButtons(resource, row)}</td>` : ""}
      </tr>
    `)
    .join("");

  tableBody.querySelectorAll("[data-action='edit']").forEach((button) => {
    button.addEventListener("click", () => {
      const row = state.rows.find((item) => item.id === Number(button.dataset.id));
      openModal(resource, row);
    });
  });

  tableBody.querySelectorAll("[data-action='delete']").forEach((button) => {
    button.addEventListener("click", () => deleteRecord(resource, Number(button.dataset.id)));
  });
}

function actionButtons(resource, row) {
  const edit = canUpdate(resource)
    ? `<button class="action-btn" type="button" data-action="edit" data-id="${row.id}">Edit</button>`
    : "";
  const remove = canDelete(resource, row)
    ? `<button class="action-btn danger" type="button" data-action="delete" data-id="${row.id}">Delete</button>`
    : "";
  return `<div class="row-actions">${edit}${remove}</div>`;
}

async function openModal(resource, row = null) {
  await loadLookups();
  state.editing = row;
  const config = resources[resource];
  modalKicker.textContent = config.label;
  modalTitle.textContent = row ? `Edit ${config.singular}` : `New ${config.singular}`;
  formError.textContent = "";
  formFields.innerHTML = config.fields
    .filter((field) => field.visible ? field.visible(row) : true)
    .map((field) => renderField(field, row))
    .join("");
  modal.showModal();
}

function renderField(field, row) {
  const type = field.type || "text";
  const value = row?.[field.name] ?? "";
  const required = field.required ? "required" : "";
  const className = field.full || type === "textarea" ? "form-field full" : "form-field";
  const placeholder = field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : "";

  if (type === "select") {
    const options = field.options();
    return `
      <label class="${className}">
        <span>${escapeHtml(field.label)}</span>
        <select name="${field.name}" ${required}>
          <option value="">-- Select --</option>
          ${options.map((option) => `
            <option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>
              ${escapeHtml(option.label)}
            </option>
          `).join("")}
        </select>
      </label>
    `;
  }

  if (type === "textarea") {
    return `
      <label class="${className}">
        <span>${escapeHtml(field.label)}</span>
        <textarea name="${field.name}" ${required} ${placeholder}>${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  return `
    <label class="${className}">
      <span>${escapeHtml(field.label)}</span>
      <input name="${field.name}" type="${type}" value="${escapeHtml(value)}" ${required} ${placeholder} />
    </label>
  `;
}

async function saveRecord(event) {
  event.preventDefault();
  formError.textContent = "";
  const resource = state.active;
  const fields = resources[resource].fields.filter((field) => field.visible ? field.visible(state.editing) : true);
  const formData = new FormData(recordForm);
  const body = {};

  fields.forEach((field) => {
    body[field.name] = formData.get(field.name) ?? "";
  });

  try {
    const url = state.editing ? `/api/${resource}/${state.editing.id}` : `/api/${resource}`;
    const method = state.editing ? "PUT" : "POST";
    await api(url, { method, body: JSON.stringify(body) });
    modal.close();
    await loadLookups();
    await loadResource(resource);
    showNotice("Saved successfully.", "success");
  } catch (error) {
    formError.textContent = error.message;
  }
}

async function deleteRecord(resource, id) {
  const confirmed = window.confirm("Delete this record?");
  if (!confirmed) return;

  try {
    await api(`/api/${resource}/${id}`, { method: "DELETE" });
    await loadLookups();
    await loadResource(resource);
    showNotice("Record deleted.", "success");
  } catch (error) {
    showNotice(error.message, "error");
  }
}

async function loadLookups() {
  const names = ["departments", "students", "companies", "supervisors", "internships"];
  await Promise.all(names.map(async (name) => {
    try {
      const payload = await api(`/api/${name}`);
      state.lookups[name] = payload.data;
    } catch {
      state.lookups[name] = [];
    }
  }));
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  window.location.href = "index.html?logout=1";
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem("ims-theme", document.body.classList.contains("dark") ? "dark" : "light");
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) window.location.href = "index.html";
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

function canCreate(resource) {
  return state.user.role === "admin";
}

function canUpdate(resource) {
  return state.user.role === "admin";
}

function canDelete(resource, row = null) {
  return state.user.role === "admin";
}

function optionsFrom(resource, secondaryKey = null) {
  return state.lookups[resource].map((item) => ({
    value: item.id,
    label: secondaryKey
      ? [item[secondaryKey], item.name].filter(Boolean).join(" · ")
      : item.name || item.department_name || item.full_name,
  }));
}

function internshipOptions() {
  return state.lookups.internships.map((item) => ({
    value: item.id,
    label: `${item.student_name || "Student"} · ${item.company_name || "Company"} · ${item.position}`,
  }));
}

function supervisorOptions() {
  return state.lookups.supervisors.map((item) => ({
    value: item.id,
    label: `${item.full_name} · ${item.company_name || "Company"}`,
  }));
}

function fixedOptions(values) {
  return values.map((value) => ({ value, label: value }));
}

function formatValue(key, value) {
  if (value === null || value === undefined || value === "") return '<span class="muted">-</span>';
  if (key === "status" || key === "role") return `<span class="status-pill">${escapeHtml(value)}</span>`;
  if (key === "score" && value === null) return '<span class="muted">-</span>';
  return escapeHtml(value);
}

function miniList(items, title, subtitle) {
  if (!items.length) {
    return '<div class="mini-item"><strong>No records</strong><small>ຍັງບໍ່ມີຂໍ້ມູນ</small></div>';
  }

  return items
    .map((item) => `
      <div class="mini-item">
        <strong>${escapeHtml(title(item))}</strong>
        <small>${escapeHtml(subtitle(item))}</small>
      </div>
    `)
    .join("");
}

function showNotice(message, type = "success") {
  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.hidden = false;
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    notice.hidden = true;
  }, 3200);
}

function debounce(callback, delay) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
