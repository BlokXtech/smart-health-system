const statusMessage = document.getElementById('statusMessage');
const appointmentList = document.getElementById('appointmentList');
const liveClock = document.getElementById('liveClock');
const welcomeLabel = document.getElementById('welcomeLabel');
const authSection = document.getElementById('authSection');
const dashboardView = document.getElementById('dashboardView');
const appointmentPanel = document.getElementById('appointmentPanel');
const appointmentListPanel = document.getElementById('appointmentListPanel');
const rolePanel = document.getElementById('rolePanel');
const sharedHubPanel = document.getElementById('sharedHubPanel');
const receptionistDashboard = document.getElementById('receptionistDashboard');
const nurseDashboard = document.getElementById('nurseDashboard');
const doctorDashboard = document.getElementById('doctorDashboard');
const dentistDashboard = document.getElementById('dentistDashboard');
const profilePanel = document.getElementById('profilePanel');
const roleTitle = document.getElementById('roleTitle');
const roleSummary = document.getElementById('roleSummary');
const roleTasks = document.getElementById('roleTasks');
const taskStatus = document.getElementById('taskStatus');
const adminDirectoryList = document.getElementById('adminDirectoryList');

const state = {
  currentUser: JSON.parse(localStorage.getItem('healthUser') || 'null'),
};

function setStatus(message, isError = false) {
  const target = statusMessage || taskStatus;
  if (!target) return;
  target.textContent = message;
  target.style.color = isError ? '#fca5a5' : '#bffcf7';
}

function updateClock() {
  if (!liveClock) return;
  const now = new Date();
  liveClock.textContent = now.toLocaleTimeString();
}

function renderRoleView(user) {
  if (!roleTitle || !roleSummary || !roleTasks) return;
  const role = (user && user.role) || 'receptionist';
  const config = {
    receptionist: {
      title: 'Receptionist dashboard',
      summary: 'Front desk tools for intake, scheduling, check-ins, patient registration, and no-show management.',
      tasks: ['Check-in patients', 'Confirm appointment slots', 'Register new patients'],
    },
    doctor: {
      title: 'Doctor dashboard',
      summary: 'Clinical decision workspace for charts, diagnostics, SOAP notes, prescriptions, and risk insights.',
      tasks: ['Review patient charts', 'Approve follow-up visits', 'Monitor lab trends'],
    },
    dentist: {
      title: 'Dentist dashboard',
      summary: 'Procedure-focused workspace for visual dental charts, X-ray review, tooth planning, and follow-up alerts.',
      tasks: ['Review dental plans', 'Manage treatment calendars', 'Track recall visits'],
    },
    nurse: {
      title: 'Nurse dashboard',
      summary: 'Clinical support workspace for vitals, medications, treatment checklists, allergy alerts, and patient follow-up.',
      tasks: ['Update care notes', 'Record vitals', 'Coordinate with doctors'],
    },
    admin: {
      title: 'Administrator dashboard',
      summary: 'Operations view for analytics, staff oversight, access control, and system monitoring.',
      tasks: ['Review analytics', 'Manage staff access', 'Monitor appointments'],
    },
  };

  const current = config[role] || config.receptionist;
  roleTitle.textContent = current.title;
  roleSummary.textContent = current.summary;
  roleTasks.innerHTML = current.tasks.map((item) => `<button type="button" class="pill task-pill" data-task="${item}">${item}</button>`).join('');
}

function handleTaskClick(event) {
  const target = event.target.closest('.task-pill');
  if (!target) return;
  const task = target.dataset.task;
  setStatus(`Selected: ${task}`);
}

