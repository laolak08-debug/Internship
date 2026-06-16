const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const DEFAULT_SOURCE = path.join(__dirname, "sql", "InternshipManagement_Complete.sql");
const SOURCE = process.argv[2] || DEFAULT_SOURCE;
const DB_PATH = path.join(__dirname, "data", "internship.db");

if (!fs.existsSync(SOURCE)) {
  console.error(`SQL source not found: ${SOURCE}`);
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`SQLite database not found: ${DB_PATH}. Start the app once with "node server.js" first.`);
  process.exit(1);
}

const sql = fs.readFileSync(SOURCE, "utf8");
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");

const parsed = {
  departments: parseDepartments(sql),
  students: parseStudents(sql),
  companies: parseCompanies(sql),
  supervisors: parseSupervisors(sql),
  internships: parseInternships(sql),
  evaluations: parseEvaluations(sql),
};

const counts = {
  departments: parsed.departments.length,
  students: 0,
  companies: 0,
  supervisors: 0,
  internships: 0,
  evaluations: 0,
  adminUsers: 0,
};

ensureSqlTables();
ensureColumn("students", "gender", "TEXT DEFAULT ''");
ensureColumn("students", "department_id", "INTEGER");
ensureColumn("internships", "supervisor_id", "INTEGER");

db.exec("BEGIN");
try {
  resetSqlOnlyData();
  ensureAdminUser();
  importDepartments(parsed.departments);
  importCompanies(parsed.companies, parsed.supervisors);
  importSupervisors(parsed.supervisors);
  importStudents(parsed.students);
  importInternships(parsed.internships, parsed.supervisors);
  importEvaluations(parsed.evaluations);
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

console.log(JSON.stringify({
  source: SOURCE,
  parsed: {
    departments: parsed.departments.length,
    students: parsed.students.length,
    companies: parsed.companies.length,
    supervisors: parsed.supervisors.length,
    internships: parsed.internships.length,
    evaluations: parsed.evaluations.length,
  },
  imported: counts,
  adminLogin: "admin@ims.local / Admin123!",
}, null, 2));

function resetSqlOnlyData() {
  db.exec(`
    DELETE FROM evaluations;
    DELETE FROM reports;
    DELETE FROM internships;
    DELETE FROM supervisors;
    DELETE FROM companies;
    DELETE FROM students;
    DELETE FROM departments;
    DELETE FROM advisors;
    DELETE FROM users WHERE email <> 'admin@ims.local';
  `);
}

function ensureAdminUser() {
  const statement = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, advisor_id, student_id, status)
    VALUES ('System Admin', 'admin@ims.local', ?, 'admin', NULL, NULL, 'Active')
    ON CONFLICT(email) DO UPDATE SET
      name = 'System Admin',
      password_hash = excluded.password_hash,
      role = 'admin',
      advisor_id = NULL,
      student_id = NULL,
      status = 'Active'
  `);
  statement.run(hashPassword("Admin123!"));
  counts.adminUsers = 1;
}

function ensureSqlTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_name TEXT NOT NULL UNIQUE,
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

    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      internship_id INTEGER NOT NULL,
      score REAL,
      comment TEXT DEFAULT '',
      evaluation_date TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE
    );
  `);
}

function importDepartments(departments) {
  const statement = db.prepare(`
    INSERT INTO departments (department_name)
    VALUES (?)
    ON CONFLICT(department_name) DO UPDATE SET department_name = excluded.department_name
  `);

  departments.forEach((department) => {
    statement.run(department);
  });
}

function importStudents(students) {
  const findDepartment = db.prepare("SELECT id FROM departments WHERE department_name = ?");
  const statement = db.prepare(`
    INSERT INTO students (student_code, name, gender, email, phone, major, year, advisor_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 4, NULL, 'Active')
    ON CONFLICT(student_code) DO UPDATE SET
      name = excluded.name,
      gender = excluded.gender,
      email = excluded.email,
      phone = excluded.phone,
      major = excluded.major,
      year = 4,
      advisor_id = NULL,
      status = 'Active'
  `);

  students.forEach((student) => {
    const department = findDepartment.get(student.department);
    statement.run(
      student.studentCode,
      student.fullName,
      student.gender,
      student.email,
      student.phone,
      student.department
    );
    if (department) {
      db.prepare("UPDATE students SET department_id = ? WHERE student_code = ?").run(department.id, student.studentCode);
    }
    counts.students += 1;
  });
}

