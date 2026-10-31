# TeamUp — Hackathon Teammate Matcher

Full-Stack DeCal Project 2 (APImagination), built for HowToHackathon.

Hackers build a profile in under two minutes, teams post the roles they still need, and TeamUp ranks who fills each gap and shows the reasons. Join requests and invites close the loop in an inbox. Accepting a request adds the member, and a full team closes on its own.

**Stack:** React 19 + TypeScript (Vite), Tailwind CSS v4, React Router, Axios · Express 5 + Mongoose · MongoDB · GitHub REST API

## Run it locally

You need Node 20+ and MongoDB (local `mongod`, or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster).

```bash
npm run setup                          # installs root, server and client
cp server/.env.example server/.env     # then set MONGODB_URI (and optionally GITHUB_TOKEN)
npm run seed                           # 30 fake hackers, 6 teams, a few requests
npm run dev                            # API on :4000, web on :5173
```

Open http://localhost:5173. v1 has no login, so the footer has a **Demo: viewing as** switcher. Pick **Arjun Mehta** (captain of Pantry Pal) to see the inbox, team suggestions and invites. Pick **Kenji Nakamura** to see teams ranked for a solo hacker.

`GITHUB_TOKEN` is optional. Without it GitHub allows 60 requests an hour, and with a token (no scopes needed) it allows 5,000.

## Project structure

Every file starts with a comment explaining what it does. The short version:

```
server/src/
  server.js        Entry point: loads .env, connects to MongoDB, builds the Express app, listens on :4000
  models.js        The three Mongoose schemas (User, Team, Request) and the shared ROLES / LEVELS / TRACKS lists
  routes/
    users.js       /api/users and /api/github: profiles, browsing hackers, GitHub sync, ranked teams for a hacker
    teams.js       /api/teams: posting and browsing teams, ranked hackers for a team
    requests.js    /api/requests: join requests, invites, accept / decline
  matching.js      The scoring algorithm (+3 per covered role, +1 per shared language, +1 similar level)
  github.js        Calls the GitHub REST API with Axios and turns repos into language shares
  helpers.js       HttpError, asyncHandler, assertId, toList, shared by the routes
  seed.js          Demo data: 30 hackers, 6 teams, a few requests

client/src/
  main.tsx         Mounts React
  App.tsx          The route table (React Router)
  index.css        Tailwind v4 import, fonts, dark theme
  lib/
    api.ts         The Axios instance and the TypeScript types for API responses
    session.tsx    Who is signed in (React Context) and their sent / received requests
    format.ts      Labels and small formatting helpers
  components/
    ui.tsx         Buttons, role chips, avatars, match reasons, loading / empty / error states
    Layout.tsx     Nav bar and the footer demo switcher
    LanguageBars.tsx, TagInput.tsx
  pages/           One file per route (see the table below)
```

## Pages (8 routes, matching the Figma screens)

| Route | Screen |
|---|---|
| `/` | Landing, with a live "top match" card |
| `/onboard` | Create profile, with GitHub sync or manual languages |
| `/teams` | Browse open teams, filtered by needed role and track and ranked for you |
| `/teams/new` | Post a team |
| `/teams/:id` | Team detail: members, open spots, ranked suggested hackers, invite |
| `/hackers` | Browse hackers by name, role, language and level |
| `/hackers/:id` | Hacker profile: languages, repos, invite card, and editing for your own profile |
| `/inbox` | Received and sent requests, with accept and decline |

## API

| Method | Route | Does |
|---|---|---|
| POST | `/api/users` | Create a profile (syncs GitHub if a username is given) |
| GET | `/api/users?role=&lang=&level=&q=` | List hackers looking for a team |
| GET | `/api/users/:id` | Profile detail |
| PATCH | `/api/users/:id` | Edit a profile or its skills |
| POST | `/api/users/:id/sync-github` | Pull repos and write skills (once per hour) |
| GET | `/api/users/:id/suggestions` | Ranked teams for a hacker |
| GET | `/api/github/:username` | Preview languages during onboarding (nothing saved) |
| POST | `/api/teams` | Create a team; the creator becomes captain |
| GET | `/api/teams?role=&track=&includeClosed=&forUser=` | List teams, with match scores for `forUser` |
| GET | `/api/teams/:id` | Team detail with members |
| GET | `/api/teams/:id/suggestions` | Ranked hackers for a team |
| POST | `/api/teams/:id/leave` | Leave a team. Frees the seat, reopens a full team, passes captaincy to the next member, or deletes an emptied team |
| POST | `/api/requests` | Send a join request or an invite |
| GET | `/api/requests?userId=` | Inbox: received and sent |
| PATCH | `/api/requests/:id` | Accept or decline. Accepting adds the member, drops the roles they cover, and closes a full team |

## Matching score

`server/src/matching.js`

- **+3** for each of the team's needed roles the hacker covers
- **+1** for each language the hacker shares with the team's stack
- **+1** if the hacker's level is within one step of the team's average
- Anyone already on a team, or not looking, is excluded. A level match alone isn't enough to be suggested.

## GitHub sync

`server/src/github.js` makes one call per user, `GET /users/{username}/repos?per_page=100&sort=pushed`, on the server with Axios. It skips forks and weights each repo's language toward recent pushes (a repo pushed today counts 1, one pushed a year ago about 0.33). It then normalizes the weights to shares and caches the result for an hour. The token never reaches the browser.

## Course requirement checklist

- **useState + useEffect:** filters, forms, and data fetching on every page
- **Multiple pages + React Router:** the 8 routes above (`client/src/App.tsx`)
- **Axios calls an HTTPS API:** the frontend calls the Express API (`client/src/lib/api.ts`), and Express calls the GitHub REST API over HTTPS
- **Express API:** `server/src/server.js` and `server/src/routes/*`
- **Database:** MongoDB via Mongoose, three collections defined in `server/src/models.js`: `users`, `teams`, `requests`
- **No keys in the repo:** `.env` is gitignored, and `.env.example` files are committed

## Deploying (P2)

- **API → Render:** set the root to `server`, the build command to `npm install`, and the start command to `npm start`. Set `MONGODB_URI` (Atlas), `GITHUB_TOKEN`, and `CLIENT_ORIGIN=https://<your-vercel-app>.vercel.app`.
- **Web → Vercel:** set the root to `client`, and set `VITE_API_URL=https://<your-render-api>.onrender.com`. `vercel.json` handles client-side routes.
- After the first deploy, run `npm run seed` once with the Atlas `MONGODB_URI`.

## Not in v1

Login (the demo switcher stands in for it), the organizer dashboard, and real-time chat. These are P2 items or non-goals in the PRD.
