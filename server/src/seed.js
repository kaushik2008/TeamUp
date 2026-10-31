// ============================================================================
// seed.js — fills the database with demo data so the app works with zero real users.
//
// Run with `npm run seed` (from the repo root or from server/). It wipes the three
// collections and inserts ~30 fake hackers, 6 teams and a handful of requests.
// Every person here is made up. Re-run it any time you want a clean slate.
// ============================================================================
import 'dotenv/config';
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { User, Team, Request } from './models.js';

const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000);

// [name, roles, level, skills, githubUsername?, bio]
const PEOPLE = [
  ['Arjun Mehta', ['frontend', 'backend'], 'intermediate', { Python: 0.46, TypeScript: 0.31, 'C++': 0.15, Shell: 0.08 }, 'arjunm-dev', 'Second hackathon. Comfortable with React and Flask, want to learn more about deploying real backends.'],
  ['Priya Shah', ['ml'], 'beginner', { Python: 0.7, 'Jupyter Notebook': 0.3 }, null, 'Data 8 alum. I want to train my first real model on real data.'],
  ['Maya Okafor', ['backend', 'design'], 'intermediate', { Python: 0.44, TypeScript: 0.34, Go: 0.14, Shell: 0.08 }, 'mokafor', 'Third hackathon. I like owning the API and the data model, and I sketch the UI flows before anyone writes code.'],
  ['Daniel Lim', ['ml'], 'advanced', { Python: 0.62, 'Jupyter Notebook': 0.25, 'C++': 0.13 }, 'dlim-ml', 'Research in computer vision. Happy to mentor on model training.'],
  ['Sofia Ramirez', ['design', 'pm'], 'beginner', { Python: 0.5, Figma: 0.5 }, null, 'First hackathon! Cognitive science major who loves user research.'],
  ['Kenji Nakamura', ['hardware', 'backend'], 'intermediate', { 'C++': 0.48, Python: 0.37, Rust: 0.15 }, 'knakamura', 'Robotics club. I bring an Arduino kit to every event.'],
  ['Ava Thompson', ['frontend', 'design'], 'advanced', { TypeScript: 0.55, JavaScript: 0.3, CSS: 0.15 }, 'avathompson', 'Frontend intern last summer. Tailwind and Framer Motion fan.'],
  ['Marcus Johnson', ['backend'], 'advanced', { Go: 0.5, TypeScript: 0.3, Python: 0.2 }, 'mjohnson-go', 'Backend and infra. I will set up your CI in ten minutes.'],
  ['Lena Fischer', ['pm', 'design'], 'intermediate', { JavaScript: 1 }, null, 'Organized two campus events. I keep teams on scope.'],
  ['Omar Haddad', ['frontend'], 'beginner', { JavaScript: 0.6, HTML: 0.4 }, null, 'Just finished a web dev DeCal. Looking for a patient team.'],
  ['Grace Liu', ['ml', 'backend'], 'intermediate', { Python: 0.8, SQL: 0.2 }, 'graceliu', 'NLP projects, FastAPI, and a lot of pandas.'],
  ['Noah Patel', ['hardware'], 'beginner', { 'C++': 0.7, Python: 0.3 }, null, 'EECS 16A survivor. Want to build something physical.'],
  ['Isabella Rossi', ['design'], 'intermediate', { Figma: 0.7, JavaScript: 0.3 }, null, 'Product designer. Design systems and accessibility audits.'],
  ['Ethan Brooks', ['hardware', 'ml'], 'advanced', { 'C++': 0.5, Python: 0.4, MATLAB: 0.1 }, 'ebrooks-hw', 'Sensors and embedded ML. Building flood sensors this weekend.'],
  ['Chloe Kim', ['frontend', 'pm'], 'intermediate', { TypeScript: 0.6, JavaScript: 0.4 }, 'chloekim', 'React and React Native. I like demos that work on a phone.'],
  ['Diego Alvarez', ['backend'], 'beginner', { Java: 0.6, Python: 0.4 }, null, 'CS 61B taught me Java. Ready to try Express.'],
  ['Hannah Wright', ['ml'], 'intermediate', { Python: 0.9, R: 0.1 }, 'hwright-data', 'Statistics major. Recommender systems and evaluation.'],
  ['Samir Khan', ['frontend', 'backend'], 'advanced', { TypeScript: 0.7, Rust: 0.2, Go: 0.1 }, 'samirk', 'Full stack. Shipped three hackathon projects to production.'],
  ['Zoe Martin', ['design', 'frontend'], 'beginner', { HTML: 0.5, CSS: 0.5 }, null, 'Art practice major learning to code. Strong on visuals.'],
  ['Lucas Silva', ['pm'], 'intermediate', { Python: 1 }, null, 'Business major who can code a little. Pitch decks are my thing.'],
  ['Emily Chen', ['frontend'], 'intermediate', { JavaScript: 0.5, TypeScript: 0.5 }, 'emchen', 'Accessibility nerd. Screen readers are my testing tool.'],
  ['Jamal Wilson', ['ml', 'backend'], 'advanced', { Python: 0.75, 'C++': 0.25 }, 'jwilson-cv', 'Computer vision, real-time inference in the browser.'],
  ['Mia Johansson', ['design'], 'advanced', { Figma: 0.8, JavaScript: 0.2 }, null, 'Interaction design. I prototype before we build.'],
  ['Ryan O’Connor', ['backend', 'hardware'], 'intermediate', { Python: 0.6, C: 0.4 }, null, 'Raspberry Pi projects and Flask APIs.'],
  ['Aisha Bello', ['pm', 'frontend'], 'beginner', { JavaScript: 1 }, null, 'First hackathon, here to learn and organize.'],
  ['Tom Becker', ['backend'], 'intermediate', { Java: 0.5, Kotlin: 0.5 }, 'tbecker', 'Spring Boot at my internship. Want to try Node.'],
  ['Nina Popov', ['ml'], 'beginner', { Python: 1 }, null, 'Math major curious about ML.'],
  ['Victor Huang', ['frontend', 'design'], 'intermediate', { TypeScript: 0.65, CSS: 0.35 }, 'vhuang', 'Design engineer. Motion and micro-interactions.'],
  ['Layla Hassan', ['backend', 'ml'], 'intermediate', { Python: 0.55, SQL: 0.45 }, 'lhassan', 'Data pipelines and Postgres. I like clean schemas.'],
  ['Ben Carter', ['hardware', 'frontend'], 'beginner', { JavaScript: 0.5, 'C++': 0.5 }, null, 'Maker space regular. Learning web to control my builds.'],
];