function importCompanies(companies, supervisors) {
  const supervisorByCompany = new Map();
  supervisors.forEach((supervisor) => {
    if (!supervisorByCompany.has(supervisor.companyName)) {
      supervisorByCompany.set(supervisor.companyName, supervisor);
    }
  });

  const statement = db.prepare(`
    INSERT INTO companies (name, industry, contact_person, email, phone, address)
    VALUES (?, 'Imported partner', ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      contact_person = COALESCE(NULLIF(excluded.contact_person, ''), companies.contact_person),
      email = excluded.email,
      phone = excluded.phone,
      address = excluded.address
  `);

  companies.forEach((company) => {
    const supervisor = supervisorByCompany.get(company.name);
    statement.run(
      company.name,
      supervisor?.fullName || "",
      company.email,
      company.phone,
      company.address
    );
    counts.companies += 1;
  });
}

function importSupervisors(supervisors) {
  const findCompany = db.prepare("SELECT id FROM companies WHERE name = ?");
  const statement = db.prepare(`
    INSERT INTO supervisors (full_name, phone, email, company_id)
    VALUES (?, ?, ?, ?)
  `);

  supervisors.forEach((supervisor) => {
    const company = findCompany.get(supervisor.companyName);
    if (!company) return;
    statement.run(supervisor.fullName, supervisor.phone, supervisor.email, company.id);
    counts.supervisors += 1;
  });
}

