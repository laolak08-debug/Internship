const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { DEFAULT_SOURCE, importSqlServerData } = require("./import-sqlserver-data");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "internship.db");
const COOKIE_NAME = "ims_session";
const sessions = new Map();

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA journal_mode = WAL");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

initializeDatabase();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    serveStatic(req, res, url);
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(res, error.status, { error: error.message });
      return;
    }

    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Internship Management System running at http://localhost:${PORT}`);
});

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS advisors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      advisor_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT DEFAULT '',
      department TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      gender TEXT DEFAULT '',
      email TEXT NOT NULL UNIQUE,
      phone TEXT DEFAULT '',
      major TEXT DEFAULT '',
      department_id INTEGER,
      year INTEGER DEFAULT 1,
      advisor_id INTEGER,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
      FOREIGN KEY (advisor_id) REFERENCES advisors(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      industry TEXT DEFAULT '',
      contact_person TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS supervisors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      company_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS internships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      supervisor_id INTEGER,
      advisor_id INTEGER,
      position TEXT NOT NULL,
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Planning',
      supervisor_name TEXT DEFAULT '',
      supervisor_email TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (supervisor_id) REFERENCES supervisors(id) ON DELETE SET NULL,
      FOREIGN KEY (advisor_id) REFERENCES advisors(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      internship_id INTEGER NOT NULL,
      score REAL,
      comment TEXT DEFAULT '',
      evaluation_date TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      internship_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      advisor_id INTEGER,
      title TEXT NOT NULL,
      week_no INTEGER DEFAULT 1,
      submitted_at TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      hours REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Submitted',
      score REAL,
      feedback TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (advisor_id) REFERENCES advisors(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'advisor', 'student')),
      advisor_id INTEGER,
      student_id INTEGER,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (advisor_id) REFERENCES advisors(id) ON DELETE SET NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
    );
  `);

  ensureColumn("students", "gender", "TEXT DEFAULT ''");
  ensureColumn("students", "department_id", "INTEGER");
  ensureColumn("internships", "supervisor_id", "INTEGER");

  const userCount = db.prepare("SELECT COUNT(*) AS total FROM users").get().total;
  if (userCount === 0) {
    seedDatabase();
  }

  autoImportSqlData();
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((item) => item.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function seedDatabase() {
  const addUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, advisor_id, student_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 'Active')
  `);

  addUser.run("System Admin", "admin@ims.local", hashPassword("Admin123!"), "admin", null, null);
}

function autoImportSqlData() {
  if (process.env.IMS_AUTO_IMPORT_SQL === "false") return;

  const sqlTables = ["departments", "students", "companies", "supervisors", "internships", "evaluations"];
  const hasSqlData = sqlTables.some((table) => (
    db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total > 0
  ));

  if (hasSqlData) return;

  try {
    const result = importSqlServerData(db, DEFAULT_SOURCE);
    console.log(
      `Imported SQL source data: departments=${result.imported.departments}, students=${result.imported.students}, companies=${result.imported.companies}, supervisors=${result.imported.supervisors}, internships=${result.imported.internships}, evaluations=${result.imported.evaluations}`
    );
  } catch (error) {
    console.error("SQL source auto-import failed:", error);
  }
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readJson(req);
    const email = requiredText(body, "email").toLowerCase();
    const password = requiredText(body, "password");
    const user = db.prepare("SELECT * FROM users WHERE lower(email) = ? AND status = 'Active'").get(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, "Invalid email or password");
    }

    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { userId: user.id, createdAt: Date.now() });
    setCookie(res, token);
    sendJson(res, 200, { user: publicUser(user) });
    return;
  }

  const user = getSessionUser(req);
  if (!user) {
    throw new HttpError(401, "Authentication required");
  }

  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    sendJson(res, 200, { user: publicUser(user) });
    return;
  }

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    const token = getCookie(req, COOKIE_NAME);
    if (token) sessions.delete(token);
    clearCookie(res);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/summary" && req.method === "GET") {
    sendJson(res, 200, getSummary(user));
    return;
  }

  const match = url.pathname.match(/^\/api\/([a-z]+)(?:\/(\d+))?$/);
  if (!match) {
    throw new HttpError(404, "API route not found");
  }

  const resource = match[1];
  const id = match[2] ? Number(match[2]) : null;

  if (!resourceConfigs[resource]) {
    throw new HttpError(404, "Resource not found");
  }

  if (req.method === "GET" && id) {
    const row = getVisibleRow(resource, id, user);
    if (!row) throw new HttpError(404, "Record not found");
    sendJson(res, 200, { data: row });
    return;
  }

  if (req.method === "GET") {
    const q = url.searchParams.get("q") || "";
    sendJson(res, 200, { data: listResource(resource, user, q) });
    return;
  }

  if (req.method === "POST") {
    const body = await readJson(req);
    const row = createResource(resource, body, user);
    sendJson(res, 201, { data: row });
    return;
  }

  if (req.method === "PUT" && id) {
    const body = await readJson(req);
    const row = updateResource(resource, id, body, user);
    sendJson(res, 200, { data: row });
    return;
  }

  if (req.method === "DELETE" && id) {
    deleteResource(resource, id, user);
    sendJson(res, 200, { ok: true });
    return;
  }

  throw new HttpError(405, "Method not allowed");
}

