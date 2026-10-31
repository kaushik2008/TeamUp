// ============================================================================
// server.js — the entry point for the TeamUp API.
//
// What happens when you run `npm run dev` or `npm start`:
//   1. Load the variables from server/.env (PORT, MONGODB_URI, GITHUB_TOKEN, CLIENT_ORIGIN).
//   2. Connect to MongoDB with Mongoose. If that fails we exit early with a clear message,
//      because every route needs the database.
//   3. Build the Express app: CORS, JSON parsing, the three routers, and error handling.
//   4. Start listening. The React client talks to this server at http://localhost:4000/api.
// ============================================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import usersRouter from './routes/users.js';
import teamsRouter from './routes/teams.js';
import requestsRouter from './routes/requests.js';

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/teamup';

// ---- 1 & 2. Connect to the database --------------------------------------
try {
  await mongoose.connect(MONGODB_URI);
  console.log(`MongoDB connected (${mongoose.connection.name})`);
} catch (err) {
  console.error(`Could not connect to MongoDB at ${MONGODB_URI}\n${err.message}`);
  console.error('Set MONGODB_URI in server/.env (a free MongoDB Atlas cluster works).');
  process.exit(1);
}

// ---- 3. Build the Express app --------------------------------------------
const app = express();

// Only the React app's origin may call this API from a browser. In development that is
// Vite on :5173; in production set CLIENT_ORIGIN to the deployed site (comma-separate several).
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(cors({ origin: origins }));

// Parse JSON request bodies into req.body. 100kb is plenty for profiles and messages.
app.use(express.json({ limit: '100kb' }));

// A tiny route a hosting provider (or you) can hit to check the server is alive.
app.get('/api/health', (req, res) => res.json({ ok: true }));

// All real endpoints live in routes/. Each router defines its own paths under /api.
app.use('/api', usersRouter); // /api/users..., /api/github/:username
app.use('/api', teamsRouter); // /api/teams...
app.use('/api', requestsRouter); // /api/requests...

// Anything under /api that no router claimed is a 404, returned as JSON so the client
// can show a message instead of an HTML error page.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler. Route handlers `throw` (see helpers.js) and the error lands here.
// Express recognises this as an error handler because it takes four arguments.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Mongoose schema validation (e.g. "Pick at least one role") -> 400 with the first message.
  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ error: first?.message || 'Invalid data' });
  }
  // MongoDB duplicate-key error. The only unique field is the user's email.
  if (err?.code === 11000) return res.status(409).json({ error: 'That email already has a profile' });

  // HttpError and GitHubError carry their own status. Anything else is an unexpected 500,
  // which we log but do not leak to the client.
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.status ? 'Something went wrong' : err.message });
});

// ---- 4. Listen ------------------------------------------------------------
app.listen(PORT, () => console.log(`TeamUp API on http://localhost:${PORT}`));
