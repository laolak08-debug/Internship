# Internship Management System

Full-stack Internship Management System built with plain HTML, CSS, JavaScript, Node.js, and SQLite.

## Features

- Admin login
- Dashboard with the 6 SQL data tables:
  - Departments
  - Students
  - Companies
  - Supervisors
  - Internships
  - Evaluations
- CRUD, search, and summary cards
- Imports data from `sql/InternshipManagement_Complete.sql`

## Run

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Admin login:

```text
admin@ims.local
Admin123!
```

## Import SQL Data

Run this after starting the app once:

```bash
npm run import:sql
```

The app creates `data/internship.db` locally. The `data/` folder is ignored by Git.

## Check

```bash
npm run check
```