const resourceConfigs = {
  departments: {
    alias: "d",
    table: "departments",
    select: `
      SELECT d.*,
        (SELECT COUNT(*) FROM students s WHERE s.department_id = d.id OR s.major = d.department_name) AS student_count
      FROM departments d
    `,
    order: "d.id ASC",
    search: ["d.department_name"],
  },
  students: {
    alias: "s",
    table: "students",
    select: `
      SELECT s.*, COALESCE(d.department_name, s.major) AS department_name
      FROM students s
      LEFT JOIN departments d ON d.id = s.department_id
    `,
    order: "s.id DESC",
    search: ["s.student_code", "s.name", "s.gender", "s.email", "s.major", "s.status", "d.department_name"],
  },
  advisors: {
    alias: "a",
    table: "advisors",
    select: `
      SELECT a.*,
        (SELECT COUNT(*) FROM students s WHERE s.advisor_id = a.id) AS student_count
      FROM advisors a
    `,
    order: "a.id DESC",
    search: ["a.advisor_code", "a.name", "a.email", "a.department"],
  },
  companies: {
    alias: "c",
    table: "companies",
    select: `
      SELECT c.*,
        (SELECT COUNT(*) FROM internships i WHERE i.company_id = c.id) AS internship_count
      FROM companies c
    `,
    order: "c.id DESC",
    search: ["c.name", "c.industry", "c.contact_person", "c.address"],
  },
  supervisors: {
    alias: "sp",
    table: "supervisors",
    select: `
      SELECT sp.*, c.name AS company_name
      FROM supervisors sp
      JOIN companies c ON c.id = sp.company_id
    `,
    order: "sp.id DESC",
    search: ["sp.full_name", "sp.phone", "sp.email", "c.name"],
  },
  internships: {
    alias: "i",
    table: "internships",
    select: `
      SELECT i.*, s.name AS student_name, s.student_code, c.name AS company_name,
        COALESCE(sp.full_name, i.supervisor_name) AS supervisor_name,
        COALESCE(sp.email, i.supervisor_email) AS supervisor_email
      FROM internships i
      JOIN students s ON s.id = i.student_id
      JOIN companies c ON c.id = i.company_id
      LEFT JOIN supervisors sp ON sp.id = i.supervisor_id
    `,
    order: "i.id DESC",
    search: ["s.name", "s.student_code", "c.name", "sp.full_name", "sp.email", "i.position", "i.status", "i.supervisor_name"],
  },
  evaluations: {
    alias: "e",
    table: "evaluations",
    select: `
      SELECT e.*, s.name AS student_name, s.student_code, c.name AS company_name, i.position AS internship_position
      FROM evaluations e
      JOIN internships i ON i.id = e.internship_id
      JOIN students s ON s.id = i.student_id
      JOIN companies c ON c.id = i.company_id
    `,
    order: "e.evaluation_date DESC, e.id DESC",
    search: ["s.name", "s.student_code", "c.name", "i.position", "e.comment"],
  },
  reports: {
    alias: "r",
    table: "reports",
    select: `
      SELECT r.*, s.name AS student_name, s.student_code, c.name AS company_name, i.position AS internship_position,
        a.name AS advisor_name
      FROM reports r
      JOIN internships i ON i.id = r.internship_id
      JOIN students s ON s.id = r.student_id
      JOIN companies c ON c.id = i.company_id
      LEFT JOIN advisors a ON a.id = r.advisor_id
    `,
    order: "r.week_no DESC, r.id DESC",
    search: ["r.title", "r.summary", "r.status", "r.feedback", "s.name", "c.name"],
  },
  users: {
    alias: "u",
    table: "users",
    select: `
      SELECT u.id, u.name, u.email, u.role, u.advisor_id, u.student_id, u.status, u.created_at,
        a.name AS advisor_name, s.name AS student_name
      FROM users u
      LEFT JOIN advisors a ON a.id = u.advisor_id
      LEFT JOIN students s ON s.id = u.student_id
    `,
    order: "u.id DESC",
    search: ["u.name", "u.email", "u.role", "u.status", "a.name", "s.name"],
  },
};