function importInternships(internships, supervisors) {
  const supervisorByEmail = new Map(supervisors.map((supervisor) => [supervisor.email, supervisor]));
  const findStudent = db.prepare("SELECT id FROM students WHERE student_code = ?");
  const findCompany = db.prepare("SELECT id FROM companies WHERE name = ?");
  const findSupervisor = db.prepare("SELECT id FROM supervisors WHERE email = ?");
  const findExisting = db.prepare(`
    SELECT i.id
    FROM internships i
    JOIN students s ON s.id = i.student_id
    WHERE s.student_code = ? AND i.position = ?
    LIMIT 1
  `);
  const insertStatement = db.prepare(`
    INSERT INTO internships
      (student_id, company_id, supervisor_id, advisor_id, position, start_date, end_date, status, supervisor_name, supervisor_email, notes)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStatement = db.prepare(`
    UPDATE internships
    SET student_id = ?, company_id = ?, supervisor_id = ?, advisor_id = NULL, position = ?, start_date = ?, end_date = ?,
      status = ?, supervisor_name = ?, supervisor_email = ?, notes = ?
    WHERE id = ?
  `);

  internships.forEach((internship) => {
    const student = findStudent.get(internship.studentCode);
    const company = findCompany.get(internship.companyName);
    const supervisor = supervisorByEmail.get(internship.supervisorEmail);
    const supervisorRow = findSupervisor.get(internship.supervisorEmail);

    if (!student || !company) return;

    const status = mapInternshipStatus(internship.status);
    const notes = supervisor?.phone
      ? `Imported from SQL Server. Supervisor phone: ${supervisor.phone}`
      : "Imported from SQL Server.";
    const existing = findExisting.get(internship.studentCode, internship.position);

    if (existing) {
      updateStatement.run(
        student.id,
        company.id,
        supervisorRow?.id || null,
        internship.position,
        internship.startDate,
        internship.endDate,
        status,
        supervisor?.fullName || "",
        internship.supervisorEmail,
        notes,
        existing.id
      );
    } else {
      insertStatement.run(
        student.id,
        company.id,
        supervisorRow?.id || null,
        internship.position,
        internship.startDate,
        internship.endDate,
        status,
        supervisor?.fullName || "",
        internship.supervisorEmail,
        notes
      );
    }

    counts.internships += 1;
  });
}

function importEvaluations(evaluations) {
  const findInternship = db.prepare(`
    SELECT i.id, i.student_id
    FROM internships i
    JOIN students s ON s.id = i.student_id
    WHERE s.student_code = ?
    ORDER BY i.id DESC
    LIMIT 1
  `);
  const findEvaluation = db.prepare("SELECT id FROM evaluations WHERE internship_id = ?");
  const insertStatement = db.prepare(`
    INSERT INTO evaluations (internship_id, score, comment, evaluation_date)
    VALUES (?, ?, ?, '2026-08-31')
  `);
  const updateStatement = db.prepare(`
    UPDATE evaluations
    SET score = ?, comment = ?, evaluation_date = '2026-08-31'
    WHERE id = ?
  `);

  evaluations.forEach((evaluation) => {
    const internship = findInternship.get(evaluation.studentCode);
    if (!internship) return;

    const existing = findEvaluation.get(internship.id);

    if (existing) {
      updateStatement.run(
        evaluation.score,
        evaluation.comment,
        existing.id
      );
    } else {
      insertStatement.run(
        internship.id,
        evaluation.score,
        evaluation.comment
      );
    }

    counts.evaluations += 1;
  });
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((item) => item.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function parseDepartments(text) {
  return [...text.matchAll(/INSERT INTO dbo\.Departments \(DepartmentName\) VALUES \(N'((?:''|[^'])+)'\);/g)]
    .map((match) => unescapeSql(match[1]));
}

function parseStudents(text) {
  const pattern = /VALUES\s*\(N'((?:''|[^'])+)',\s*N'((?:''|[^'])+)',\s*N'((?:''|[^'])+)',\s*N'((?:''|[^'])+)',\s*N'((?:''|[^'])+)',\s*\(SELECT DepartmentID FROM dbo\.Departments WHERE DepartmentName = N'((?:''|[^'])+)'\)\);/g;
  return [...text.matchAll(pattern)].map((match) => ({
    studentCode: unescapeSql(match[1]),
    fullName: unescapeSql(match[2]),
    gender: unescapeSql(match[3]),
    phone: unescapeSql(match[4]),
    email: unescapeSql(match[5]).toLowerCase(),
    department: unescapeSql(match[6]),
  }));
}

function parseCompanies(text) {
  const pattern = /INSERT INTO dbo\.Companies \(CompanyName, Address, Phone, Email\)\s*VALUES \(N'((?:''|[^'])+)',\s*N'((?:''|[^'])+)',\s*N'((?:''|[^'])+)',\s*N'((?:''|[^'])+)'\);/g;
  return [...text.matchAll(pattern)].map((match) => ({
    name: unescapeSql(match[1]),
    address: unescapeSql(match[2]),
    phone: unescapeSql(match[3]),
    email: unescapeSql(match[4]).toLowerCase(),
  }));
}

function parseSupervisors(text) {
  const pattern = /INSERT INTO dbo\.Supervisors \(FullName, Phone, Email, CompanyID\)\s*VALUES \(N'((?:''|[^'])+)',\s*N'((?:''|[^'])+)',\s*N'((?:''|[^'])+)',\s*\(SELECT CompanyID FROM dbo\.Companies WHERE CompanyName = N'((?:''|[^'])+)'\)\);/g;
  return [...text.matchAll(pattern)].map((match) => ({
    fullName: unescapeSql(match[1]),
    phone: unescapeSql(match[2]),
    email: unescapeSql(match[3]).toLowerCase(),
    companyName: unescapeSql(match[4]),
  }));
}

function parseInternships(text) {
  const block = text.match(/FROM \(VALUES([\s\S]*?)\) AS v\(StudentCode, CompanyName, SupervisorEmail, Position, StartDate, EndDate, Status\)/);
  if (!block) return [];

  const pattern = /\(N'((?:''|[^'])+)',\s*N'((?:''|[^'])+)',\s*N'((?:''|[^'])+)',\s*N'((?:''|[^'])+)',\s*CAST\('([^']+)' AS DATE\),\s*CAST\('([^']+)' AS DATE\),\s*N'((?:''|[^'])+)'\)/g;
  return [...block[1].matchAll(pattern)].map((match) => ({
    studentCode: unescapeSql(match[1]),
    companyName: unescapeSql(match[2]),
    supervisorEmail: unescapeSql(match[3]).toLowerCase(),
    position: unescapeSql(match[4]),
    startDate: match[5],
    endDate: match[6],
    status: unescapeSql(match[7]),
  }));
}

function parseEvaluations(text) {
  const block = text.match(/INSERT INTO dbo\.Evaluations[\s\S]*?FROM \(VALUES([\s\S]*?)\) AS v\(StudentCode, Score, Comment\)/);
  if (!block) return [];

  const pattern = /\(N'((?:''|[^'])+)',\s*CAST\(([\d.]+) AS DECIMAL\(5,2\)\),\s*N'((?:''|[^'])+)'\)/g;
  return [...block[1].matchAll(pattern)].map((match) => ({
    studentCode: unescapeSql(match[1]),
    score: Number(match[2]),
    comment: unescapeSql(match[3]),
  }));
}

function mapInternshipStatus(status) {
  return {
    Pending: "Planning",
    Active: "Active",
    Completed: "Completed",
  }[status] || "Planning";
}

function unescapeSql(value) {
  return String(value).replace(/''/g, "'");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const iterations = 120000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}
