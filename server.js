const express = require('express');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const rawDatabaseUrl = process.env.DATABASE_URL || '';
const hasRealDatabaseUrl = rawDatabaseUrl.trim().length > 0 && !/username:password/i.test(rawDatabaseUrl);
const pool = hasRealDatabaseUrl
  ? new Pool({ connectionString: rawDatabaseUrl })
  : null;

const fallbackUsers = [];
const fallbackAppointments = [
  { id: 1, patient: 'Ava Johnson', doctor: 'Dr. Patel', date: '2026-06-03', time: '09:30', status: 'Confirmed' },
  { id: 2, patient: 'Liam Chen', doctor: 'Dr. Rivera', date: '2026-06-03', time: '11:15', status: 'Pending' },
];

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function rolePrefix(role = 'receptionist') {
  const map = {
    receptionist: 'REC',
    doctor: 'DOC',
    dentist: 'DEN',
    nurse: 'NUR',
    admin: 'ADM',
  };
  return map[String(role).toLowerCase()] || 'EMP';
}

async function generateWorkId(role = 'receptionist') {
  const prefix = rolePrefix(role);
  try {
    if (pool) {
      const result = await queryDb('SELECT COUNT(*)::int AS count FROM users WHERE role = $1', [role]);
      return `${prefix}-${String((result.rows[0]?.count || 0) + 1).padStart(3, '0')}`;
    }
  } catch (error) {
    // fall through to in-memory count
  }

  const count = fallbackUsers.filter((item) => (item.role || 'receptionist') === role).length + 1;
  return `${prefix}-${String(count).padStart(3, '0')}`;
}

async function queryDb(text, params = []) {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured');
  }
  return pool.query(text, params);
}

async function initDb() {
  if (!pool) {
    console.warn('PostgreSQL not configured or using sample credentials. Falling back to in-memory demo data.');
    return;
  }

  try {
    await queryDb(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        work_id TEXT UNIQUE,
        recovery_email TEXT,
        role TEXT DEFAULT 'receptionist',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await queryDb('ALTER TABLE users ADD COLUMN IF NOT EXISTS work_id TEXT UNIQUE;');
    await queryDb('ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_email TEXT;');
    await queryDb('ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT \'receptionist\';');
    await queryDb('ALTER TABLE users ADD COLUMN IF NOT EXISTS street_address TEXT;');
    await queryDb('ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;');
    await queryDb('ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_number TEXT;');

    await queryDb(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        patient TEXT NOT NULL,
        doctor TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT DEFAULT 'Pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('PostgreSQL schema ready.');
  } catch (error) {
    console.warn('PostgreSQL connection unavailable. Using fallback demo data.', error.message);
  }
}

async function getAnalytics() {
  try {
    const usersResult = await queryDb('SELECT COUNT(*)::int AS count FROM users');
    const appointmentsResult = await queryDb('SELECT COUNT(*)::int AS count FROM appointments');
    const pendingResult = await queryDb("SELECT COUNT(*)::int AS count FROM appointments WHERE status = 'Pending'");

    return {
      patients: usersResult.rows[0].count || 0,
      appointments: appointmentsResult.rows[0].count || 0,
      pending: pendingResult.rows[0].count || 0,
      completionRate: Math.max(0, 100 - (pendingResult.rows[0].count || 0) * 10),
    };
  } catch (error) {
    return {
      patients: fallbackUsers.length,
      appointments: fallbackAppointments.length,
      pending: fallbackAppointments.filter((item) => item.status === 'Pending').length,
      completionRate: 86,
    };
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: pool ? 'postgresql' : 'demo-fallback' });
});