function renderApp() {
  if (state.currentUser) {
    if (authSection) authSection.classList.add('hidden');
    if (dashboardView) dashboardView.classList.remove('hidden');
    if (appointmentPanel) appointmentPanel.classList.toggle('hidden', (state.currentUser.role || '').toLowerCase() !== 'receptionist');
    if (appointmentListPanel) appointmentListPanel.classList.remove('hidden');
    if (rolePanel) rolePanel.classList.remove('hidden');
    if (sharedHubPanel) sharedHubPanel.classList.remove('hidden');
    if (profilePanel) profilePanel.classList.remove('hidden');

    const selectedRole = (state.currentUser.role || '').toLowerCase();
    if (receptionistDashboard) receptionistDashboard.classList.toggle('hidden', selectedRole !== 'receptionist');
    if (nurseDashboard) nurseDashboard.classList.toggle('hidden', selectedRole !== 'nurse');
    if (doctorDashboard) doctorDashboard.classList.toggle('hidden', selectedRole !== 'doctor');
    if (dentistDashboard) dentistDashboard.classList.toggle('hidden', selectedRole !== 'dentist');
    renderRoleView(state.currentUser);
    if (welcomeLabel) welcomeLabel.textContent = `Welcome, ${state.currentUser.name || state.currentUser.workId}`;
    if (document.getElementById('profileName')) document.getElementById('profileName').value = state.currentUser.name || '';
    if (document.getElementById('profileEmail')) document.getElementById('profileEmail').value = state.currentUser.email || '';
    if (document.getElementById('profileRole')) document.getElementById('profileRole').value = state.currentUser.role || 'receptionist';
    if (document.getElementById('profileStreetAddress')) document.getElementById('profileStreetAddress').value = state.currentUser.streetAddress || state.currentUser.street_address || '';
    if (document.getElementById('profileCity')) document.getElementById('profileCity').value = state.currentUser.city || '';
    if (document.getElementById('profileContactNumber')) document.getElementById('profileContactNumber').value = state.currentUser.contactNumber || state.currentUser.contact_number || '';
    if (document.getElementById('adminDirectoryPanel')) document.getElementById('adminDirectoryPanel').classList.toggle('hidden', (state.currentUser.role || '').toLowerCase() !== 'admin');
    if ((state.currentUser.role || '').toLowerCase() === 'admin') loadAdminDirectory();
  } else {
    if (authSection) authSection.classList.remove('hidden');
    if (dashboardView) dashboardView.classList.add('hidden');
    if (appointmentPanel) appointmentPanel.classList.add('hidden');
    if (appointmentListPanel) appointmentListPanel.classList.add('hidden');
    if (rolePanel) rolePanel.classList.add('hidden');
    if (sharedHubPanel) sharedHubPanel.classList.add('hidden');
    if (profilePanel) profilePanel.classList.add('hidden');
    if (receptionistDashboard) receptionistDashboard.classList.add('hidden');
    if (nurseDashboard) nurseDashboard.classList.add('hidden');
    if (doctorDashboard) doctorDashboard.classList.add('hidden');
    if (dentistDashboard) dentistDashboard.classList.add('hidden');
    if (welcomeLabel) welcomeLabel.textContent = 'Please sign in to continue';
  }
}

async function loadAnalytics() {
  if (!document.getElementById('patientsCount')) return;
  const response = await fetch('/api/analytics');
  const data = await response.json();

  document.getElementById('patientsCount').textContent = data.patients || 0;
  document.getElementById('appointmentsCount').textContent = data.appointments || 0;
  document.getElementById('pendingCount').textContent = data.pending || 0;
  document.getElementById('completionRate').textContent = `${data.completionRate || 0}%`;
}

