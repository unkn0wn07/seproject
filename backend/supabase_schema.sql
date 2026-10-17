-- ==============================================================================
-- MediCare HMS — Supabase PostgreSQL Schema & Views Reference
-- Non-destructive reference script for Supabase SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS hospital (
  "Hospital_ID" INT PRIMARY KEY,
  "Name" VARCHAR(100) NOT NULL,
  "Street" VARCHAR(100),
  "City" VARCHAR(50),
  "State" VARCHAR(50),
  "Contact_No" VARCHAR(15)
);

CREATE TABLE IF NOT EXISTS department (
  "Dept_ID" INT PRIMARY KEY,
  "Dept_Name" VARCHAR(100) NOT NULL,
  "Location" VARCHAR(100),
  "Hospital_ID" INT REFERENCES hospital("Hospital_ID") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS staff (
  "Staff_ID" INT PRIMARY KEY,
  "First_Name" VARCHAR(50),
  "Last_Name" VARCHAR(50),
  "Gender" VARCHAR(10),
  "Salary" NUMERIC(10,2) DEFAULT 0,
  "Street" VARCHAR(100),
  "City" VARCHAR(50),
  "State" VARCHAR(50),
  "Dept_ID" INT REFERENCES department("Dept_ID") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS staff_phone (
  "Staff_ID" INT REFERENCES staff("Staff_ID") ON DELETE CASCADE,
  "Phone_No" VARCHAR(15) NOT NULL,
  PRIMARY KEY ("Staff_ID", "Phone_No")
);

CREATE TABLE IF NOT EXISTS doctor (
  "Staff_ID" INT PRIMARY KEY REFERENCES staff("Staff_ID") ON DELETE CASCADE,
  "Qualification" VARCHAR(100),
  "Specialization" VARCHAR(100),
  "Consultation_Fees" NUMERIC(10,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS nurse (
  "Staff_ID" INT PRIMARY KEY REFERENCES staff("Staff_ID") ON DELETE CASCADE,
  "Shift" VARCHAR(20),
  "Grade" VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS admin_staff (
  "Staff_ID" INT PRIMARY KEY REFERENCES staff("Staff_ID") ON DELETE CASCADE,
  "Job_Role" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS patient (
  "Patient_ID" INT PRIMARY KEY,
  "First_Name" VARCHAR(50),
  "Last_Name" VARCHAR(50),
  "Gender" VARCHAR(10),
  "Blood_Group" VARCHAR(5),
  "Street" VARCHAR(100),
  "City" VARCHAR(50),
  "State" VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS patient_phone (
  "Patient_ID" INT REFERENCES patient("Patient_ID") ON DELETE CASCADE,
  "Phone_No" VARCHAR(15) NOT NULL,
  PRIMARY KEY ("Patient_ID", "Phone_No")
);

CREATE TABLE IF NOT EXISTS room (
  "Room_ID" INT PRIMARY KEY,
  "Room_Type" VARCHAR(50),
  "Charges_Per_Day" NUMERIC(10,2) DEFAULT 0,
  "Status" VARCHAR(20) DEFAULT 'Available'
);

CREATE TABLE IF NOT EXISTS appointment (
  "Appointment_ID" INT PRIMARY KEY,
  "Date" DATE,
  "Time" TIME,
  "Patient_ID" INT REFERENCES patient("Patient_ID") ON DELETE CASCADE,
  "Staff_ID" INT REFERENCES doctor("Staff_ID") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admission (
  "Admission_ID" INT PRIMARY KEY,
  "Admit_Date" DATE,
  "Discharge_Date" DATE,
  "Patient_ID" INT REFERENCES patient("Patient_ID") ON DELETE CASCADE,
  "Room_ID" INT REFERENCES room("Room_ID") ON DELETE SET NULL,
  "Staff_ID" INT REFERENCES doctor("Staff_ID") ON DELETE SET NULL
);

-- ── OPTIONAL DBMS VIEWS ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW appointment_summary_by_date AS
SELECT a."Date" AS "Appointment_Date",
       COUNT(DISTINCT a."Patient_ID") AS "Unique_Patients",
       AVG(d."Consultation_Fees") AS "Avg_Consultation_Fee",
       SUM(d."Consultation_Fees") AS "Total_Consultation_Fee"
FROM appointment a
JOIN doctor d ON a."Staff_ID" = d."Staff_ID"
GROUP BY a."Date";

CREATE OR REPLACE VIEW dept_view AS
SELECT "Dept_ID", "Dept_Name", "Location", "Hospital_ID"
FROM department;

CREATE OR REPLACE VIEW patients_by_bloodgroup AS
SELECT "Blood_Group", COUNT(*) AS "Total_Patients"
FROM patient
GROUP BY "Blood_Group";

CREATE OR REPLACE VIEW pune_doctors AS
SELECT d."Staff_ID", s."First_Name", s."Last_Name", s."City",
       d."Specialization", d."Consultation_Fees"
FROM doctor d
JOIN staff s ON d."Staff_ID" = s."Staff_ID"
WHERE s."City" = 'Pune';

CREATE OR REPLACE VIEW pune_staff AS
SELECT "Staff_ID", "First_Name", "Last_Name", "City", "Salary"
FROM staff
WHERE "City" = 'Pune';
