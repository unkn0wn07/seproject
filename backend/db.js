const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

const fs = require('fs');

// Load environment variables without duplicate injection or conflicts
const backendEnv = path.resolve(__dirname, '.env');
const rootEnv = path.resolve(__dirname, '..', '.env');

if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

const connectionString = process.env.DATABASE_URL;

// Safe diagnostic logging (prints ONLY existence & hostname, NEVER passwords or full URI)
if (connectionString) {
  try {
    const parsed = new URL(connectionString);
    console.log(`🔌 [DATABASE] DATABASE_URL detected | Target Host: ${parsed.hostname} | Port: ${parsed.port || 5432}`);
  } catch {
    console.log('🔌 [DATABASE] DATABASE_URL detected | (Custom connection string format)');
  }
} else {
  console.warn('⚠️  [DATABASE WARNING] DATABASE_URL environment variable is not defined.');
  console.warn('   Please configure DATABASE_URL in your .env file or deployment settings.');
}

// Supabase and hosted PostgreSQL require SSL
const dbSslEnv = (process.env.DB_SSL || 'true').trim().toLowerCase();
const sslOption = (dbSslEnv === 'false' || dbSslEnv === 'disable' || dbSslEnv === '0')
  ? false
  : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString,
  ssl: sslOption,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle PostgreSQL client:', err.message);
});

// Canonical mapping of lowercase column names to the exact property names expected by the frontend
const COLUMN_CASE_MAP = {
  patient_id: 'Patient_ID',
  first_name: 'First_Name',
  last_name: 'Last_Name',
  gender: 'Gender',
  blood_group: 'Blood_Group',
  street: 'Street',
  city: 'City',
  state: 'State',
  phone_no: 'Phone_No',
  phones: 'phones',
  staff_id: 'Staff_ID',
  salary: 'Salary',
  dept_id: 'Dept_ID',
  qualification: 'Qualification',
  specialization: 'Specialization',
  consultation_fees: 'Consultation_Fees',
  shift: 'Shift',
  grade: 'Grade',
  dept_name: 'Dept_Name',
  role: 'Role',
  appointment_id: 'Appointment_ID',
  date: 'Date',
  time: 'Time',
  patient_name: 'Patient_Name',
  doctor_name: 'Doctor_Name',
  admission_id: 'Admission_ID',
  admit_date: 'Admit_Date',
  discharge_date: 'Discharge_Date',
  room_id: 'Room_ID',
  room_type: 'Room_Type',
  charges_per_day: 'Charges_Per_Day',
  status: 'Status',
  location: 'Location',
  hospital_id: 'Hospital_ID',
  hospital_name: 'Hospital_Name',
  name: 'Name',
  contact_no: 'Contact_No',
  staff_count: 'Staff_Count'
};

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    const canonicalKey = COLUMN_CASE_MAP[key.toLowerCase()] || key;
    normalized[canonicalKey] = value;
  }
  return normalized;
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeRow);
}

module.exports = {
  pool,
  normalizeRow,
  normalizeRows
};
