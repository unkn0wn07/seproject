const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, normalizeRows } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());



const router = express.Router();

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [p, d, n, r, a, ad] = await Promise.all([
      pool.query('SELECT COUNT(*) AS c FROM patient'),
      pool.query('SELECT COUNT(*) AS c FROM doctor'),
      pool.query('SELECT COUNT(*) AS c FROM nurse'),
      pool.query('SELECT COUNT(*) AS c FROM room'),
      pool.query('SELECT COUNT(*) AS c FROM appointment'),
      pool.query('SELECT COUNT(*) AS c FROM admission')
    ]);
    res.json({
      patients: parseInt(p.rows[0]?.c || 0, 10),
      doctors: parseInt(d.rows[0]?.c || 0, 10),
      nurses: parseInt(n.rows[0]?.c || 0, 10),
      rooms: parseInt(r.rows[0]?.c || 0, 10),
      appointments: parseInt(a.rows[0]?.c || 0, 10),
      admissions: parseInt(ad.rows[0]?.c || 0, 10)
    });
  } catch (e) {
    console.error('Error fetching dashboard:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── PATIENTS ──────────────────────────────────────────────────────────────────
router.get('/patients', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p."Patient_ID", p."First_Name", p."Last_Name",
             p."Gender", p."Blood_Group", p."Street",
             p."City", p."State",
             STRING_AGG(pp."Phone_No"::text, ', ') AS "phones"
      FROM patient p
      LEFT JOIN patient_phone pp ON p."Patient_ID" = pp."Patient_ID"
      GROUP BY p."Patient_ID", p."First_Name", p."Last_Name", p."Gender", p."Blood_Group", p."Street", p."City", p."State"
      ORDER BY p."Patient_ID"
    `);
    res.json(normalizeRows(rows));
  } catch (e) {
    console.error('Error fetching patients:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/patients', async (req, res) => {
  const { Patient_ID, First_Name, Last_Name, Gender, Blood_Group, Street, City, State, Phone_No } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO patient ("Patient_ID", "First_Name", "Last_Name", "Gender", "Blood_Group", "Street", "City", "State")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        parseInt(Patient_ID, 10),
        First_Name || null,
        Last_Name || null,
        Gender || null,
        Blood_Group || null,
        Street || null,
        City || null,
        State || null
      ]
    );
    if (Phone_No && String(Phone_No).trim()) {
      await client.query(
        'INSERT INTO patient_phone ("Patient_ID", "Phone_No") VALUES ($1, $2)',
        [parseInt(Patient_ID, 10), String(Phone_No).trim()]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'Patient added successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error adding patient:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.put('/patients/:id', async (req, res) => {
  const { id } = req.params;
  const { First_Name, Last_Name, Gender, Blood_Group, Street, City, State, Phone_No } = req.body;
  const patientId = parseInt(id, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE patient
       SET "First_Name" = $1, "Last_Name" = $2, "Gender" = $3, "Blood_Group" = $4, "Street" = $5, "City" = $6, "State" = $7
       WHERE "Patient_ID" = $8`,
      [
        First_Name || null,
        Last_Name || null,
        Gender || null,
        Blood_Group || null,
        Street || null,
        City || null,
        State || null,
        patientId
      ]
    );
    await client.query('DELETE FROM patient_phone WHERE "Patient_ID" = $1', [patientId]);
    if (Phone_No && String(Phone_No).trim()) {
      await client.query(
        'INSERT INTO patient_phone ("Patient_ID", "Phone_No") VALUES ($1, $2)',
        [patientId, String(Phone_No).trim()]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Patient updated successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error updating patient:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.delete('/patients/:id', async (req, res) => {
  const { id } = req.params;
  const patientId = parseInt(id, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM patient_phone WHERE "Patient_ID" = $1', [patientId]);
    await client.query('DELETE FROM patient WHERE "Patient_ID" = $1', [patientId]);
    await client.query('COMMIT');
    res.json({ message: 'Patient deleted successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error deleting patient:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── DOCTORS ───────────────────────────────────────────────────────────────────
router.get('/doctors', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d."Staff_ID", s."First_Name", s."Last_Name",
             s."Gender", s."Salary", s."Dept_ID",
             s."Street", s."City", s."State",
             d."Qualification", d."Specialization",
             d."Consultation_Fees", dept."Dept_Name"
      FROM doctor d
      JOIN staff s ON d."Staff_ID" = s."Staff_ID"
      LEFT JOIN department dept ON s."Dept_ID" = dept."Dept_ID"
      ORDER BY d."Staff_ID"
    `);
    res.json(normalizeRows(rows));
  } catch (e) {
    console.error('Error fetching doctors:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/doctors', async (req, res) => {
  const { Staff_ID, First_Name, Last_Name, Gender, Salary, Street, City, State, Dept_ID, Qualification, Specialization, Consultation_Fees } = req.body;
  const staffId = parseInt(Staff_ID, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO staff ("Staff_ID", "First_Name", "Last_Name", "Gender", "Salary", "Street", "City", "State", "Dept_ID")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        staffId,
        First_Name || null,
        Last_Name || null,
        Gender || null,
        Salary ? parseFloat(Salary) : 0,
        Street || null,
        City || null,
        State || null,
        Dept_ID ? parseInt(Dept_ID, 10) : null
      ]
    );
    await client.query(
      `INSERT INTO doctor ("Staff_ID", "Qualification", "Specialization", "Consultation_Fees")
       VALUES ($1, $2, $3, $4)`,
      [
        staffId,
        Qualification || null,
        Specialization || null,
        Consultation_Fees ? parseFloat(Consultation_Fees) : 0
      ]
    );
    await client.query('COMMIT');
    res.status(201).json({ message: 'Doctor added successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error adding doctor:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.put('/doctors/:id', async (req, res) => {
  const { id } = req.params;
  const staffId = parseInt(id, 10);
  const { First_Name, Last_Name, Gender, Salary, Street, City, State, Dept_ID, Qualification, Specialization, Consultation_Fees } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE staff
       SET "First_Name" = $1, "Last_Name" = $2, "Gender" = $3, "Salary" = $4, "Street" = $5, "City" = $6, "State" = $7, "Dept_ID" = $8
       WHERE "Staff_ID" = $9`,
      [
        First_Name || null,
        Last_Name || null,
        Gender || null,
        Salary ? parseFloat(Salary) : 0,
        Street || null,
        City || null,
        State || null,
        Dept_ID ? parseInt(Dept_ID, 10) : null,
        staffId
      ]
    );
    await client.query(
      `UPDATE doctor
       SET "Qualification" = $1, "Specialization" = $2, "Consultation_Fees" = $3
       WHERE "Staff_ID" = $4`,
      [
        Qualification || null,
        Specialization || null,
        Consultation_Fees ? parseFloat(Consultation_Fees) : 0,
        staffId
      ]
    );
    await client.query('COMMIT');
    res.json({ message: 'Doctor updated successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error updating doctor:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.delete('/doctors/:id', async (req, res) => {
  const { id } = req.params;
  const staffId = parseInt(id, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM doctor WHERE "Staff_ID" = $1', [staffId]);
    await client.query('DELETE FROM staff_phone WHERE "Staff_ID" = $1', [staffId]);
    await client.query('DELETE FROM staff WHERE "Staff_ID" = $1', [staffId]);
    await client.query('COMMIT');
    res.json({ message: 'Doctor deleted successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error deleting doctor:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── NURSES ────────────────────────────────────────────────────────────────────
router.get('/nurses', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT n."Staff_ID", s."First_Name", s."Last_Name",
             s."Gender", s."Salary", s."Dept_ID",
             s."Street", s."City", s."State",
             n."Shift", n."Grade", dept."Dept_Name"
      FROM nurse n
      JOIN staff s ON n."Staff_ID" = s."Staff_ID"
      LEFT JOIN department dept ON s."Dept_ID" = dept."Dept_ID"
      ORDER BY n."Staff_ID"
    `);
    res.json(normalizeRows(rows));
  } catch (e) {
    console.error('Error fetching nurses:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/nurses', async (req, res) => {
  const { Staff_ID, First_Name, Last_Name, Gender, Salary, Street, City, State, Dept_ID, Shift, Grade } = req.body;
  const staffId = parseInt(Staff_ID, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO staff ("Staff_ID", "First_Name", "Last_Name", "Gender", "Salary", "Street", "City", "State", "Dept_ID")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        staffId,
        First_Name || null,
        Last_Name || null,
        Gender || null,
        Salary ? parseFloat(Salary) : 0,
        Street || null,
        City || null,
        State || null,
        Dept_ID ? parseInt(Dept_ID, 10) : null
      ]
    );
    await client.query(
      `INSERT INTO nurse ("Staff_ID", "Shift", "Grade")
       VALUES ($1, $2, $3)`,
      [staffId, Shift || null, Grade || null]
    );
    await client.query('COMMIT');
    res.status(201).json({ message: 'Nurse added successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error adding nurse:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.put('/nurses/:id', async (req, res) => {
  const { id } = req.params;
  const staffId = parseInt(id, 10);
  const { First_Name, Last_Name, Gender, Salary, Street, City, State, Dept_ID, Shift, Grade } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE staff
       SET "First_Name" = $1, "Last_Name" = $2, "Gender" = $3, "Salary" = $4, "Street" = $5, "City" = $6, "State" = $7, "Dept_ID" = $8
       WHERE "Staff_ID" = $9`,
      [
        First_Name || null,
        Last_Name || null,
        Gender || null,
        Salary ? parseFloat(Salary) : 0,
        Street || null,
        City || null,
        State || null,
        Dept_ID ? parseInt(Dept_ID, 10) : null,
        staffId
      ]
    );
    await client.query(
      `UPDATE nurse
       SET "Shift" = $1, "Grade" = $2
       WHERE "Staff_ID" = $3`,
      [Shift || null, Grade || null, staffId]
    );
    await client.query('COMMIT');
    res.json({ message: 'Nurse updated successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error updating nurse:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.delete('/nurses/:id', async (req, res) => {
  const { id } = req.params;
  const staffId = parseInt(id, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM nurse WHERE "Staff_ID" = $1', [staffId]);
    await client.query('DELETE FROM staff_phone WHERE "Staff_ID" = $1', [staffId]);
    await client.query('DELETE FROM staff WHERE "Staff_ID" = $1', [staffId]);
    await client.query('COMMIT');
    res.json({ message: 'Nurse deleted successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error deleting nurse:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── STAFF (General) ───────────────────────────────────────────────────────────
router.get('/staff', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s."Staff_ID", s."First_Name", s."Last_Name",
             s."Gender", s."Salary", s."Street",
             s."City", s."State", s."Dept_ID", d."Dept_Name",
             CASE WHEN doc."Staff_ID" IS NOT NULL THEN 'Doctor'
                  WHEN n."Staff_ID" IS NOT NULL THEN 'Nurse'
                  WHEN a."Staff_ID" IS NOT NULL THEN 'Admin'
                  ELSE 'Staff' END AS "Role",
             STRING_AGG(sp."Phone_No"::text, ', ') AS "phones"
      FROM staff s
      LEFT JOIN department d ON s."Dept_ID" = d."Dept_ID"
      LEFT JOIN doctor doc ON s."Staff_ID" = doc."Staff_ID"
      LEFT JOIN nurse n ON s."Staff_ID" = n."Staff_ID"
      LEFT JOIN admin_staff a ON s."Staff_ID" = a."Staff_ID"
      LEFT JOIN staff_phone sp ON s."Staff_ID" = sp."Staff_ID"
      GROUP BY s."Staff_ID", s."First_Name", s."Last_Name", s."Gender", s."Salary", s."Street", s."City", s."State", s."Dept_ID", d."Dept_Name", doc."Staff_ID", n."Staff_ID", a."Staff_ID"
      ORDER BY s."Staff_ID"
    `);
    res.json(normalizeRows(rows));
  } catch (e) {
    console.error('Error fetching staff:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.put('/staff/:id', async (req, res) => {
  const { id } = req.params;
  const staffId = parseInt(id, 10);
  const { First_Name, Last_Name, Gender, Salary, Street, City, State, Dept_ID } = req.body;
  try {
    await pool.query(
      `UPDATE staff
       SET "First_Name" = $1, "Last_Name" = $2, "Gender" = $3, "Salary" = $4, "Street" = $5, "City" = $6, "State" = $7, "Dept_ID" = $8
       WHERE "Staff_ID" = $9`,
      [
        First_Name || null,
        Last_Name || null,
        Gender || null,
        Salary ? parseFloat(Salary) : 0,
        Street || null,
        City || null,
        State || null,
        Dept_ID ? parseInt(Dept_ID, 10) : null,
        staffId
      ]
    );
    res.json({ message: 'Staff updated successfully' });
  } catch (e) {
    console.error('Error updating staff:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/staff/:id', async (req, res) => {
  const { id } = req.params;
  const staffId = parseInt(id, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM staff_phone WHERE "Staff_ID" = $1', [staffId]);
    await client.query('DELETE FROM doctor WHERE "Staff_ID" = $1', [staffId]);
    await client.query('DELETE FROM nurse WHERE "Staff_ID" = $1', [staffId]);
    await client.query('DELETE FROM admin_staff WHERE "Staff_ID" = $1', [staffId]);
    await client.query('DELETE FROM staff WHERE "Staff_ID" = $1', [staffId]);
    await client.query('COMMIT');
    res.json({ message: 'Staff deleted successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error deleting staff:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── APPOINTMENTS ──────────────────────────────────────────────────────────────
router.get('/appointments', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a."Appointment_ID", a."Date", a."Time",
             CONCAT(p."First_Name", ' ', p."Last_Name") AS "Patient_Name", a."Patient_ID",
             CONCAT(s."First_Name", ' ', s."Last_Name") AS "Doctor_Name", a."Staff_ID",
             d."Specialization"
      FROM appointment a
      JOIN patient p ON a."Patient_ID" = p."Patient_ID"
      JOIN staff s ON a."Staff_ID" = s."Staff_ID"
      JOIN doctor d ON a."Staff_ID" = d."Staff_ID"
      ORDER BY a."Date" DESC, a."Time" DESC
    `);
    res.json(normalizeRows(rows));
  } catch (e) {
    console.error('Error fetching appointments:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/appointments', async (req, res) => {
  const { Appointment_ID, Date: date, Time: time, Patient_ID, Staff_ID } = req.body;
  try {
    await pool.query(
      `INSERT INTO appointment ("Appointment_ID", "Date", "Time", "Patient_ID", "Staff_ID")
       VALUES ($1, $2, $3, $4, $5)`,
      [
        parseInt(Appointment_ID, 10),
        date || null,
        time || null,
        parseInt(Patient_ID, 10),
        parseInt(Staff_ID, 10)
      ]
    );
    res.status(201).json({ message: 'Appointment booked successfully' });
  } catch (e) {
    console.error('Error booking appointment:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.put('/appointments/:id', async (req, res) => {
  const { id } = req.params;
  const { Date: date, Time: time, Patient_ID, Staff_ID } = req.body;
  try {
    await pool.query(
      `UPDATE appointment
       SET "Date" = $1, "Time" = $2, "Patient_ID" = $3, "Staff_ID" = $4
       WHERE "Appointment_ID" = $5`,
      [
        date || null,
        time || null,
        parseInt(Patient_ID, 10),
        parseInt(Staff_ID, 10),
        parseInt(id, 10)
      ]
    );
    res.json({ message: 'Appointment updated successfully' });
  } catch (e) {
    console.error('Error updating appointment:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/appointments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM appointment WHERE "Appointment_ID" = $1', [parseInt(id, 10)]);
    res.json({ message: 'Appointment deleted successfully' });
  } catch (e) {
    console.error('Error deleting appointment:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── ADMISSIONS ────────────────────────────────────────────────────────────────
router.get('/admissions', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ad."Admission_ID", ad."Admit_Date",
             ad."Discharge_Date", ad."Patient_ID",
             ad."Room_ID", ad."Staff_ID",
             CONCAT(p."First_Name", ' ', p."Last_Name") AS "Patient_Name",
             r."Room_Type", r."Charges_Per_Day",
             CONCAT(s."First_Name", ' ', s."Last_Name") AS "Doctor_Name"
      FROM admission ad
      JOIN patient p ON ad."Patient_ID" = p."Patient_ID"
      JOIN room r ON ad."Room_ID" = r."Room_ID"
      JOIN staff s ON ad."Staff_ID" = s."Staff_ID"
      ORDER BY ad."Admit_Date" DESC
    `);
    res.json(normalizeRows(rows));
  } catch (e) {
    console.error('Error fetching admissions:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/admissions', async (req, res) => {
  const { Admission_ID, Admit_Date, Discharge_Date, Patient_ID, Room_ID, Staff_ID } = req.body;
  try {
    await pool.query(
      `INSERT INTO admission ("Admission_ID", "Admit_Date", "Discharge_Date", "Patient_ID", "Room_ID", "Staff_ID")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        parseInt(Admission_ID, 10),
        Admit_Date || null,
        Discharge_Date || null,
        parseInt(Patient_ID, 10),
        parseInt(Room_ID, 10),
        parseInt(Staff_ID, 10)
      ]
    );
    res.status(201).json({ message: 'Admission added successfully' });
  } catch (e) {
    console.error('Error adding admission:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.put('/admissions/:id', async (req, res) => {
  const { id } = req.params;
  const { Admit_Date, Discharge_Date, Patient_ID, Room_ID, Staff_ID } = req.body;
  try {
    await pool.query(
      `UPDATE admission
       SET "Admit_Date" = $1, "Discharge_Date" = $2, "Patient_ID" = $3, "Room_ID" = $4, "Staff_ID" = $5
       WHERE "Admission_ID" = $6`,
      [
        Admit_Date || null,
        Discharge_Date || null,
        parseInt(Patient_ID, 10),
        parseInt(Room_ID, 10),
        parseInt(Staff_ID, 10),
        parseInt(id, 10)
      ]
    );
    res.json({ message: 'Admission updated successfully' });
  } catch (e) {
    console.error('Error updating admission:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/admissions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM admission WHERE "Admission_ID" = $1', [parseInt(id, 10)]);
    res.json({ message: 'Admission deleted successfully' });
  } catch (e) {
    console.error('Error deleting admission:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── ROOMS ─────────────────────────────────────────────────────────────────────
router.get('/rooms', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT "Room_ID", "Room_Type",
             "Charges_Per_Day", "Status"
      FROM room
      ORDER BY "Room_ID"
    `);
    res.json(normalizeRows(rows));
  } catch (e) {
    console.error('Error fetching rooms:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/rooms', async (req, res) => {
  const { Room_ID, Room_Type, Charges_Per_Day, Status } = req.body;
  try {
    await pool.query(
      `INSERT INTO room ("Room_ID", "Room_Type", "Charges_Per_Day", "Status")
       VALUES ($1, $2, $3, $4)`,
      [
        parseInt(Room_ID, 10),
        Room_Type || null,
        Charges_Per_Day ? parseFloat(Charges_Per_Day) : 0,
        Status || 'Available'
      ]
    );
    res.status(201).json({ message: 'Room added successfully' });
  } catch (e) {
    console.error('Error adding room:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.put('/rooms/:id', async (req, res) => {
  const { id } = req.params;
  const { Room_Type, Charges_Per_Day, Status } = req.body;
  try {
    await pool.query(
      `UPDATE room
       SET "Room_Type" = $1, "Charges_Per_Day" = $2, "Status" = $3
       WHERE "Room_ID" = $4`,
      [
        Room_Type || null,
        Charges_Per_Day ? parseFloat(Charges_Per_Day) : 0,
        Status || null,
        parseInt(id, 10)
      ]
    );
    res.json({ message: 'Room updated successfully' });
  } catch (e) {
    console.error('Error updating room:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/rooms/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM room WHERE "Room_ID" = $1', [parseInt(id, 10)]);
    res.json({ message: 'Room deleted successfully' });
  } catch (e) {
    console.error('Error deleting room:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────
router.get('/departments', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d."Dept_ID", d."Dept_Name", d."Location",
             d."Hospital_ID", h."Name" AS "Hospital_Name",
             COUNT(s."Staff_ID") AS "Staff_Count"
      FROM department d
      LEFT JOIN hospital h ON d."Hospital_ID" = h."Hospital_ID"
      LEFT JOIN staff s ON s."Dept_ID" = d."Dept_ID"
      GROUP BY d."Dept_ID", d."Dept_Name", d."Location", d."Hospital_ID", h."Name"
      ORDER BY d."Dept_ID"
    `);
    res.json(normalizeRows(rows));
  } catch (e) {
    console.error('Error fetching departments:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/departments', async (req, res) => {
  const { Dept_ID, Dept_Name, Location, Hospital_ID } = req.body;
  try {
    await pool.query(
      `INSERT INTO department ("Dept_ID", "Dept_Name", "Location", "Hospital_ID")
       VALUES ($1, $2, $3, $4)`,
      [
        parseInt(Dept_ID, 10),
        Dept_Name || null,
        Location || null,
        Hospital_ID ? parseInt(Hospital_ID, 10) : null
      ]
    );
    res.status(201).json({ message: 'Department added successfully' });
  } catch (e) {
    console.error('Error adding department:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.put('/departments/:id', async (req, res) => {
  const { id } = req.params;
  const { Dept_Name, Location, Hospital_ID } = req.body;
  try {
    await pool.query(
      `UPDATE department
       SET "Dept_Name" = $1, "Location" = $2, "Hospital_ID" = $3
       WHERE "Dept_ID" = $4`,
      [
        Dept_Name || null,
        Location || null,
        Hospital_ID ? parseInt(Hospital_ID, 10) : null,
        parseInt(id, 10)
      ]
    );
    res.json({ message: 'Department updated successfully' });
  } catch (e) {
    console.error('Error updating department:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/departments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM department WHERE "Dept_ID" = $1', [parseInt(id, 10)]);
    res.json({ message: 'Department deleted successfully' });
  } catch (e) {
    console.error('Error deleting department:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── HOSPITALS ─────────────────────────────────────────────────────────────────
router.get('/hospitals', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT "Hospital_ID", "Name", "Street",
             "City", "State", "Contact_No"
      FROM hospital
      ORDER BY "Hospital_ID"
    `);
    res.json(normalizeRows(rows));
  } catch (e) {
    console.error('Error fetching hospitals:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Mount router on multiple base paths to support Netlify Functions and local development
app.use('/.netlify/functions/api', router);
app.use('/api', router);
app.use('/', router);

// Serve static frontend assets for local standalone running
app.use(express.static(path.join(__dirname, '..')));

// Preserve local development server startup
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  if (process.env.DATABASE_URL) {
    pool.query('SELECT NOW()')
      .then(() => console.log('✅ Connected to PostgreSQL / Supabase database'))
      .catch(e => console.error('❌ Database connection failed:', e.message));
  }
  app.listen(PORT, () => {
    console.log(`🏥 Hospital Management Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.pool = pool;