const REPOS = {
  'Maya Okafor': [
    { name: 'study-buddy-api', description: 'Express API with JWT auth and a matching endpoint', language: 'TypeScript' },
    { name: 'bart-delay-bot', description: 'Discord bot that posts BART delays', language: 'Python' },
    { name: 'portfolio', description: 'Personal site', language: 'TypeScript' },
  ],
};

// [name, ownerName, otherMemberNames, idea, track, neededRoles, stack, maxSize, createdMinutesAgo]
const TEAMS = [
  ['Pantry Pal', 'Arjun Mehta', ['Priya Shah'], "Matches campus food pantry stock to students' dietary needs, so nothing expires on the shelf.", 'Social Good', ['backend', 'design'], ['React', 'TypeScript', 'Python', 'MongoDB'], 4, 90],
  ['Tidewatch', 'Ethan Brooks', [], 'Flood alerts for Bay Area shoreline neighborhoods from tide sensors.', 'Climate', ['backend', 'hardware'], ['Python', 'C++'], 4, 80],
  ['Office Hours Queue', 'Samir Khan', ['Chloe Kim', 'Hannah Wright'], 'A live queue for TA office hours with wait-time estimates.', 'Education', ['backend'], ['TypeScript', 'React', 'Python'], 4, 70],
  ['SignBridge', 'Jamal Wilson', ['Emily Chen', 'Mia Johansson', 'Lucas Silva'], 'Real-time ASL fingerspelling to text in the browser.', 'Accessibility', [], ['Python', 'TypeScript'], 4, 60],
  ['RentSplit', 'Marcus Johnson', ['Isabella Rossi'], 'Splits rent and utilities fairly for roommates, with reminders before due dates.', 'Fintech', ['frontend', 'ml'], ['TypeScript', 'Go', 'Python'], 4, 50],
  ['Clinic Compass', 'Lena Fischer', [], 'Finds the nearest free or low-cost clinic that is open right now and takes walk-ins.', 'Health', ['frontend', 'design', 'pm'], ['JavaScript', 'TypeScript'], 4, 40],
];

