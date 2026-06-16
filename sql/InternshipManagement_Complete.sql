/* ============================================================
   Internship Management System
   SQL Server database script
   Database: InternshipManagement
   ============================================================ */

IF DB_ID(N'InternshipManagement') IS NULL
BEGIN
    CREATE DATABASE InternshipManagement;
END
GO

USE InternshipManagement;
GO

IF OBJECT_ID(N'dbo.Departments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Departments (
        DepartmentID INT IDENTITY(1,1) PRIMARY KEY,
        DepartmentName NVARCHAR(100) NOT NULL
    );
END
GO

IF OBJECT_ID(N'dbo.Students', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Students (
        StudentID INT IDENTITY(1,1) PRIMARY KEY,
        StudentCode NVARCHAR(20) NOT NULL UNIQUE,
        FullName NVARCHAR(100) NOT NULL,
        Gender NVARCHAR(10),
        Phone NVARCHAR(20),
        Email NVARCHAR(100),
        DepartmentID INT NOT NULL,
        CONSTRAINT FK_Students_Departments
            FOREIGN KEY (DepartmentID) REFERENCES dbo.Departments(DepartmentID)
    );
END
GO

IF OBJECT_ID(N'dbo.Companies', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Companies (
        CompanyID INT IDENTITY(1,1) PRIMARY KEY,
        CompanyName NVARCHAR(150) NOT NULL,
        Address NVARCHAR(255),
        Phone NVARCHAR(20),
        Email NVARCHAR(100)
    );
END
GO

IF OBJECT_ID(N'dbo.Supervisors', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Supervisors (
        SupervisorID INT IDENTITY(1,1) PRIMARY KEY,
        FullName NVARCHAR(100) NOT NULL,
        Phone NVARCHAR(20),
        Email NVARCHAR(100),
        CompanyID INT NOT NULL,
        CONSTRAINT FK_Supervisors_Companies
            FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID)
    );
END
GO

IF OBJECT_ID(N'dbo.Internships', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Internships (
        InternshipID INT IDENTITY(1,1) PRIMARY KEY,
        StudentID INT NOT NULL,
        CompanyID INT NOT NULL,
        SupervisorID INT NULL,
        Position NVARCHAR(100),
        StartDate DATE NOT NULL,
        EndDate DATE NOT NULL,
        Status NVARCHAR(30) DEFAULT N'Pending',
        CONSTRAINT FK_Internships_Students
            FOREIGN KEY (StudentID) REFERENCES dbo.Students(StudentID),
        CONSTRAINT FK_Internships_Companies
            FOREIGN KEY (CompanyID) REFERENCES dbo.Companies(CompanyID),
        CONSTRAINT FK_Internships_Supervisors
            FOREIGN KEY (SupervisorID) REFERENCES dbo.Supervisors(SupervisorID),
        CONSTRAINT CK_Internships_Date
            CHECK (EndDate >= StartDate)
    );
END
GO

IF OBJECT_ID(N'dbo.Evaluations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Evaluations (
        EvaluationID INT IDENTITY(1,1) PRIMARY KEY,
        InternshipID INT NOT NULL,
        Score DECIMAL(5,2),
        Comment NVARCHAR(500),
        EvaluationDate DATE DEFAULT GETDATE(),
        CONSTRAINT FK_Evaluations_Internships
            FOREIGN KEY (InternshipID) REFERENCES dbo.Internships(InternshipID),
        CONSTRAINT CK_Evaluations_Score
            CHECK (Score >= 0 AND Score <= 100)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE DepartmentName = N'Computer Science')
    INSERT INTO dbo.Departments (DepartmentName) VALUES (N'Computer Science');
IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE DepartmentName = N'Business Administration')
    INSERT INTO dbo.Departments (DepartmentName) VALUES (N'Business Administration');
IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE DepartmentName = N'Accounting')
    INSERT INTO dbo.Departments (DepartmentName) VALUES (N'Accounting');
IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE DepartmentName = N'Information Technology')
    INSERT INTO dbo.Departments (DepartmentName) VALUES (N'Information Technology');
IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE DepartmentName = N'Finance')
    INSERT INTO dbo.Departments (DepartmentName) VALUES (N'Finance');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST001')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST001', N'Somsak Phommachanh', N'Male', N'02055550001', N'somsak@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Computer Science'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST002')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST002', N'Noy Souvannavong', N'Female', N'02055550002', N'noy@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Computer Science'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST003')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST003', N'Khamla Inthavong', N'Male', N'02055550003', N'khamla@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Business Administration'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST004')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST004', N'Phonexay Keomany', N'Male', N'02055550004', N'phonexay@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Business Administration'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST005')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST005', N'Malida Sihavong', N'Female', N'02055550005', N'malida@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Accounting'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST006')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST006', N'Anousone Phanthavong', N'Male', N'02055550006', N'anousone@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Accounting'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST007')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST007', N'Daovy Vongdala', N'Female', N'02055550007', N'daovy@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Information Technology'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST008')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST008', N'Bounmy Sayavong', N'Male', N'02055550008', N'bounmy@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Information Technology'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST009')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST009', N'Ketsana Chanthala', N'Female', N'02055550009', N'ketsana@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Finance'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST010')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST010', N'Sengmany Phimmasone', N'Male', N'02055550010', N'sengmany@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Finance'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST011')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST011', N'Vilayphone Douangdala', N'Female', N'02055550011', N'vilayphone@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Computer Science'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST012')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST012', N'Soulivanh Xayavong', N'Male', N'02055550012', N'soulivanh@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Business Administration'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST013')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST013', N'Chanthaly Sisouphan', N'Female', N'02055550013', N'chanthaly@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Accounting'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST014')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST014', N'Khamphet Vongsay', N'Male', N'02055550014', N'khamphet@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Information Technology'));
IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE StudentCode = N'ST015')
INSERT INTO dbo.Students (StudentCode, FullName, Gender, Phone, Email, DepartmentID)
VALUES (N'ST015', N'Phonevilay Manivong', N'Female', N'02055550015', N'phonevilay@email.com',
        (SELECT DepartmentID FROM dbo.Departments WHERE DepartmentName = N'Finance'));
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyName = N'Lao Tech Co., Ltd.')
INSERT INTO dbo.Companies (CompanyName, Address, Phone, Email)
VALUES (N'Lao Tech Co., Ltd.', N'Vientiane Capital', N'021111222', N'info@laotech.com');
IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyName = N'Mekong Software')
INSERT INTO dbo.Companies (CompanyName, Address, Phone, Email)
VALUES (N'Mekong Software', N'Vientiane Capital', N'021333444', N'contact@mekongsoft.com');
IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyName = N'Lanexang IT Solutions')
INSERT INTO dbo.Companies (CompanyName, Address, Phone, Email)
VALUES (N'Lanexang IT Solutions', N'Sisattanak, Vientiane', N'021555666', N'hr@lanexangit.com');
IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyName = N'Vientiane Accounting Service')
INSERT INTO dbo.Companies (CompanyName, Address, Phone, Email)
VALUES (N'Vientiane Accounting Service', N'Chanthabouly, Vientiane', N'021777888', N'admin@vas.com');
IF NOT EXISTS (SELECT 1 FROM dbo.Companies WHERE CompanyName = N'Lao Finance Group')
INSERT INTO dbo.Companies (CompanyName, Address, Phone, Email)
VALUES (N'Lao Finance Group', N'Xaysettha, Vientiane', N'021999000', N'contact@laofinance.com');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Supervisors WHERE Email = N'anousone@laotech.com')
INSERT INTO dbo.Supervisors (FullName, Phone, Email, CompanyID)
VALUES (N'Anousone Phanthavong', N'02077770001', N'anousone@laotech.com',
        (SELECT CompanyID FROM dbo.Companies WHERE CompanyName = N'Lao Tech Co., Ltd.'));
IF NOT EXISTS (SELECT 1 FROM dbo.Supervisors WHERE Email = N'malida@mekongsoft.com')
INSERT INTO dbo.Supervisors (FullName, Phone, Email, CompanyID)
VALUES (N'Malida Chanthavong', N'02077770002', N'malida@mekongsoft.com',
        (SELECT CompanyID FROM dbo.Companies WHERE CompanyName = N'Mekong Software'));