app.post('/api/register', async (req, res) => {
  const { name, email, password, recoveryEmail, role = 'receptionist', streetAddress = '', city = '', contactNumber = '' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    const hashed = hashPassword(password);
    const workId = await generateWorkId(role);

    if (pool) {
      const result = await queryDb(
        'INSERT INTO users (name, email, password, work_id, recovery_email, role, street_address, city, contact_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, email, work_id, recovery_email, role, street_address, city, contact_number',
        [name, email, hashed, workId, recoveryEmail || email, role, streetAddress, city, contactNumber]
      );
      return res.status(201).json({ user: { ...result.rows[0], workId: result.rows[0].work_id, recoveryEmail: result.rows[0].recovery_email, role: result.rows[0].role || role }, message: 'Registration successful. Your work ID is ' + workId + '.' });
    }

    const existing = fallbackUsers.find((item) => item.email === email);
    if (existing) return res.status(409).json({ error: 'User already exists.' });

    const user = { id: fallbackUsers.length + 1, name, email, password: hashed, work_id: workId, recovery_email: recoveryEmail || email, role, street_address: streetAddress, city, contact_number: contactNumber };
    fallbackUsers.push(user);
    return res.status(201).json({ user: { id: user.id, name, email, workId: user.work_id, recoveryEmail: user.recovery_email, role, streetAddress: user.street_address, city: user.city, contactNumber: user.contact_number }, message: 'Registration successful. Your work ID is ' + workId + '.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { workId, password } = req.body;
  const hashed = hashPassword(password);

  try {
    if (pool) {
      const result = await queryDb('SELECT id, name, email, work_id, recovery_email, role, street_address, city, contact_number FROM users WHERE work_id = $1 AND password = $2', [workId, hashed]);
      if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid work ID or password.' });
      return res.json({ user: { ...result.rows[0], workId: result.rows[0].work_id, recoveryEmail: result.rows[0].recovery_email, role: result.rows[0].role || 'receptionist', streetAddress: result.rows[0].street_address, city: result.rows[0].city, contactNumber: result.rows[0].contact_number }, message: 'Login successful.' });
    }

    const user = fallbackUsers.find((item) => item.work_id === workId && item.password === hashed);
    if (!user) return res.status(401).json({ error: 'Invalid work ID or password.' });
    return res.json({ user: { id: user.id, name: user.name, email: user.email, workId: user.work_id, recoveryEmail: user.recovery_email, role: user.role || 'receptionist', streetAddress: user.street_address || '', city: user.city || '', contactNumber: user.contact_number || '' }, message: 'Login successful.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/recover', async (req, res) => {
  const { workId } = req.body;

  if (!workId) {
    return res.status(400).json({ error: 'Work ID is required.' });
  }

  try {
    if (pool) {
      const result = await queryDb('SELECT work_id FROM users WHERE work_id = $1', [workId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No matching work ID was found.' });
      }
      return res.json({ message: `Your work ID is ${result.rows[0].work_id}. Use it to sign in.` });
    }

    const user = fallbackUsers.find((item) => item.work_id === workId);
    if (!user) {
      return res.status(404).json({ error: 'No matching work ID was found.' });
    }

    return res.json({ message: `Your work ID is ${user.work_id}. Use it to sign in.` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    if (pool) {
      const result = await queryDb('SELECT id, name, email, work_id, role, street_address, city, contact_number FROM users ORDER BY id ASC');
      return res.json(result.rows.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        workId: user.work_id,
        role: user.role || 'receptionist',
        streetAddress: user.street_address || '',
        city: user.city || '',
        contactNumber: user.contact_number || '',
      })));
    }

    return res.json(fallbackUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      workId: user.work_id,
      role: user.role || 'receptionist',
      streetAddress: user.street_address || '',
      city: user.city || '',
      contactNumber: user.contact_number || '',
    })));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.patch('/api/profile', async (req, res) => {
  const { id, workId, name, email, role, streetAddress = '', city = '', contactNumber = '' } = req.body;

  if (!id && !workId) {
    return res.status(400).json({ error: 'User identifier is required.' });
  }

  try {
    if (pool) {
      const result = await queryDb(
        'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role), street_address = COALESCE($4, street_address), city = COALESCE($5, city), contact_number = COALESCE($6, contact_number) WHERE id = COALESCE($7, id) OR work_id = COALESCE($8, work_id) RETURNING id, name, email, work_id, role, street_address, city, contact_number',
        [name || null, email || null, role || null, streetAddress || null, city || null, contactNumber || null, id || null, workId || null]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
      const user = result.rows[0];
      return res.json({ user: { id: user.id, name: user.name, email: user.email, workId: user.work_id, role: user.role || 'receptionist', streetAddress: user.street_address || '', city: user.city || '', contactNumber: user.contact_number || '' } });
    }

    const index = fallbackUsers.findIndex((item) => item.id === Number(id) || item.work_id === workId);
    if (index === -1) return res.status(404).json({ error: 'User not found.' });

    fallbackUsers[index] = {
      ...fallbackUsers[index],
      name: name || fallbackUsers[index].name,
      email: email || fallbackUsers[index].email,
      role: role || fallbackUsers[index].role,
      street_address: streetAddress !== undefined ? streetAddress : fallbackUsers[index].street_address || '',
      city: city !== undefined ? city : fallbackUsers[index].city || '',
      contact_number: contactNumber !== undefined ? contactNumber : fallbackUsers[index].contact_number || '',
    };

    return res.json({ user: { id: fallbackUsers[index].id, name: fallbackUsers[index].name, email: fallbackUsers[index].email, workId: fallbackUsers[index].work_id, role: fallbackUsers[index].role || 'receptionist', streetAddress: fallbackUsers[index].street_address || '', city: fallbackUsers[index].city || '', contactNumber: fallbackUsers[index].contact_number || '' } });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/appointments', async (req, res) => {
  try {
    if (pool) {
      const result = await queryDb('SELECT * FROM appointments ORDER BY id DESC');
      return res.json(result.rows);
    }
    return res.json(fallbackAppointments);
  } catch (error) {
    return res.json(fallbackAppointments);
  }
});

app.patch('/api/appointments/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { status = 'Confirmed' } = req.body;

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Appointment ID is required.' });
  }

  try {
    if (pool) {
      const result = await queryDb('UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Appointment not found.' });
      return res.json(result.rows[0]);
    }

    const index = fallbackAppointments.findIndex((item) => item.id === id);
    if (index === -1) return res.status(404).json({ error: 'Appointment not found.' });
    fallbackAppointments[index] = { ...fallbackAppointments[index], status };
    return res.json(fallbackAppointments[index]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/appointments', async (req, res) => {
  const { patient, doctor, date, time } = req.body;

  if (!patient || !doctor || !date || !time) {
    return res.status(400).json({ error: 'Patient, doctor, date, and time are required.' });
  }

  try {
    if (pool) {
      const result = await queryDb(
        'INSERT INTO appointments (patient, doctor, date, time, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [patient, doctor, date, time, 'Pending']
      );
      return res.status(201).json(result.rows[0]);
    }

    const appointment = { id: fallbackAppointments.length + 1, patient, doctor, date, time, status: 'Pending' };
    fallbackAppointments.unshift(appointment);
    return res.status(201).json(appointment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics', async (req, res) => {
  res.json(await getAnalytics());
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Health management system running at http://localhost:${PORT}`);
  });
});
