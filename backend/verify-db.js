/**
 * Verification & Diagnostic Script for Supabase PostgreSQL Migration
 * Run: node backend/verify-db.js
 */

const { pool, normalizeRows } = require('./db');

const EXPECTED_TABLES = [
  'hospital',
  'department',
  'staff',
  'doctor',
  'nurse',
  'admin_staff',
  'patient',
  'patient_phone',
  'staff_phone',
  'room',
  'appointment',
  'admission'
];

const EXPECTED_VIEWS = [
  'appointment_summary_by_date',
  'dept_view',
  'patients_by_bloodgroup',
  'pune_doctors',
  'pune_staff'
];

async function verifyDatabase() {
  console.log('====================================================');
  console.log('🏥 Supabase PostgreSQL Migration Verification');
  console.log('====================================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL is not set.');
    console.error('Please create a .env file with your Supabase connection string:');
    console.error('DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres\n');
    process.exit(1);
  }

  try {
    const timeRes = await pool.query('SELECT NOW() as now, current_database() as db, version() as version');
    console.log(`✅ Connected successfully to database: "${timeRes.rows[0].db}"`);
    console.log(`🕒 Server Time: ${timeRes.rows[0].now}`);
    console.log(`📦 PostgreSQL Version: ${timeRes.rows[0].version.split(',')[0]}\n`);
  } catch (err) {
    console.error('❌ Connection Failed:', err.message);
    console.error('\nTroubleshooting tips:');
    console.error('1. Check that your Supabase password and project reference are correct.');
    console.error('2. Ensure SSL is enabled (DB_SSL=true).');
    console.error('3. If on Supabase, use the connection pooling URL (port 6543) or direct (port 5432).');
    process.exit(1);
  }

  // 1. Check Tables
  console.log('--- 1. Checking Tables & Row Counts ---');
  let missingTables = 0;
  for (const table of EXPECTED_TABLES) {
    try {
      const checkRes = await pool.query(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' AND LOWER(table_name) = $1`,
        [table.toLowerCase()]
      );

      if (checkRes.rows.length === 0) {
        console.log(`❌ Table missing: "${table}"`);
        missingTables++;
      } else {
        const actualName = checkRes.rows[0].table_name;
        // Count rows
        const countRes = await pool.query(`SELECT COUNT(*) AS c FROM "${actualName}"`);
        console.log(`✅ Table found: "${actualName}" (${countRes.rows[0].c} rows)`);
      }
    } catch (err) {
      console.log(`⚠️  Error querying table "${table}": ${err.message}`);
    }
  }

  // 2. Check Views
  console.log('\n--- 2. Checking Views ---');
  let missingViews = 0;
  for (const view of EXPECTED_VIEWS) {
    try {
      const checkRes = await pool.query(
        `SELECT table_name FROM information_schema.views 
         WHERE table_schema = 'public' AND LOWER(table_name) = $1`,
        [view.toLowerCase()]
      );
      if (checkRes.rows.length === 0) {
        console.log(`⚠️  View missing: "${view}" (optional, not directly used in core Express API routes)`);
        missingViews++;
      } else {
        console.log(`✅ View found: "${checkRes.rows[0].table_name}"`);
      }
    } catch (err) {
      console.log(`⚠️  Error querying view "${view}": ${err.message}`);
    }
  }

  // 3. Test API Queries (Patient with STRING_AGG, Staff with STRING_AGG, Dashboard)
  console.log('\n--- 3. Testing PostgreSQL Query Compatibility ---');
  try {
    const dashP = await pool.query('SELECT COUNT(*) AS c FROM patient');
    console.log(`✅ Dashboard query: Patient count = ${dashP.rows[0].c}`);
  } catch (err) {
    console.error(`❌ Dashboard query failed: ${err.message}`);
  }

  try {
    const patRes = await pool.query(`
      SELECT p."Patient_ID", p."First_Name", p."Last_Name",
             STRING_AGG(pp."Phone_No"::text, ', ') AS "phones"
      FROM patient p LEFT JOIN patient_phone pp ON p."Patient_ID" = pp."Patient_ID"
      GROUP BY p."Patient_ID", p."First_Name", p."Last_Name"
      ORDER BY p."Patient_ID" LIMIT 3
    `);
    const normalized = normalizeRows(patRes.rows);
    console.log(`✅ Patients query with STRING_AGG succeeded (${patRes.rows.length} rows returned)`);
    if (normalized.length > 0) {
      console.log(`   Sample normalized row:`, JSON.stringify(normalized[0]));
    }
  } catch (err) {
    console.error(`❌ Patients query failed: ${err.message}`);
  }

  console.log('\n====================================================');
  if (missingTables === 0) {
    console.log('🎉 Verification completed: All expected tables exist in Supabase!');
  } else {
    console.log(`⚠️ Verification completed with ${missingTables} missing tables.`);
  }
  console.log('====================================================\n');
  await pool.end();
}

verifyDatabase().catch(err => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