function listResource(resource, user, q = "") {
  if (resource === "users" && user.role !== "admin") {
    throw new HttpError(403, "Only admins can view users");
  }

  const config = resourceConfigs[resource];
  const access = accessCondition(resource, user, config.alias);
  const clauses = [access.sql];
  const params = [...access.params];
  const search = q.trim();

  if (search) {
    clauses.push(`(${config.search.map((field) => `${field} LIKE ?`).join(" OR ")})`);
    params.push(...config.search.map(() => `%${search}%`));
  }

  const sql = `${config.select} WHERE ${clauses.join(" AND ")} ORDER BY ${config.order}`;
  return db.prepare(sql).all(...params);
}

function getVisibleRow(resource, id, user) {
  if (resource === "users" && user.role !== "admin") {
    throw new HttpError(403, "Only admins can view users");
  }

  const config = resourceConfigs[resource];
  const access = accessCondition(resource, user, config.alias);
  const sql = `${config.select} WHERE ${access.sql} AND ${config.alias}.id = ?`;
  return db.prepare(sql).get(...access.params, id);
}

function createResource(resource, body, user) {
  if (resource !== "reports") requireAdmin(user);

  if (resource === "departments") {
    const payload = departmentPayload(body);
    const result = db.prepare(`
      INSERT INTO departments (department_name)
      VALUES (?)
    `).run(payload.department_name);
    return getVisibleRow(resource, Number(result.lastInsertRowid), user);
  }

  if (resource === "students") {
    const payload = studentPayload(body);
    const result = db.prepare(`
      INSERT INTO students (student_code, name, gender, email, phone, major, department_id, year, advisor_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.student_code,
      payload.name,
      payload.gender,
      payload.email,
      payload.phone,
      payload.major,
      payload.department_id,
      payload.year,
      payload.advisor_id,
      payload.status
    );
    return getVisibleRow(resource, Number(result.lastInsertRowid), user);
  }

  if (resource === "advisors") {
    const payload = advisorPayload(body);
    const result = db.prepare(`
      INSERT INTO advisors (advisor_code, name, email, phone, department)
      VALUES (?, ?, ?, ?, ?)
    `).run(payload.advisor_code, payload.name, payload.email, payload.phone, payload.department);
    return getVisibleRow(resource, Number(result.lastInsertRowid), user);
  }

  if (resource === "companies") {
    const payload = companyPayload(body);
    const result = db.prepare(`
      INSERT INTO companies (name, industry, contact_person, email, phone, address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(payload.name, payload.industry, payload.contact_person, payload.email, payload.phone, payload.address);
    return getVisibleRow(resource, Number(result.lastInsertRowid), user);
  }

  if (resource === "supervisors") {
    const payload = supervisorPayload(body);
    const result = db.prepare(`
      INSERT INTO supervisors (full_name, phone, email, company_id)
      VALUES (?, ?, ?, ?)
    `).run(payload.full_name, payload.phone, payload.email, payload.company_id);
    return getVisibleRow(resource, Number(result.lastInsertRowid), user);
  }

  if (resource === "internships") {
    const payload = internshipPayload(body);
    const result = db.prepare(`
      INSERT INTO internships
        (student_id, company_id, supervisor_id, advisor_id, position, start_date, end_date, status, supervisor_name, supervisor_email, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.student_id,
      payload.company_id,
      payload.supervisor_id,
      payload.advisor_id,
      payload.position,
      payload.start_date,
      payload.end_date,
      payload.status,
      payload.supervisor_name,
      payload.supervisor_email,
      payload.notes
    );
    return getVisibleRow(resource, Number(result.lastInsertRowid), user);
  }

  if (resource === "evaluations") {
    const payload = evaluationPayload(body);
    const result = db.prepare(`
      INSERT INTO evaluations (internship_id, score, comment, evaluation_date)
      VALUES (?, ?, ?, ?)
    `).run(payload.internship_id, payload.score, payload.comment, payload.evaluation_date);
    return getVisibleRow(resource, Number(result.lastInsertRowid), user);
  }

  if (resource === "reports") {
    const payload = reportPayload(body, user);
    const result = db.prepare(`
      INSERT INTO reports
        (internship_id, student_id, advisor_id, title, week_no, submitted_at, summary, hours, status, score, feedback)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.internship_id,
      payload.student_id,
      payload.advisor_id,
      payload.title,
      payload.week_no,
      payload.submitted_at,
      payload.summary,
      payload.hours,
      payload.status,
      payload.score,
      payload.feedback
    );
    return getVisibleRow(resource, Number(result.lastInsertRowid), user);
  }

  if (resource === "users") {
    const payload = userPayload(body, true);
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, advisor_id, student_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.name,
      payload.email,
      payload.password_hash,
      payload.role,
      payload.advisor_id,
      payload.student_id,
      payload.status
    );
    return getVisibleRow(resource, Number(result.lastInsertRowid), user);
  }

  throw new HttpError(404, "Resource not found");
}

function updateResource(resource, id, body, user) {
  const current = getVisibleRow(resource, id, user);
  if (!current) throw new HttpError(404, "Record not found");

  if (resource !== "reports") requireAdmin(user);

  if (resource === "departments") {
    const payload = departmentPayload(body);
    db.prepare(`
      UPDATE departments
      SET department_name = ?
      WHERE id = ?
    `).run(payload.department_name, id);
    return getVisibleRow(resource, id, user);
  }

  if (resource === "students") {
    const payload = studentPayload(body);
    db.prepare(`
      UPDATE students
      SET student_code = ?, name = ?, gender = ?, email = ?, phone = ?, major = ?, department_id = ?,
        year = ?, advisor_id = ?, status = ?
      WHERE id = ?
    `).run(
      payload.student_code,
      payload.name,
      payload.gender,
      payload.email,
      payload.phone,
      payload.major,
      payload.department_id,
      payload.year,
      payload.advisor_id,
      payload.status,
      id
    );
    return getVisibleRow(resource, id, user);
  }

  if (resource === "advisors") {
    const payload = advisorPayload(body);
    db.prepare(`
      UPDATE advisors
      SET advisor_code = ?, name = ?, email = ?, phone = ?, department = ?
      WHERE id = ?
    `).run(payload.advisor_code, payload.name, payload.email, payload.phone, payload.department, id);
    return getVisibleRow(resource, id, user);
  }

  if (resource === "companies") {
    const payload = companyPayload(body);
    db.prepare(`
      UPDATE companies
      SET name = ?, industry = ?, contact_person = ?, email = ?, phone = ?, address = ?
      WHERE id = ?
    `).run(payload.name, payload.industry, payload.contact_person, payload.email, payload.phone, payload.address, id);
    return getVisibleRow(resource, id, user);
  }

  if (resource === "supervisors") {
    const payload = supervisorPayload(body);
    db.prepare(`
      UPDATE supervisors
      SET full_name = ?, phone = ?, email = ?, company_id = ?
      WHERE id = ?
    `).run(payload.full_name, payload.phone, payload.email, payload.company_id, id);
    return getVisibleRow(resource, id, user);
  }

  if (resource === "internships") {
    const payload = internshipPayload(body);
    db.prepare(`
      UPDATE internships
      SET student_id = ?, company_id = ?, supervisor_id = ?, advisor_id = ?, position = ?, start_date = ?, end_date = ?,
        status = ?, supervisor_name = ?, supervisor_email = ?, notes = ?
      WHERE id = ?
    `).run(
      payload.student_id,
      payload.company_id,
      payload.supervisor_id,
      payload.advisor_id,
      payload.position,
      payload.start_date,
      payload.end_date,
      payload.status,
      payload.supervisor_name,
      payload.supervisor_email,
      payload.notes,
      id
    );
    return getVisibleRow(resource, id, user);
  }

  if (resource === "evaluations") {
    const payload = evaluationPayload(body);
    db.prepare(`
      UPDATE evaluations
      SET internship_id = ?, score = ?, comment = ?, evaluation_date = ?
      WHERE id = ?
    `).run(payload.internship_id, payload.score, payload.comment, payload.evaluation_date, id);
    return getVisibleRow(resource, id, user);
  }

  if (resource === "reports") {
    const payload = reportPayload(body, user, current);
    db.prepare(`
      UPDATE reports
      SET internship_id = ?, student_id = ?, advisor_id = ?, title = ?, week_no = ?, submitted_at = ?,
        summary = ?, hours = ?, status = ?, score = ?, feedback = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      payload.internship_id,
      payload.student_id,
      payload.advisor_id,
      payload.title,
      payload.week_no,
      payload.submitted_at,
      payload.summary,
      payload.hours,
      payload.status,
      payload.score,
      payload.feedback,
      id
    );
    return getVisibleRow(resource, id, user);
  }

  if (resource === "users") {
    const payload = userPayload(body, false);
    const values = [payload.name, payload.email, payload.role, payload.advisor_id, payload.student_id, payload.status];
    let sql = "UPDATE users SET name = ?, email = ?, role = ?, advisor_id = ?, student_id = ?, status = ?";

    if (payload.password_hash) {
      sql += ", password_hash = ?";
      values.push(payload.password_hash);
    }

    sql += " WHERE id = ?";
    values.push(id);
    db.prepare(sql).run(...values);
    return getVisibleRow(resource, id, user);
  }

  throw new HttpError(404, "Resource not found");
}

function deleteResource(resource, id, user) {
  const current = getVisibleRow(resource, id, user);
  if (!current) throw new HttpError(404, "Record not found");

  if (resource !== "reports") requireAdmin(user);
  if (resource === "users" && id === user.id) {
    throw new HttpError(400, "You cannot delete your current account");
  }

  if (resource === "reports" && user.role === "student" && current.status === "Approved") {
    throw new HttpError(403, "Approved reports cannot be deleted by students");
  }

  db.prepare(`DELETE FROM ${resourceConfigs[resource].table} WHERE id = ?`).run(id);
}

function studentPayload(body) {
  const department_id = optionalInteger(body, "department_id");
  let major = optionalText(body, "major");
  if (!major && department_id) {
    major = db.prepare("SELECT department_name FROM departments WHERE id = ?").get(department_id)?.department_name || "";
  }

  return {
    student_code: requiredText(body, "student_code"),
    name: requiredText(body, "name"),
    gender: optionalText(body, "gender"),
    email: requiredText(body, "email").toLowerCase(),
    phone: optionalText(body, "phone"),
    major,
    department_id,
    year: optionalNumber(body, "year", 1),
    advisor_id: optionalInteger(body, "advisor_id"),
    status: oneOf(optionalText(body, "status", "Active"), ["Active", "Graduated", "Paused", "Inactive"], "status"),
  };
}

function departmentPayload(body) {
  return {
    department_name: requiredText(body, "department_name"),
  };
}

function advisorPayload(body) {
  return {
    advisor_code: requiredText(body, "advisor_code"),
    name: requiredText(body, "name"),
    email: requiredText(body, "email").toLowerCase(),
    phone: optionalText(body, "phone"),
    department: optionalText(body, "department"),
  };
}

function companyPayload(body) {
  return {
    name: requiredText(body, "name"),
    industry: optionalText(body, "industry"),
    contact_person: optionalText(body, "contact_person"),
    email: optionalText(body, "email").toLowerCase(),
    phone: optionalText(body, "phone"),
    address: optionalText(body, "address"),
  };
}

function supervisorPayload(body) {
  return {
    full_name: requiredText(body, "full_name"),
    phone: optionalText(body, "phone"),
    email: optionalText(body, "email").toLowerCase(),
    company_id: requiredInteger(body, "company_id"),
  };
}

function internshipPayload(body) {
  return {
    student_id: requiredInteger(body, "student_id"),
    company_id: requiredInteger(body, "company_id"),
    supervisor_id: optionalInteger(body, "supervisor_id"),
    advisor_id: optionalInteger(body, "advisor_id"),
    position: requiredText(body, "position"),
    start_date: optionalText(body, "start_date"),
    end_date: optionalText(body, "end_date"),
    status: oneOf(optionalText(body, "status", "Planning"), ["Planning", "Active", "Completed", "On hold"], "status"),
    supervisor_name: optionalText(body, "supervisor_name"),
    supervisor_email: optionalText(body, "supervisor_email").toLowerCase(),
    notes: optionalText(body, "notes"),
  };
}

function evaluationPayload(body) {
  return {
    internship_id: requiredInteger(body, "internship_id"),
    score: optionalNullableNumber(body, "score"),
    comment: optionalText(body, "comment"),
    evaluation_date: optionalText(body, "evaluation_date", today()),
  };
}

function reportPayload(body, user, current = null) {
  const internshipId = requiredInteger(body, "internship_id");
  const internship = getVisibleRow("internships", internshipId, user);
  if (!internship) {
    throw new HttpError(403, "You cannot use this internship");
  }

  const base = {
    internship_id: internship.id,
    student_id: internship.student_id,
    advisor_id: internship.advisor_id,
    title: requiredText(body, "title"),
    week_no: optionalNumber(body, "week_no", current?.week_no || 1),
    submitted_at: optionalText(body, "submitted_at", current?.submitted_at || today()),
    summary: optionalText(body, "summary"),
    hours: optionalNumber(body, "hours", current?.hours || 0),
    status: optionalText(body, "status", current?.status || "Submitted"),
    score: optionalNullableNumber(body, "score"),
    feedback: optionalText(body, "feedback"),
  };

  if (user.role === "student") {
    if (internship.student_id !== user.student_id) {
      throw new HttpError(403, "Students can only manage their own reports");
    }
    if (current?.status === "Approved") {
      throw new HttpError(403, "Approved reports cannot be changed by students");
    }
    base.status = oneOf(base.status, ["Draft", "Submitted", "Needs revision"], "status");
    base.score = current?.score ?? null;
    base.feedback = current?.feedback || "";
  } else if (user.role === "advisor") {
    if (internship.advisor_id !== user.advisor_id) {
      throw new HttpError(403, "Advisors can only manage assigned reports");
    }
    base.status = oneOf(base.status, ["Draft", "Submitted", "Reviewed", "Approved", "Needs revision"], "status");
  } else {
    base.status = oneOf(base.status, ["Draft", "Submitted", "Reviewed", "Approved", "Needs revision"], "status");
  }

  return base;
}

function userPayload(body, isCreate) {
  const role = oneOf(requiredText(body, "role"), ["admin", "advisor", "student"], "role");
  const password = optionalText(body, "password");

  if (isCreate && !password) {
    throw new HttpError(400, "password is required");
  }

  return {
    name: requiredText(body, "name"),
    email: requiredText(body, "email").toLowerCase(),
    password_hash: password ? hashPassword(password) : null,
    role,
    advisor_id: role === "advisor" ? optionalInteger(body, "advisor_id") : null,
    student_id: role === "student" ? optionalInteger(body, "student_id") : null,
    status: oneOf(optionalText(body, "status", "Active"), ["Active", "Inactive"], "status"),
  };
}

function accessCondition(resource, user, alias) {
  if (user.role === "admin") return { sql: "1 = 1", params: [] };

  if (resource === "departments") {
    if (user.role === "advisor") {
      return { sql: `${alias}.id IN (SELECT department_id FROM students WHERE advisor_id = ?)`, params: [user.advisor_id] };
    }
    return { sql: `${alias}.id = (SELECT department_id FROM students WHERE id = ?)`, params: [user.student_id] };
  }

  if (resource === "students") {
    if (user.role === "advisor") return { sql: `${alias}.advisor_id = ?`, params: [user.advisor_id] };
    return { sql: `${alias}.id = ?`, params: [user.student_id] };
  }

  if (resource === "advisors") {
    if (user.role === "advisor") return { sql: `${alias}.id = ?`, params: [user.advisor_id] };
    return { sql: `${alias}.id = (SELECT advisor_id FROM students WHERE id = ?)`, params: [user.student_id] };
  }

  if (resource === "companies") {
    if (user.role === "advisor") {
      return { sql: `${alias}.id IN (SELECT company_id FROM internships WHERE advisor_id = ?)`, params: [user.advisor_id] };
    }
    return { sql: `${alias}.id IN (SELECT company_id FROM internships WHERE student_id = ?)`, params: [user.student_id] };
  }

  if (resource === "supervisors") {
    if (user.role === "advisor") {
      return {
        sql: `${alias}.company_id IN (SELECT company_id FROM internships WHERE advisor_id = ?)`,
        params: [user.advisor_id],
      };
    }
    return {
      sql: `${alias}.company_id IN (SELECT company_id FROM internships WHERE student_id = ?)`,
      params: [user.student_id],
    };
  }

  if (resource === "internships") {
    if (user.role === "advisor") return { sql: `${alias}.advisor_id = ?`, params: [user.advisor_id] };
    return { sql: `${alias}.student_id = ?`, params: [user.student_id] };
  }

  if (resource === "reports") {
    if (user.role === "advisor") return { sql: `${alias}.advisor_id = ?`, params: [user.advisor_id] };
    return { sql: `${alias}.student_id = ?`, params: [user.student_id] };
  }

  if (resource === "evaluations") {
    if (user.role === "advisor") {
      return {
        sql: `${alias}.internship_id IN (SELECT id FROM internships WHERE advisor_id = ?)`,
        params: [user.advisor_id],
      };
    }
    return {
      sql: `${alias}.internship_id IN (SELECT id FROM internships WHERE student_id = ?)`,
      params: [user.student_id],
    };
  }

  if (resource === "users") {
    return { sql: `${alias}.id = ?`, params: [user.id] };
  }

  throw new HttpError(404, "Resource not found");
}

function getSummary(user) {
  const departments = countVisible("departments", user);
  const students = countVisible("students", user);
  const companies = countVisible("companies", user);
  const supervisors = countVisible("supervisors", user);
  const internships = countVisible("internships", user);
  const evaluations = countVisible("evaluations", user);
  const activeInternships = countVisible("internships", user, "status = 'Active'");
  const completedInternships = countVisible("internships", user, "status = 'Completed'");
  const recentInternships = listResource("internships", user).slice(0, 5);
  const recentEvaluations = listResource("evaluations", user).slice(0, 5);

  return {
    totals: { departments, students, companies, supervisors, internships, evaluations, activeInternships, completedInternships },
    recentInternships,
    recentEvaluations,
  };
}

function countVisible(resource, user, extra = "") {
  const config = resourceConfigs[resource];
  const access = accessCondition(resource, user, config.alias);
  const clauses = [access.sql];
  if (extra) clauses.push(`${config.alias}.${extra}`);
  const sql = `SELECT COUNT(*) AS total FROM ${config.table} ${config.alias} WHERE ${clauses.join(" AND ")}`;
  return db.prepare(sql).get(...access.params).total;
}

function requireAdmin(user) {
  if (user.role !== "admin") {
    throw new HttpError(403, "Only admins can change this record");
  }
}

function getSessionUser(req) {
  const token = getCookie(req, COOKIE_NAME);
  const session = token ? sessions.get(token) : null;
  if (!session) return null;

  const user = db.prepare("SELECT * FROM users WHERE id = ? AND status = 'Active'").get(session.userId);
  if (!user) {
    sessions.delete(token);
    return null;
  }

  return user;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const iterations = 120000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [algo, iterationText, salt, hash] = String(stored).split("$");
  if (algo !== "pbkdf2_sha256" || !iterationText || !salt || !hash) return false;

  const iterations = Number(iterationText);
  const attempt = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempt, "hex"));
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    advisor_id: user.advisor_id,
    student_id: user.student_id,
    status: user.status,
  };
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new HttpError(413, "Request body is too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new HttpError(400, "Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function requiredText(body, field) {
  const value = optionalText(body, field);
  if (!value) throw new HttpError(400, `${field} is required`);
  return value;
}

function optionalText(body, field, fallback = "") {
  const value = body?.[field];
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function requiredInteger(body, field) {
  const value = optionalInteger(body, field);
  if (value === null) throw new HttpError(400, `${field} is required`);
  return value;
}

function optionalInteger(body, field) {
  const value = body?.[field];
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number)) throw new HttpError(400, `${field} must be an integer`);
  return number;
}

function optionalNumber(body, field, fallback = 0) {
  const value = body?.[field];
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new HttpError(400, `${field} must be a number`);
  return number;
}

function optionalNullableNumber(body, field) {
  const value = body?.[field];
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new HttpError(400, `${field} must be a number`);
  return number;
}

function oneOf(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new HttpError(400, `${field} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function setCookie(res, token) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`);
}

function clearCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function getCookie(req, name) {
  const header = req.headers.cookie || "";
  const parts = header.split(";").map((part) => part.trim());
  const item = parts.find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}

function serveStatic(req, res, url) {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const type = mimeType(path.extname(filePath));
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(content);
  });
}

function mimeType(extension) {
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
  }[extension.toLowerCase()] || "application/octet-stream";
}