async function loadAdminDirectory() {
  if (!adminDirectoryList) return;
  const response = await fetch('/api/users');
  const users = await response.json();
  adminDirectoryList.innerHTML = '';

  users.forEach((user) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${user.name || user.workId}</strong> · ${user.role || 'staff'}<br/>${user.email || 'No email'}<br/>${user.streetAddress || 'No street address'}, ${user.city || 'No city'} · ${user.contactNumber || 'No contact number'}`;
    adminDirectoryList.appendChild(li);
  });
}

async function loadAppointments() {
  if (!appointmentList) return;
  const response = await fetch('/api/appointments');
  const appointments = await response.json();
  appointmentList.innerHTML = '';

  const role = (state.currentUser && state.currentUser.role || '').toLowerCase();

  appointments.forEach((item) => {
    const li = document.createElement('li');
    const actions = role === 'receptionist'
      ? ''
      : (item.status === 'Pending'
          ? `<button class="ghost-btn full-width mt-10" type="button" data-accept-id="${item.id}">Accept appointment</button>`
          : '<span class="pill">Accepted</span>');

    li.innerHTML = `<strong>${item.patient}</strong> with ${item.doctor}<br/>${item.date} at ${item.time} · ${item.status}${actions ? `<br/>${actions}` : ''}`;
    appointmentList.appendChild(li);
  });

  appointmentList.querySelectorAll('[data-accept-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-accept-id');
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Confirmed' }),
      });
      const result = await response.json();
      if (!response.ok) {
        setStatus(result.error || 'Unable to accept appointment.', true);
        return;
      }
      setStatus('Appointment accepted successfully.');
      loadAppointments();
    });
  });
}

async function createAppointment(event) {
  event.preventDefault();
  if (!state.currentUser || (state.currentUser.role || '').toLowerCase() !== 'receptionist') {
    setStatus('Only receptionists can create appointments.', true);
    return;
  }

  const payload = {
    patient: document.getElementById('patientName').value,
    doctor: document.getElementById('doctorName').value,
    date: document.getElementById('appointmentDate').value,
    time: document.getElementById('appointmentTime').value,
  };

  const response = await fetch('/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    setStatus(result.error || 'Unable to create appointment.', true);
    return;
  }

  setStatus('Appointment added successfully.');
  document.getElementById('appointmentForm').reset();
  loadAppointments();
  loadAnalytics();
}

async function login(event) {
  event.preventDefault();
  const payload = {
    workId: document.getElementById('loginWorkId').value.trim(),
    password: document.getElementById('loginPassword').value,
  };

  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    setStatus(result.error || 'Login failed.', true);
    return;
  }

  state.currentUser = { ...result.user, role: result.user.role || 'receptionist' };
  localStorage.setItem('healthUser', JSON.stringify(state.currentUser));
  setStatus(`Welcome ${result.user.name || result.user.workId}.`);
  window.location.href = '/index.html';
}

async function register(event) {
  event.preventDefault();
  const payload = {
    name: document.getElementById('registerName').value,
    email: document.getElementById('registerEmail').value,
    password: document.getElementById('registerPassword').value,
    role: document.getElementById('registerRole').value,
    streetAddress: document.getElementById('registerStreetAddress').value.trim(),
    city: document.getElementById('registerCity').value.trim(),
    contactNumber: document.getElementById('registerContactNumber').value.trim(),
  };

  const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    setStatus(result.error || 'Registration failed.', true);
    return;
  }

  state.currentUser = { ...result.user, role: result.user.role || document.getElementById('registerRole').value };
  localStorage.setItem('healthUser', JSON.stringify(state.currentUser));
  setStatus(result.message || 'Registration successful.');
  document.getElementById('registerForm').reset();
  window.location.href = '/index.html';
}

async function saveProfile(event) {
  event.preventDefault();
  if (!state.currentUser) return;

  try {
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: state.currentUser.id,
        workId: state.currentUser.workId || state.currentUser.work_id,
        name: document.getElementById('profileName').value.trim(),
        email: document.getElementById('profileEmail').value.trim(),
        role: document.getElementById('profileRole').value,
        streetAddress: document.getElementById('profileStreetAddress').value.trim(),
        city: document.getElementById('profileCity').value.trim(),
        contactNumber: document.getElementById('profileContactNumber').value.trim(),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to update profile.');

    state.currentUser = { ...state.currentUser, ...result.user };
    localStorage.setItem('healthUser', JSON.stringify(state.currentUser));
    renderApp();
    setStatus('Profile updated successfully.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function recover(event) {
  event.preventDefault();
  const workId = document.getElementById('recoveryWorkId').value.trim();
  const response = await fetch('/api/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workId }),
  });
  const result = await response.json();
  setStatus(result.message || 'Work ID lookup completed.', !response.ok);
}

updateClock();
setInterval(updateClock, 1000);
renderApp();
loadAnalytics();
loadAppointments();

const registerBox = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegisterLink');
if (showRegisterLink && registerBox) {
  showRegisterLink.addEventListener('click', (event) => {
    event.preventDefault();
    registerBox.classList.toggle('hidden');
    showRegisterLink.textContent = registerBox.classList.contains('hidden') ? 'Create one here' : 'Hide registration';
  });
}

if (document.getElementById('roleTasks')) document.getElementById('roleTasks').addEventListener('click', handleTaskClick);
if (document.getElementById('appointmentForm')) document.getElementById('appointmentForm').addEventListener('submit', createAppointment);
if (document.getElementById('loginForm')) document.getElementById('loginForm').addEventListener('submit', login);
if (document.getElementById('registerForm')) document.getElementById('registerForm').addEventListener('submit', register);
if (document.getElementById('recoveryForm')) document.getElementById('recoveryForm').addEventListener('submit', recover);
if (document.getElementById('profileForm')) document.getElementById('profileForm').addEventListener('submit', saveProfile);
