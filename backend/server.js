const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;
const JWT_SECRET = process.env.JWT_SECRET || 'studyos-dev-secret';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studyos';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DAILY_TIMETABLE_SCAN_LIMIT = 5;
let mongoConnectPromise = null;

const colors = ['#2383e2', '#e03e3e', '#0f7b6c', '#dfab01', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c'];

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    total: { type: Number, default: 0 },
    attended: { type: Number, default: 0 },
    color: { type: String, default: '#2383e2' }
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: String, default: '' },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    date: { type: String, default: '' },
    completed: { type: Boolean, default: false },
    createdAt: { type: String, default: () => new Date().toISOString() }
  },
  { _id: true }
);

const pomoSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    duration: { type: Number, default: 25 },
    mode: { type: String, default: 'focus' }
  },
  { _id: true }
);

const timetableSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    day: { type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
    room: { type: String, default: '' }
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    subjects: { type: [subjectSchema], default: [] },
    tasks: { type: [taskSchema], default: [] },
    pomodoroSessions: { type: [pomoSchema], default: [] },
    achievements: { type: [String], default: [] },
    xp: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastActive: { type: String, default: '' },
    timetable: { type: [timetableSchema], default: [] },
    geminiApiKey: { type: String, default: '' },
    freeExtractions: { type: Number, default: 0 },
    heatmap: { type: mongoose.Schema.Types.Mixed, default: {} },
    aiExtractions: { type: [Date], default: [] }
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

app.use(
  cors({
    origin: true,
    credentials: false
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.resolve(__dirname, '..', 'public')));

function createToken(user) {
  return jwt.sign({ userId: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email
  };
}

function toClientData(user) {
  return {
    user: sanitizeUser(user),
    data: {
      subjects: user.subjects,
      tasks: user.tasks,
      pomodoroSessions: user.pomodoroSessions,
      achievements: user.achievements,
      xp: user.xp,
      streak: user.streak,
      lastActive: user.lastActive,
      timetable: user.timetable,
      geminiApiKey: user.geminiApiKey,
      freeExtractions: user.freeExtractions,
      heatmap: user.heatmap || {}
    }
  };
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      return res.status(401).json({ message: 'Missing auth token' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function normalizePayload(input = {}) {
  const data = {};

  data.subjects = Array.isArray(input.subjects)
    ? input.subjects
        .filter((item) => item && item.name)
        .map((item, index) => ({
          name: String(item.name).trim(),
          total: Math.max(0, Number(item.total) || 0),
          attended: Math.max(0, Number(item.attended) || 0),
          color: item.color || colors[index % colors.length]
        }))
    : [];

  data.tasks = Array.isArray(input.tasks)
    ? input.tasks
        .filter((item) => item && item.title)
        .map((item) => ({
          title: String(item.title).trim(),
          subject: item.subject ? String(item.subject).trim() : '',
          priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
          date: item.date ? String(item.date) : '',
          completed: Boolean(item.completed),
          createdAt: item.createdAt || new Date().toISOString()
        }))
    : [];

  data.pomodoroSessions = Array.isArray(input.pomodoroSessions)
    ? input.pomodoroSessions
        .filter((item) => item && item.date)
        .map((item) => ({
          date: String(item.date),
          duration: Number(item.duration) || 25,
          mode: item.mode || 'focus'
        }))
    : [];

  data.achievements = Array.isArray(input.achievements)
    ? input.achievements.filter(Boolean).map((item) => String(item))
    : [];

  data.xp = Math.max(0, Number(input.xp) || 0);
  data.streak = Math.max(0, Number(input.streak) || 0);
  data.lastActive = input.lastActive ? String(input.lastActive) : '';

  data.timetable = Array.isArray(input.timetable)
    ? input.timetable
        .filter((item) => item && item.subject && item.day && item.start && item.end)
        .map((item) => ({
          subject: String(item.subject).trim(),
          day: item.day,
          start: String(item.start),
          end: String(item.end),
          room: item.room ? String(item.room).trim() : ''
        }))
    : [];

  data.geminiApiKey = input.geminiApiKey ? String(input.geminiApiKey).trim() : '';
  data.freeExtractions = Math.max(0, Number(input.freeExtractions) || 0);
  data.heatmap = input.heatmap && typeof input.heatmap === 'object' ? input.heatmap : {};

  return data;
}

function cleanGeminiJson(raw = '') {
  let cleaned = String(raw)
    .replace(/```json[\s\S]*?```/gi, (m) => m.replace(/```json\s*/i, '').replace(/```\s*$/i, ''))
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\s*/g, ''))
    .trim()
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/\s*```$/im, '')
    .trim();

  const startIndex = cleaned.indexOf('[');
  if (startIndex === -1) {
    throw new Error('No JSON array found in AI response. Try a clearer image.');
  }
  cleaned = cleaned.slice(startIndex);

  const endIndex = cleaned.lastIndexOf(']');
  if (endIndex !== -1) {
    cleaned = cleaned.slice(0, endIndex + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const lastComma = cleaned.lastIndexOf('},');
    if (lastComma !== -1) {
      return JSON.parse(`${cleaned.slice(0, lastComma + 1)}]`);
    }
    throw new Error('Could not parse AI response as JSON. Try a clearer image.');
  }
}

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!mongoConnectPromise) {
    mongoConnectPromise = mongoose.connect(MONGODB_URI).catch((error) => {
      mongoConnectPromise = null;
      throw error;
    });
  }

  await mongoConnectPromise;
  return mongoose.connection;
}

app.use(async (_req, _res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'studyos-api' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    res.status(201).json({
      token: createToken(user),
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Unable to create account right now' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      token: createToken(user),
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Unable to sign in right now' });
  }
});

app.get('/api/user-data', auth, async (req, res) => {
  res.json(toClientData(req.user));
});

app.put('/api/user-data', auth, async (req, res) => {
  try {
    const payload = normalizePayload(req.body);

    req.user.subjects = payload.subjects;
    req.user.tasks = payload.tasks;
    req.user.pomodoroSessions = payload.pomodoroSessions;
    req.user.achievements = payload.achievements;
    req.user.xp = payload.xp;
    req.user.streak = payload.streak;
    req.user.lastActive = payload.lastActive;
    req.user.timetable = payload.timetable;
    req.user.geminiApiKey = payload.geminiApiKey;
    req.user.freeExtractions = payload.freeExtractions;
    req.user.heatmap = payload.heatmap;

    await req.user.save();
    res.json(toClientData(req.user));
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ message: 'Unable to save workspace data' });
  }
});

app.post('/api/timetable/extract', auth, async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(503).json({ message: 'Server Gemini API key is not configured' });
    }

    const imageBase64 = String(req.body.imageBase64 || '').trim();
    if (!imageBase64) {
      return res.status(400).json({ message: 'Timetable image is required' });
    }

    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    req.user.aiExtractions = (req.user.aiExtractions || []).filter((stamp) => new Date(stamp) >= dayStart);
    if (req.user.aiExtractions.length >= DAILY_TIMETABLE_SCAN_LIMIT) {
      return res.status(429).json({ message: `Daily AI timetable limit reached (${DAILY_TIMETABLE_SCAN_LIMIT}/day)` });
    }

    const prompt = 'Extract all classes from this timetable image. You must respond with ONLY a raw JSON array. No text before or after. No markdown. No code fences. No backticks. Begin your entire response with [ and end with ]. Each object must have: subject, day (one of: Mon Tue Wed Thu Fri Sat), start (24h format like 09:00), end (24h format), room. Example: [{"subject":"Math","day":"Mon","start":"09:00","end":"10:00","room":"A101"}]. Extract every single class now:';

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
              ]
            }
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 16384 }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.json().catch(() => ({}));
      return res.status(502).json({ message: errorBody.error?.message || 'Gemini request failed' });
    }

    const geminiData = await geminiResponse.json();
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const classes = cleanGeminiJson(raw);

    if (!Array.isArray(classes) || classes.length === 0) {
      return res.status(422).json({ message: 'No classes detected. Try a clearer image.' });
    }

    req.user.aiExtractions.push(now);
    await req.user.save();

    res.json({
      classes,
      remainingToday: Math.max(0, DAILY_TIMETABLE_SCAN_LIMIT - req.user.aiExtractions.length)
    });
  } catch (error) {
    console.error('Timetable extract error:', error);
    res.status(500).json({ message: error.message || 'Unable to extract timetable right now' });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled server error:', error);
  res.status(500).json({ message: 'Internal server error' });
});

async function start() {
  await connectToDatabase();
  app.listen(PORT, () => {
    console.log(`studyOS server running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = app;
