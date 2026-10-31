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