IF NOT EXISTS (SELECT 1 FROM dbo.Supervisors WHERE Email = N'khamphanh@lanexangit.com')
INSERT INTO dbo.Supervisors (FullName, Phone, Email, CompanyID)
VALUES (N'Khamphanh Soutthichack', N'02077770003', N'khamphanh@lanexangit.com',
        (SELECT CompanyID FROM dbo.Companies WHERE CompanyName = N'Lanexang IT Solutions'));
IF NOT EXISTS (SELECT 1 FROM dbo.Supervisors WHERE Email = N'daovy@vas.com')
INSERT INTO dbo.Supervisors (FullName, Phone, Email, CompanyID)
VALUES (N'Daovy Keomany', N'02077770004', N'daovy@vas.com',
        (SELECT CompanyID FROM dbo.Companies WHERE CompanyName = N'Vientiane Accounting Service'));
IF NOT EXISTS (SELECT 1 FROM dbo.Supervisors WHERE Email = N'sengmany@laofinance.com')
INSERT INTO dbo.Supervisors (FullName, Phone, Email, CompanyID)
VALUES (N'Sengmany Vongdala', N'02077770005', N'sengmany@laofinance.com',
        (SELECT CompanyID FROM dbo.Companies WHERE CompanyName = N'Lao Finance Group'));
GO

INSERT INTO dbo.Internships (StudentID, CompanyID, SupervisorID, Position, StartDate, EndDate, Status)
SELECT s.StudentID, c.CompanyID, sp.SupervisorID, v.Position, v.StartDate, v.EndDate, v.Status
FROM (VALUES
    (N'ST001', N'Lao Tech Co., Ltd.', N'anousone@laotech.com', N'Web Developer Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Active'),
    (N'ST002', N'Mekong Software', N'malida@mekongsoft.com', N'Database Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Active'),
    (N'ST003', N'Lao Tech Co., Ltd.', N'anousone@laotech.com', N'IT Support Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Pending'),
    (N'ST004', N'Lanexang IT Solutions', N'khamphanh@lanexangit.com', N'Network Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Active'),
    (N'ST005', N'Vientiane Accounting Service', N'daovy@vas.com', N'Accounting Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Active'),
    (N'ST006', N'Vientiane Accounting Service', N'daovy@vas.com', N'Audit Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Active'),
    (N'ST007', N'Mekong Software', N'malida@mekongsoft.com', N'QA Tester Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Active'),
    (N'ST008', N'Lanexang IT Solutions', N'khamphanh@lanexangit.com', N'Help Desk Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Completed'),
    (N'ST009', N'Lao Finance Group', N'sengmany@laofinance.com', N'Finance Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Active'),
    (N'ST010', N'Lao Finance Group', N'sengmany@laofinance.com', N'Banking Service Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Pending'),
    (N'ST011', N'Lao Tech Co., Ltd.', N'anousone@laotech.com', N'Frontend Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Active'),
    (N'ST012', N'Mekong Software', N'malida@mekongsoft.com', N'Business Analyst Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Active'),
    (N'ST013', N'Vientiane Accounting Service', N'daovy@vas.com', N'Tax Assistant Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Active'),
    (N'ST014', N'Lanexang IT Solutions', N'khamphanh@lanexangit.com', N'System Admin Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Completed'),
    (N'ST015', N'Lao Finance Group', N'sengmany@laofinance.com', N'Financial Report Intern', CAST('2026-06-01' AS DATE), CAST('2026-08-31' AS DATE), N'Active')
) AS v(StudentCode, CompanyName, SupervisorEmail, Position, StartDate, EndDate, Status)
JOIN dbo.Students s ON s.StudentCode = v.StudentCode
JOIN dbo.Companies c ON c.CompanyName = v.CompanyName
JOIN dbo.Supervisors sp ON sp.Email = v.SupervisorEmail
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.Internships i
    WHERE i.StudentID = s.StudentID
);
GO