export async function seed() {
  // Start clean.
  await Promise.all([User.deleteMany({}), Team.deleteMany({}), Request.deleteMany({})]);

  // 1. Users. Emails are derived from names; GitHub fields are filled in for people with a handle.

  const users = await User.insertMany(
    PEOPLE.map(([name, roles, level, skills, gh, bio]) => ({
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.$/, '')}@berkeley.edu`,
      roles,
      level,
      skills,
      bio,
      githubUsername: gh || undefined,
      githubVerified: Boolean(gh),
      githubSyncedAt: gh ? minutesAgo(120) : undefined,
      githubRepoCount: gh ? 8 + (name.length % 25) : undefined,
      recentRepos: REPOS[name] || [],
    }))
  );
  const byName = Object.fromEntries(users.map((u) => [u.name, u]));
  byName['Maya Okafor'].githubRepoCount = 31;
  await byName['Maya Okafor'].save();

  // 2. Teams. Members get teamId set and lookingForTeam cleared, exactly as the real routes do.
  const teams = [];
  for (const [name, ownerName, others, idea, track, neededRoles, stack, maxSize, ago] of TEAMS) {
    const members = [ownerName, ...others].map((n) => byName[n]);
    const team = await Team.create({
      name,
      ownerId: byName[ownerName]._id,
      memberIds: members.map((m) => m._id),
      idea,
      track,
      neededRoles,
      stack,
      maxSize,
      isOpen: members.length < maxSize,
      createdAt: minutesAgo(ago),
    });
    await User.updateMany({ _id: { $in: team.memberIds } }, { teamId: team._id, lookingForTeam: false });
    teams.push(team);
  }
  const team = Object.fromEntries(teams.map((t) => [t.name, t]));

  // 3. A few requests so the inbox has something to show (Arjun Mehta's is the busiest).
  await Request.insertMany([
    { type: 'join', fromUserId: byName['Maya Okafor']._id, toUserId: byName['Arjun Mehta']._id, teamId: team['Pantry Pal']._id, message: 'Happy to own the Express API and the pantry inventory model.', createdAt: minutesAgo(12) },
    { type: 'join', fromUserId: byName['Diego Alvarez']._id, toUserId: byName['Arjun Mehta']._id, teamId: team['Pantry Pal']._id, message: 'Beginner on backend but I learn fast. Would love to pair on the API.', createdAt: minutesAgo(45) },
    { type: 'join', fromUserId: byName['Priya Shah']._id, toUserId: byName['Arjun Mehta']._id, teamId: team['Pantry Pal']._id, status: 'accepted', message: 'I can do the dietary-needs classifier.', createdAt: minutesAgo(85) },
    { type: 'invite', fromUserId: byName['Ethan Brooks']._id, toUserId: byName['Kenji Nakamura']._id, teamId: team.Tidewatch._id, message: 'We need someone on the sensor firmware.', createdAt: minutesAgo(60) },
    { type: 'join', fromUserId: byName['Grace Liu']._id, toUserId: byName['Marcus Johnson']._id, teamId: team.RentSplit._id, createdAt: minutesAgo(20) },
  ]);

  return { users: users.length, teams: teams.length };
}

// Only connect and run when this file is executed directly (`node src/seed.js`),
// not when seed() is imported from somewhere else.
// pathToFileURL handles Windows paths (C:\...) as well as POSIX ones.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/teamup';
  await mongoose.connect(uri);
  const counts = await seed();
  console.log(`Seeded ${counts.users} hackers and ${counts.teams} teams into ${mongoose.connection.name}`);
  await mongoose.disconnect();
}
