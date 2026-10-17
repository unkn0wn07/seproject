/* ═══════════════════════════════════════════════════════════════
   MediCare HMS — Full CRUD Application Logic
   ═══════════════════════════════════════════════════════════════ */

// Configurable API base URL:
// - Allows window.API_BASE_URL to override the endpoint (e.g., if hosted separately)
// - On Netlify or same-origin deployment, defaults to '/api'
// - When running frontend via Live Server (port 5500) or file://, fallback to 'http://localhost:5000/api'
const API = (typeof window !== 'undefined' && window.API_BASE_URL)
  ? window.API_BASE_URL.replace(/\/+$/, '')
  : (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file:') && window.location.port !== '5500')
    ? '/api'
    : 'http://localhost:5000/api';


const PAGE_META = {
  dashboard:    { title: 'Dashboard',    subtitle: "Welcome back! Here's an overview of your hospital." },
  patients:     { title: 'Patients',     subtitle: 'Manage patient records — add, edit or delete.' },
  doctors:      { title: 'Doctors',      subtitle: 'Manage doctors — specializations, qualifications and fees.' },
  nurses:       { title: 'Nurses',       subtitle: 'Manage nursing staff, shifts and grades.' },
  staff:        { title: 'Staff',        subtitle: 'Edit or remove staff members across all roles.' },
  appointments: { title: 'Appointments', subtitle: 'Schedule, update or cancel patient appointments.' },
  admissions:   { title: 'Admissions',   subtitle: 'Track and manage patient admissions and discharges.' },
  rooms:        { title: 'Rooms',        subtitle: 'Add, update or remove hospital rooms.' },
  departments:  { title: 'Departments',  subtitle: 'Manage hospital departments and their locations.' },
};

// ── Cached data (for edit lookups) ────────────────────────────────────────────
let _patients = [], _doctors = [], _nurses = [], _staff = [],
    _appointments = [], _admissions = [], _rooms = [], _departments = [];
let allRooms = [];

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setDate();
  setupNav();
  loadDashboard();
});

function setDate() {
  document.getElementById('topbarDate').textContent =
    new Date().toLocaleDateString(undefined, { weekday:'short', year:'numeric', month:'short', day:'numeric' });
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.dataset.page);
      document.getElementById('sidebar').classList.remove('open');
    });
  });
  document.getElementById('menuToggle').addEventListener('click', () =>
    document.getElementById('sidebar').classList.toggle('open'));
}

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  const m = PAGE_META[page] || {};
  document.getElementById('pageTitle').textContent = m.title || page;
  document.getElementById('pageSubtitle').textContent = m.subtitle || '';
  const loaders = {
    dashboard: loadDashboard, patients: loadPatients, doctors: loadDoctors,
    nurses: loadNurses, staff: loadStaff, appointments: loadAppointments,
    admissions: loadAdmissions, rooms: loadRooms, departments: loadDepartments,
  };
  if (loaders[page]) loaders[page]();
}

// ── API HELPER ────────────────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const res = await fetch(API + cleanEndpoint, {
    headers: { 'Content-Type': 'application/json' }, ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Server error');
  return data;
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type]||icons.info}<span>${message}</span>`;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => toast.remove(), 3300);
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open');    }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

// ── FILTER TABLE ──────────────────────────────────────────────────────────────
function filterTable(tableId, query) {
  const q = query.toLowerCase();
  document.querySelectorAll(`#${tableId} tbody tr`).forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'; }
function badge(t, c='gray') { return `<span class="badge badge-${c}">${t??'—'}</span>`; }
function roleBadge(r) { return badge(r, {Doctor:'blue',Nurse:'purple',Admin:'orange'}[r]||'gray'); }
function statusBadge(s) { return s==='Available' ? badge('Available','green') : badge('Occupied','red'); }

const editIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const delIcon  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
function actionBtns(editFn, deleteFn) {
  return `<div class="action-btns">
    <button class="btn-action btn-edit" onclick="${editFn}">${editIcon} Edit</button>
    <button class="btn-action btn-del" onclick="${deleteFn}">${delIcon} Delete</button>
  </div>`;
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function animateCount(id, target) {
  const el = document.getElementById(id); if (!el) return;
  const from = parseInt(el.textContent) || 0, dur = 900, start = performance.now();
  const step = ts => { const p = Math.min((ts-start)/dur,1); el.textContent=Math.round(from+(target-from)*easeOut(p)); if(p<1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const d = await apiFetch('/dashboard');
    animateCount('stat-patients', d.patients); animateCount('stat-doctors', d.doctors);
    animateCount('stat-nurses', d.nurses);     animateCount('stat-rooms', d.rooms);
    animateCount('stat-appointments', d.appointments); animateCount('stat-admissions', d.admissions);
    document.getElementById('lastRefresh').textContent = new Date().toLocaleTimeString();
    const serverBadge = document.getElementById('serverStatusBadge');
    if (serverBadge) serverBadge.textContent = 'Connected ✓';
    const apiBadge = document.getElementById('apiModeBadge');
    if (apiBadge) {
      apiBadge.textContent = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'Local API'
        : 'Netlify Functions';
    }
  } catch(e) {
    showToast('Could not load dashboard. Is the backend running?', 'error');
    const serverBadge = document.getElementById('serverStatusBadge');
    if (serverBadge) {
      serverBadge.textContent = 'Disconnected ✗';
      serverBadge.className = 'info-value badge-red';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATIENTS  (Create, Read, Update, Delete)
// ─────────────────────────────────────────────────────────────────────────────
async function loadPatients() {
  const tbody = document.getElementById('patientTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-row"><div class="loader"></div></td></tr>';
  try {
    _patients = await apiFetch('/patients');
    if (!_patients.length) { tbody.innerHTML='<tr><td colspan="7" class="empty-row">No patients found.</td></tr>'; return; }
    tbody.innerHTML = _patients.map((p,i) => `<tr>
      <td>${badge(p.Patient_ID,'blue')}</td>
      <td><strong>${p.First_Name} ${p.Last_Name}</strong></td>
      <td>${p.Gender??'—'}</td>
      <td>${badge(p.Blood_Group,'red')}</td>
      <td>${[p.Street,p.City,p.State].filter(Boolean).join(', ')||'—'}</td>
      <td>${p.phones??'—'}</td>
      <td>${actionBtns(`editPatient(${i})`,`deletePatient(${p.Patient_ID},this)`)}</td>
    </tr>`).join('');
  } catch(e) { tbody.innerHTML=`<tr><td colspan="7" class="empty-row">${e.message}</td></tr>`; showToast(e.message,'error'); }
}

function openPatientModal(data=null) {
  const isEdit = !!data;
  document.getElementById('patientModalTitle').textContent = isEdit ? 'Edit Patient' : 'Add Patient';
  document.getElementById('patientSubmitBtn').textContent  = isEdit ? 'Update Patient' : 'Add Patient';
  document.getElementById('p_editing_id').value = isEdit ? data.Patient_ID : '';
  document.getElementById('p_id').value      = isEdit ? data.Patient_ID : '';
  document.getElementById('p_id').disabled   = isEdit;
  document.getElementById('p_fname').value   = isEdit ? data.First_Name  : '';
  document.getElementById('p_lname').value   = isEdit ? data.Last_Name   : '';
  document.getElementById('p_gender').value  = isEdit ? data.Gender      : '';
  document.getElementById('p_blood').value   = isEdit ? data.Blood_Group : '';
  document.getElementById('p_phone').value   = isEdit ? (data.phones?.split(',')[0]||'') : '';
  document.getElementById('p_street').value  = isEdit ? (data.Street||'') : '';
  document.getElementById('p_city').value    = isEdit ? (data.City||'')   : '';
  document.getElementById('p_state').value   = isEdit ? (data.State||'')  : '';
  openModal('patientModal');
}
function editPatient(i) { openPatientModal(_patients[i]); }

async function savePatient(e) {
  e.preventDefault();
  const editId = document.getElementById('p_editing_id').value;
  const body = {
    Patient_ID: document.getElementById('p_id').value,
    First_Name: document.getElementById('p_fname').value,
    Last_Name:  document.getElementById('p_lname').value,
    Gender:     document.getElementById('p_gender').value,
    Blood_Group:document.getElementById('p_blood').value,
    Street:     document.getElementById('p_street').value,
    City:       document.getElementById('p_city').value,
    State:      document.getElementById('p_state').value,
    Phone_No:   document.getElementById('p_phone').value,
  };
  try {
    await apiFetch(editId ? `/patients/${editId}` : '/patients', {
      method: editId ? 'PUT' : 'POST', body: JSON.stringify(body)
    });
    showToast(editId ? 'Patient updated!' : 'Patient added!', 'success');
    closeModal('patientModal'); loadPatients();
  } catch(err) { showToast(err.message, 'error'); }
}

async function deletePatient(id, btn) {
  if (!confirm(`Delete patient #${id}? This cannot be undone.`)) return;
  btn.disabled = true;
  try {
    await apiFetch(`/patients/${id}`, { method: 'DELETE' });
    showToast('Patient deleted.', 'success'); loadPatients();
  } catch(e) { showToast(e.message,'error'); btn.disabled=false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCTORS  (Create, Read, Update, Delete)
// ─────────────────────────────────────────────────────────────────────────────
async function loadDoctors() {
  const tbody = document.getElementById('doctorTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="loading-row"><div class="loader"></div></td></tr>';
  try {
    _doctors = await apiFetch('/doctors');
    if (!_doctors.length) { tbody.innerHTML='<tr><td colspan="8" class="empty-row">No doctors found.</td></tr>'; return; }
    tbody.innerHTML = _doctors.map((d,i) => `<tr>
      <td>${badge(d.Staff_ID,'blue')}</td>
      <td><strong>Dr. ${d.First_Name} ${d.Last_Name}</strong></td>
      <td>${d.Gender??'—'}</td>
      <td>${badge(d.Specialization,'teal')}</td>
      <td>${d.Qualification??'—'}</td>
      <td>₹${Number(d.Consultation_Fees).toLocaleString('en-IN')}</td>
      <td>${d.Dept_Name ? badge(d.Dept_Name,'purple') : '—'}</td>
      <td>${actionBtns(`editDoctor(${i})`,`deleteDoctor(${d.Staff_ID},this)`)}</td>
    </tr>`).join('');
  } catch(e) { tbody.innerHTML=`<tr><td colspan="8" class="empty-row">${e.message}</td></tr>`; showToast(e.message,'error'); }
}

async function openDoctorModal(data=null) {
  await fillDeptSelect('d_dept');
  const isEdit = !!data;
  document.getElementById('doctorModalTitle').textContent = isEdit ? 'Edit Doctor' : 'Add Doctor';
  document.getElementById('doctorSubmitBtn').textContent  = isEdit ? 'Update Doctor' : 'Add Doctor';
  document.getElementById('d_editing_id').value = isEdit ? data.Staff_ID : '';
  document.getElementById('d_id').value      = isEdit ? data.Staff_ID : ''; document.getElementById('d_id').disabled = isEdit;
  document.getElementById('d_fname').value   = isEdit ? data.First_Name  : '';
  document.getElementById('d_lname').value   = isEdit ? data.Last_Name   : '';
  document.getElementById('d_gender').value  = isEdit ? data.Gender      : '';
  document.getElementById('d_spec').value    = isEdit ? data.Specialization : '';
  document.getElementById('d_qual').value    = isEdit ? data.Qualification  : '';
  document.getElementById('d_fees').value    = isEdit ? data.Consultation_Fees : '';
  document.getElementById('d_salary').value  = isEdit ? (data.Salary||'')  : '';
  document.getElementById('d_dept').value    = isEdit ? (data.Dept_ID||'') : '';
  document.getElementById('d_street').value  = isEdit ? (data.Street||'')  : '';
  document.getElementById('d_city').value    = isEdit ? (data.City||'')    : '';
  document.getElementById('d_state').value   = isEdit ? (data.State||'')   : '';
  openModal('doctorModal');
}
function editDoctor(i) { openDoctorModal(_doctors[i]); }

async function saveDoctor(e) {
  e.preventDefault();
  const editId = document.getElementById('d_editing_id').value;
  const body = {
    Staff_ID: document.getElementById('d_id').value,
    First_Name: document.getElementById('d_fname').value,
    Last_Name:  document.getElementById('d_lname').value,
    Gender:     document.getElementById('d_gender').value,
    Specialization: document.getElementById('d_spec').value,
    Qualification:  document.getElementById('d_qual').value,
    Consultation_Fees: document.getElementById('d_fees').value,
    Salary:  document.getElementById('d_salary').value,
    Dept_ID: document.getElementById('d_dept').value,
    Street:  document.getElementById('d_street').value,
    City:    document.getElementById('d_city').value,
    State:   document.getElementById('d_state').value,
  };
  try {
    await apiFetch(editId ? `/doctors/${editId}` : '/doctors', {
      method: editId ? 'PUT' : 'POST', body: JSON.stringify(body)
    });
    showToast(editId ? 'Doctor updated!' : 'Doctor added!', 'success');
    closeModal('doctorModal'); loadDoctors();
  } catch(err) { showToast(err.message,'error'); }
}

async function deleteDoctor(id, btn) {
  if (!confirm(`Delete doctor #${id}? This will also remove their staff record.`)) return;
  btn.disabled = true;
  try { await apiFetch(`/doctors/${id}`,{method:'DELETE'}); showToast('Doctor deleted.','success'); loadDoctors(); }
  catch(e) { showToast(e.message,'error'); btn.disabled=false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// NURSES  (Create, Read, Update, Delete)
// ─────────────────────────────────────────────────────────────────────────────
async function loadNurses() {
  const tbody = document.getElementById('nurseTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="loading-row"><div class="loader"></div></td></tr>';
  try {
    _nurses = await apiFetch('/nurses');
    if (!_nurses.length) { tbody.innerHTML='<tr><td colspan="8" class="empty-row">No nurses found.</td></tr>'; return; }
    tbody.innerHTML = _nurses.map((n,i) => `<tr>
      <td>${badge(n.Staff_ID,'purple')}</td>
      <td><strong>${n.First_Name} ${n.Last_Name}</strong></td>
      <td>${n.Gender??'—'}</td>
      <td>${badge(n.Shift,'teal')}</td>
      <td>${badge(n.Grade,'orange')}</td>
      <td>${n.Dept_Name ? badge(n.Dept_Name,'blue') : '—'}</td>
      <td>₹${n.Salary ? Number(n.Salary).toLocaleString('en-IN') : '—'}</td>
      <td>${actionBtns(`editNurse(${i})`,`deleteNurse(${n.Staff_ID},this)`)}</td>
    </tr>`).join('');
  } catch(e) { tbody.innerHTML=`<tr><td colspan="8" class="empty-row">${e.message}</td></tr>`; showToast(e.message,'error'); }
}

async function openNurseModal(data=null) {
  await fillDeptSelect('n_dept');
  const isEdit = !!data;
  document.getElementById('nurseModalTitle').textContent = isEdit ? 'Edit Nurse' : 'Add Nurse';
  document.getElementById('nurseSubmitBtn').textContent  = isEdit ? 'Update Nurse' : 'Add Nurse';
  document.getElementById('n_editing_id').value = isEdit ? data.Staff_ID : '';
  document.getElementById('n_id').value      = isEdit ? data.Staff_ID  : ''; document.getElementById('n_id').disabled = isEdit;
  document.getElementById('n_fname').value   = isEdit ? data.First_Name : '';
  document.getElementById('n_lname').value   = isEdit ? data.Last_Name  : '';
  document.getElementById('n_gender').value  = isEdit ? data.Gender     : '';
  document.getElementById('n_shift').value   = isEdit ? data.Shift      : '';
  document.getElementById('n_grade').value   = isEdit ? data.Grade      : '';
  document.getElementById('n_salary').value  = isEdit ? (data.Salary||'')  : '';
  document.getElementById('n_dept').value    = isEdit ? (data.Dept_ID||'') : '';
  document.getElementById('n_city').value    = isEdit ? (data.City||'')    : '';
  document.getElementById('n_state').value   = isEdit ? (data.State||'')   : '';
  openModal('nurseModal');
}
function editNurse(i) { openNurseModal(_nurses[i]); }

async function saveNurse(e) {
  e.preventDefault();
  const editId = document.getElementById('n_editing_id').value;
  const body = {
    Staff_ID:   document.getElementById('n_id').value,
    First_Name: document.getElementById('n_fname').value,
    Last_Name:  document.getElementById('n_lname').value,
    Gender:     document.getElementById('n_gender').value,
    Shift:      document.getElementById('n_shift').value,
    Grade:      document.getElementById('n_grade').value,
    Salary:     document.getElementById('n_salary').value,
    Dept_ID:    document.getElementById('n_dept').value,
    City:       document.getElementById('n_city').value,
    State:      document.getElementById('n_state').value,
  };
  try {
    await apiFetch(editId ? `/nurses/${editId}` : '/nurses', {
      method: editId ? 'PUT' : 'POST', body: JSON.stringify(body)
    });
    showToast(editId ? 'Nurse updated!' : 'Nurse added!', 'success');
    closeModal('nurseModal'); loadNurses();
  } catch(err) { showToast(err.message,'error'); }
}

async function deleteNurse(id, btn) {
  if (!confirm(`Delete nurse #${id}?`)) return;
  btn.disabled = true;
  try { await apiFetch(`/nurses/${id}`,{method:'DELETE'}); showToast('Nurse deleted.','success'); loadNurses(); }
  catch(e) { showToast(e.message,'error'); btn.disabled=false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF  (Read, Update, Delete)
// ─────────────────────────────────────────────────────────────────────────────
async function loadStaff() {
  const tbody = document.getElementById('staffTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="loading-row"><div class="loader"></div></td></tr>';
  try {
    _staff = await apiFetch('/staff');
    if (!_staff.length) { tbody.innerHTML='<tr><td colspan="8" class="empty-row">No staff found.</td></tr>'; return; }
    tbody.innerHTML = _staff.map((s,i) => `<tr>
      <td>${badge(s.Staff_ID,'blue')}</td>
      <td><strong>${s.First_Name} ${s.Last_Name}</strong></td>
      <td>${s.Gender??'—'}</td>
      <td>${roleBadge(s.Role)}</td>
      <td>${s.Dept_Name ? badge(s.Dept_Name,'purple') : '—'}</td>
      <td>₹${s.Salary ? Number(s.Salary).toLocaleString('en-IN') : '—'}</td>
      <td>${s.City??'—'}</td>
      <td>${actionBtns(`editStaff(${i})`,`deleteStaff(${s.Staff_ID},this)`)}</td>
    </tr>`).join('');
  } catch(e) { tbody.innerHTML=`<tr><td colspan="8" class="empty-row">${e.message}</td></tr>`; showToast(e.message,'error'); }
}

async function editStaff(i) {
  const s = _staff[i];
  await fillDeptSelect('st_dept');
  document.getElementById('st_editing_id').value = s.Staff_ID;
  document.getElementById('st_fname').value  = s.First_Name||'';
  document.getElementById('st_lname').value  = s.Last_Name||'';
  document.getElementById('st_gender').value = s.Gender||'';
  document.getElementById('st_salary').value = s.Salary||'';
  document.getElementById('st_dept').value   = s.Dept_ID||'';
  document.getElementById('st_street').value = s.Street||'';
  document.getElementById('st_city').value   = s.City||'';
  document.getElementById('st_state').value  = s.State||'';
  openModal('staffModal');
}

async function saveStaff(e) {
  e.preventDefault();
  const editId = document.getElementById('st_editing_id').value;
  const body = {
    First_Name: document.getElementById('st_fname').value,
    Last_Name:  document.getElementById('st_lname').value,
    Gender:     document.getElementById('st_gender').value,
    Salary:     document.getElementById('st_salary').value,
    Dept_ID:    document.getElementById('st_dept').value,
    Street:     document.getElementById('st_street').value,
    City:       document.getElementById('st_city').value,
    State:      document.getElementById('st_state').value,
  };
  try {
    await apiFetch(`/staff/${editId}`, { method:'PUT', body:JSON.stringify(body) });
    showToast('Staff updated!','success'); closeModal('staffModal'); loadStaff();
  } catch(err) { showToast(err.message,'error'); }
}

async function deleteStaff(id, btn) {
  if (!confirm(`Delete staff #${id}? This will also remove them from Doctor/Nurse/Admin records.`)) return;
  btn.disabled = true;
  try { await apiFetch(`/staff/${id}`,{method:'DELETE'}); showToast('Staff deleted.','success'); loadStaff(); }
  catch(e) { showToast(e.message,'error'); btn.disabled=false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// APPOINTMENTS  (Create, Read, Update, Delete)
// ─────────────────────────────────────────────────────────────────────────────
async function loadAppointments() {
  const tbody = document.getElementById('apptTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-row"><div class="loader"></div></td></tr>';
  try {
    _appointments = await apiFetch('/appointments');
    if (!_appointments.length) { tbody.innerHTML='<tr><td colspan="7" class="empty-row">No appointments found.</td></tr>'; return; }
    tbody.innerHTML = _appointments.map((a,i) => `<tr>
      <td>${badge(a.Appointment_ID,'blue')}</td>
      <td>${fmt(a.Date)}</td>
      <td>${a.Time??'—'}</td>
      <td><strong>${a.Patient_Name}</strong></td>
      <td><strong>Dr. ${a.Doctor_Name}</strong></td>
      <td>${badge(a.Specialization,'teal')}</td>
      <td>${actionBtns(`editAppt(${i})`,`deleteAppt(${a.Appointment_ID},this)`)}</td>
    </tr>`).join('');
  } catch(e) { tbody.innerHTML=`<tr><td colspan="7" class="empty-row">${e.message}</td></tr>`; showToast(e.message,'error'); }
}

async function openApptModal(data=null) {
  try {
    const [patients, doctors] = await Promise.all([apiFetch('/patients'), apiFetch('/doctors')]);
    const ps = document.getElementById('a_patient');
    ps.innerHTML = '<option value="">Select Patient</option>' +
      patients.map(p => `<option value="${p.Patient_ID}">${p.First_Name} ${p.Last_Name} (#${p.Patient_ID})</option>`).join('');
    const ds = document.getElementById('a_doctor');
    ds.innerHTML = '<option value="">Select Doctor</option>' +
      doctors.map(d => `<option value="${d.Staff_ID}">Dr. ${d.First_Name} ${d.Last_Name} — ${d.Specialization}</option>`).join('');
  } catch(e) { showToast('Could not load dropdowns: '+e.message,'error'); }
  const isEdit = !!data;
  document.getElementById('apptModalTitle').textContent = isEdit ? 'Edit Appointment' : 'Book Appointment';
  document.getElementById('apptSubmitBtn').textContent  = isEdit ? 'Update Appointment' : 'Book Appointment';
  document.getElementById('a_editing_id').value = isEdit ? data.Appointment_ID : '';
  document.getElementById('a_id').value       = isEdit ? data.Appointment_ID : ''; document.getElementById('a_id').disabled = isEdit;
  document.getElementById('a_date').value     = isEdit ? (data.Date?.split('T')[0]||'') : '';
  document.getElementById('a_time').value     = isEdit ? (data.Time||'') : '';
  document.getElementById('a_patient').value  = isEdit ? data.Patient_ID : '';
  document.getElementById('a_doctor').value   = isEdit ? data.Staff_ID  : '';
  openModal('apptModal');
}
function editAppt(i) { openApptModal(_appointments[i]); }

async function saveAppt(e) {
  e.preventDefault();
  const editId = document.getElementById('a_editing_id').value;
  const body = {
    Appointment_ID: document.getElementById('a_id').value,
    Date:       document.getElementById('a_date').value,
    Time:       document.getElementById('a_time').value,
    Patient_ID: document.getElementById('a_patient').value,
    Staff_ID:   document.getElementById('a_doctor').value,
  };
  try {
    await apiFetch(editId ? `/appointments/${editId}` : '/appointments', {
      method: editId ? 'PUT' : 'POST', body: JSON.stringify(body)
    });
    showToast(editId ? 'Appointment updated!' : 'Appointment booked!', 'success');
    closeModal('apptModal'); loadAppointments();
  } catch(err) { showToast(err.message,'error'); }
}

async function deleteAppt(id, btn) {
  if (!confirm(`Delete appointment #${id}?`)) return;
  btn.disabled = true;
  try { await apiFetch(`/appointments/${id}`,{method:'DELETE'}); showToast('Appointment deleted.','success'); loadAppointments(); }
  catch(e) { showToast(e.message,'error'); btn.disabled=false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMISSIONS  (Create, Read, Update, Delete)
// ─────────────────────────────────────────────────────────────────────────────
async function loadAdmissions() {
  const tbody = document.getElementById('admTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="loading-row"><div class="loader"></div></td></tr>';
  try {
    _admissions = await apiFetch('/admissions');
    if (!_admissions.length) { tbody.innerHTML='<tr><td colspan="8" class="empty-row">No admissions found.</td></tr>'; return; }
    tbody.innerHTML = _admissions.map((a,i) => `<tr>
      <td>${badge(a.Admission_ID,'blue')}</td>
      <td><strong>${a.Patient_Name}</strong></td>
      <td>${badge(a.Room_ID,'gray')}</td>
      <td>${badge(a.Room_Type,'purple')}</td>
      <td>${fmt(a.Admit_Date)}</td>
      <td>${a.Discharge_Date ? fmt(a.Discharge_Date) : badge('Active','green')}</td>
      <td>Dr. ${a.Doctor_Name}</td>
      <td>${actionBtns(`editAdmission(${i})`,`deleteAdmission(${a.Admission_ID},this)`)}</td>
    </tr>`).join('');
  } catch(e) { tbody.innerHTML=`<tr><td colspan="8" class="empty-row">${e.message}</td></tr>`; showToast(e.message,'error'); }
}

async function openAdmissionModal(data=null) {
  try {
    const [patients, doctors, rooms] = await Promise.all([
      apiFetch('/patients'), apiFetch('/doctors'), apiFetch('/rooms')
    ]);
    document.getElementById('ad_patient').innerHTML = '<option value="">Select Patient</option>' +
      patients.map(p=>`<option value="${p.Patient_ID}">${p.First_Name} ${p.Last_Name}</option>`).join('');
    document.getElementById('ad_doctor').innerHTML = '<option value="">Select Doctor</option>' +
      doctors.map(d=>`<option value="${d.Staff_ID}">Dr. ${d.First_Name} ${d.Last_Name}</option>`).join('');
    document.getElementById('ad_room').innerHTML = '<option value="">Select Room</option>' +
      rooms.map(r=>`<option value="${r.Room_ID}">${r.Room_ID} — ${r.Room_Type} (${r.Status})</option>`).join('');
  } catch(e) { showToast('Could not load dropdowns: '+e.message,'error'); }
  const isEdit = !!data;
  document.getElementById('admissionModalTitle').textContent = isEdit ? 'Edit Admission' : 'Add Admission';
  document.getElementById('admissionSubmitBtn').textContent  = isEdit ? 'Update Admission' : 'Add Admission';
  document.getElementById('ad_editing_id').value  = isEdit ? data.Admission_ID : '';
  document.getElementById('ad_id').value          = isEdit ? data.Admission_ID : ''; document.getElementById('ad_id').disabled = isEdit;
  document.getElementById('ad_admit').value       = isEdit ? (data.Admit_Date?.split('T')[0]||'') : '';
  document.getElementById('ad_discharge').value   = isEdit ? (data.Discharge_Date?.split('T')[0]||'') : '';
  document.getElementById('ad_patient').value     = isEdit ? data.Patient_ID : '';
  document.getElementById('ad_room').value        = isEdit ? data.Room_ID    : '';
  document.getElementById('ad_doctor').value      = isEdit ? data.Staff_ID   : '';
  openModal('admissionModal');
}
function editAdmission(i) { openAdmissionModal(_admissions[i]); }

async function saveAdmission(e) {
  e.preventDefault();
  const editId = document.getElementById('ad_editing_id').value;
  const body = {
    Admission_ID:   document.getElementById('ad_id').value,
    Admit_Date:     document.getElementById('ad_admit').value,
    Discharge_Date: document.getElementById('ad_discharge').value,
    Patient_ID:     document.getElementById('ad_patient').value,
    Room_ID:        document.getElementById('ad_room').value,
    Staff_ID:       document.getElementById('ad_doctor').value,
  };
  try {
    await apiFetch(editId ? `/admissions/${editId}` : '/admissions', {
      method: editId ? 'PUT' : 'POST', body: JSON.stringify(body)
    });
    showToast(editId ? 'Admission updated!' : 'Admission added!', 'success');
    closeModal('admissionModal'); loadAdmissions();
  } catch(err) { showToast(err.message,'error'); }
}

async function deleteAdmission(id, btn) {
  if (!confirm(`Delete admission #${id}?`)) return;
  btn.disabled = true;
  try { await apiFetch(`/admissions/${id}`,{method:'DELETE'}); showToast('Admission deleted.','success'); loadAdmissions(); }
  catch(e) { showToast(e.message,'error'); btn.disabled=false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOMS  (Create, Read, Update, Delete)
// ─────────────────────────────────────────────────────────────────────────────
async function loadRooms() {
  const tbody = document.getElementById('roomTableBody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading-row"><div class="loader"></div></td></tr>';
  try {
    allRooms = _rooms = await apiFetch('/rooms');
    renderRooms(allRooms);
  } catch(e) { tbody.innerHTML=`<tr><td colspan="5" class="empty-row">${e.message}</td></tr>`; showToast(e.message,'error'); }
}

function renderRooms(data) {
  const tbody = document.getElementById('roomTableBody');
  if (!data.length) { tbody.innerHTML='<tr><td colspan="5" class="empty-row">No rooms found.</td></tr>'; return; }
  tbody.innerHTML = data.map((r,i) => `<tr>
    <td>${badge(r.Room_ID,'blue')}</td>
    <td>${badge(r.Room_Type,'purple')}</td>
    <td>₹${Number(r.Charges_Per_Day).toLocaleString('en-IN')}</td>
    <td>${statusBadge(r.Status)}</td>
    <td>${actionBtns(`editRoom(${_rooms.indexOf(r)})`,`deleteRoom(${r.Room_ID},this)`)}</td>
  </tr>`).join('');
}

function filterRooms(status, btn) {
  document.querySelectorAll('.filter-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  renderRooms(status==='all' ? allRooms : allRooms.filter(r=>r.Status===status));
}

function openRoomModal(data=null) {
  const isEdit = !!data;
  document.getElementById('roomModalTitle').textContent = isEdit ? 'Edit Room' : 'Add Room';
  document.getElementById('roomSubmitBtn').textContent  = isEdit ? 'Update Room' : 'Add Room';
  document.getElementById('r_editing_id').value = isEdit ? data.Room_ID : '';
  document.getElementById('r_id').value      = isEdit ? data.Room_ID : ''; document.getElementById('r_id').disabled = isEdit;
  document.getElementById('r_type').value    = isEdit ? data.Room_Type : '';
  document.getElementById('r_charges').value = isEdit ? data.Charges_Per_Day : '';
  document.getElementById('r_status').value  = isEdit ? data.Status : '';
  openModal('roomModal');
}
function editRoom(i) { openRoomModal(_rooms[i]); }

async function saveRoom(e) {
  e.preventDefault();
  const editId = document.getElementById('r_editing_id').value;
  const body = {
    Room_ID: document.getElementById('r_id').value,
    Room_Type: document.getElementById('r_type').value,
    Charges_Per_Day: document.getElementById('r_charges').value,
    Status: document.getElementById('r_status').value,
  };
  try {
    await apiFetch(editId ? `/rooms/${editId}` : '/rooms', {
      method: editId ? 'PUT' : 'POST', body: JSON.stringify(body)
    });
    showToast(editId ? 'Room updated!' : 'Room added!', 'success');
    closeModal('roomModal'); loadRooms();
  } catch(err) { showToast(err.message,'error'); }
}

async function deleteRoom(id, btn) {
  if (!confirm(`Delete room #${id}?`)) return;
  btn.disabled = true;
  try { await apiFetch(`/rooms/${id}`,{method:'DELETE'}); showToast('Room deleted.','success'); loadRooms(); }
  catch(e) { showToast(e.message,'error'); btn.disabled=false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTMENTS  (Create, Read, Update, Delete)
// ─────────────────────────────────────────────────────────────────────────────
async function loadDepartments() {
  const tbody = document.getElementById('deptTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-row"><div class="loader"></div></td></tr>';
  try {
    _departments = await apiFetch('/departments');
    if (!_departments.length) { tbody.innerHTML='<tr><td colspan="6" class="empty-row">No departments found.</td></tr>'; return; }
    tbody.innerHTML = _departments.map((d,i) => `<tr>
      <td>${badge(d.Dept_ID,'blue')}</td>
      <td><strong>${d.Dept_Name}</strong></td>
      <td>${d.Location??'—'}</td>
      <td>${d.Hospital_Name ? badge(d.Hospital_Name,'teal') : '—'}</td>
      <td>${badge(d.Staff_Count,'green')}</td>
      <td>${actionBtns(`editDept(${i})`,`deleteDept(${d.Dept_ID},this)`)}</td>
    </tr>`).join('');
  } catch(e) { tbody.innerHTML=`<tr><td colspan="6" class="empty-row">${e.message}</td></tr>`; showToast(e.message,'error'); }
}

function openDeptModal(data=null) {
  const isEdit = !!data;
  document.getElementById('deptModalTitle').textContent = isEdit ? 'Edit Department' : 'Add Department';
  document.getElementById('deptSubmitBtn').textContent  = isEdit ? 'Update Department' : 'Add Department';
  document.getElementById('dept_editing_id').value = isEdit ? data.Dept_ID : '';
  document.getElementById('dept_id').value       = isEdit ? data.Dept_ID   : ''; document.getElementById('dept_id').disabled = isEdit;
  document.getElementById('dept_name').value     = isEdit ? data.Dept_Name : '';
  document.getElementById('dept_location').value = isEdit ? (data.Location||'') : '';
  document.getElementById('dept_hospital').value = isEdit ? (data.Hospital_ID||'') : '';
  openModal('deptModal');
}
function editDept(i) { openDeptModal(_departments[i]); }

async function saveDept(e) {
  e.preventDefault();
  const editId = document.getElementById('dept_editing_id').value;
  const body = {
    Dept_ID:     document.getElementById('dept_id').value,
    Dept_Name:   document.getElementById('dept_name').value,
    Location:    document.getElementById('dept_location').value,
    Hospital_ID: document.getElementById('dept_hospital').value,
  };
  try {
    await apiFetch(editId ? `/departments/${editId}` : '/departments', {
      method: editId ? 'PUT' : 'POST', body: JSON.stringify(body)
    });
    showToast(editId ? 'Department updated!' : 'Department added!', 'success');
    closeModal('deptModal'); loadDepartments();
  } catch(err) { showToast(err.message,'error'); }
}

async function deleteDept(id, btn) {
  if (!confirm(`Delete department #${id}?`)) return;
  btn.disabled = true;
  try { await apiFetch(`/departments/${id}`,{method:'DELETE'}); showToast('Department deleted.','success'); loadDepartments(); }
  catch(e) { showToast(e.message,'error'); btn.disabled=false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPER — fill department select dropdowns
// ─────────────────────────────────────────────────────────────────────────────
async function fillDeptSelect(selectId) {
  try {
    const depts = await apiFetch('/departments');
    document.getElementById(selectId).innerHTML =
      '<option value="">None</option>' +
      depts.map(d=>`<option value="${d.Dept_ID}">${d.Dept_Name}</option>`).join('');
  } catch(e) { /* silently fail */ }
}