INSERT INTO dbo.Evaluations (InternshipID, Score, Comment, EvaluationDate)
SELECT i.InternshipID, v.Score, v.Comment, CAST('2026-08-31' AS DATE)
FROM (VALUES
    (N'ST001', CAST(85.50 AS DECIMAL(5,2)), N'Good performance'),
    (N'ST002', CAST(90.00 AS DECIMAL(5,2)), N'Excellent database work'),
    (N'ST004', CAST(82.00 AS DECIMAL(5,2)), N'Good network practice'),
    (N'ST005', CAST(88.00 AS DECIMAL(5,2)), N'Careful accounting work'),
    (N'ST006', CAST(79.50 AS DECIMAL(5,2)), N'Needs more speed but reliable'),
    (N'ST007', CAST(84.00 AS DECIMAL(5,2)), N'Good testing documentation'),
    (N'ST008', CAST(91.00 AS DECIMAL(5,2)), N'Completed internship successfully'),
    (N'ST009', CAST(86.00 AS DECIMAL(5,2)), N'Good finance analysis'),
    (N'ST011', CAST(87.50 AS DECIMAL(5,2)), N'Good frontend implementation'),
    (N'ST012', CAST(80.00 AS DECIMAL(5,2)), N'Good communication with users'),
    (N'ST013', CAST(83.00 AS DECIMAL(5,2)), N'Good tax document preparation'),
    (N'ST014', CAST(92.00 AS DECIMAL(5,2)), N'Completed with excellent system support'),
    (N'ST015', CAST(89.00 AS DECIMAL(5,2)), N'Good financial reporting')
) AS v(StudentCode, Score, Comment)
JOIN dbo.Students s ON s.StudentCode = v.StudentCode
JOIN dbo.Internships i ON i.StudentID = s.StudentID
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.Evaluations e
    WHERE e.InternshipID = i.InternshipID
);
GO

CREATE OR ALTER VIEW dbo.vw_InternshipDetails
AS
SELECT
    s.StudentCode,
    s.FullName AS StudentName,
    d.DepartmentName,
    c.CompanyName,
    sp.FullName AS SupervisorName,
    i.Position,
    i.StartDate,
    i.EndDate,
    i.Status,
    e.Score,
    e.Comment AS EvaluationComment
FROM dbo.Internships i
JOIN dbo.Students s ON i.StudentID = s.StudentID
JOIN dbo.Departments d ON s.DepartmentID = d.DepartmentID
JOIN dbo.Companies c ON i.CompanyID = c.CompanyID
LEFT JOIN dbo.Supervisors sp ON i.SupervisorID = sp.SupervisorID
LEFT JOIN dbo.Evaluations e ON i.InternshipID = e.InternshipID;
GO

CREATE OR ALTER VIEW dbo.vw_StudentsByCompany
AS
SELECT
    c.CompanyName,
    COUNT(i.InternshipID) AS TotalStudents
FROM dbo.Companies c
LEFT JOIN dbo.Internships i ON c.CompanyID = i.CompanyID
GROUP BY c.CompanyName;
GO

CREATE OR ALTER VIEW dbo.vw_AverageScoreByDepartment
AS
SELECT
    d.DepartmentName,
    COUNT(e.EvaluationID) AS EvaluatedStudents,
    AVG(e.Score) AS AverageScore
FROM dbo.Departments d
JOIN dbo.Students s ON d.DepartmentID = s.DepartmentID
JOIN dbo.Internships i ON s.StudentID = i.StudentID
LEFT JOIN dbo.Evaluations e ON i.InternshipID = e.InternshipID
GROUP BY d.DepartmentName;
GO

CREATE OR ALTER PROCEDURE dbo.sp_SearchInternshipsByStudentName
    @StudentName NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM dbo.vw_InternshipDetails
    WHERE StudentName LIKE N'%' + @StudentName + N'%'
    ORDER BY StudentCode;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_InternshipSummary
AS
BEGIN
    SET NOCOUNT ON;

    SELECT N'Total Students' AS Item, COUNT(*) AS Total FROM dbo.Students
    UNION ALL
    SELECT N'Total Companies', COUNT(*) FROM dbo.Companies
    UNION ALL
    SELECT N'Total Internships', COUNT(*) FROM dbo.Internships
    UNION ALL
    SELECT N'Total Evaluations', COUNT(*) FROM dbo.Evaluations;
END;
GO

/* Useful report queries for presentation */
SELECT * FROM dbo.vw_InternshipDetails ORDER BY StudentCode;
SELECT * FROM dbo.vw_StudentsByCompany ORDER BY CompanyName;
SELECT * FROM dbo.vw_AverageScoreByDepartment ORDER BY DepartmentName;
EXEC dbo.sp_InternshipSummary;
EXEC dbo.sp_SearchInternshipsByStudentName @StudentName = N'Somsak';
GO
