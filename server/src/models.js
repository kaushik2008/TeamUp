// ============================================================================
// models.js — the database schema.
//
// TeamUp stores three kinds of documents in MongoDB. Mongoose turns each schema below
// into a model (User, Team, Request) with .find(), .create(), .save() and so on, and
// validates data before it is written.
//
//   User    — a hacker's profile: roles, level, languages, GitHub info, and which team they're on
//   Team    — a project looking for members: idea, track, the roles it still needs
//   Request — a join request (hacker -> team) or an invite (team -> hacker), with a status
//
// The shared lists of allowed values live here too, so the schemas and the routes agree.
// ============================================================================
import mongoose from 'mongoose';

const { Schema } = mongoose;

// ---- Allowed values -------------------------------------------------------
// The client has the same lists in client/src/lib/format.ts. Keep them in sync.
export const ROLES = ['frontend', 'backend', 'design', 'ml', 'hardware', 'pm'];
export const LEVELS = ['beginner', 'intermediate', 'advanced'];
export const TRACKS = ['Social Good', 'Climate', 'Education', 'Accessibility', 'Health', 'Fintech', 'Open'];

// ---- User -----------------------------------------------------------------
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    bio: { type: String, default: '', maxlength: 500 },

    // What the hacker can do. Roles drive most of the match score (+3 each), so at least one is required.
    roles: { type: [{ type: String, enum: ROLES }], validate: { validator: (v) => v.length > 0, message: 'Pick at least one role' } },
    level: { type: String, enum: LEVELS, required: true },

    // Language name -> share of the hacker's code, from 0 to 1 (e.g. { Python: 0.6, Go: 0.4 }).
    // A Map (rather than fixed fields) lets us store any language name GitHub reports.
    skills: { type: Map, of: Number, default: {} },

    // GitHub sync. `githubVerified` is true once skills came from real repos rather than self-report.
    githubUsername: { type: String, trim: true },
    githubVerified: { type: Boolean, default: false },
    githubSyncedAt: Date, // used to rate-limit re-syncs to once an hour
    githubRepoCount: Number,
    recentRepos: [{ name: String, description: String, language: String, url: String }],

    // Availability. A hacker is suggested to teams only if looking AND not already on a team.
    lookingForTeam: { type: Boolean, default: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

// When a user is sent as JSON, turn the skills Map into a plain object and drop Mongoose's __v.
userSchema.set('toJSON', { flattenMaps: true, versionKey: false });

// ---- Team -----------------------------------------------------------------
const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // the captain
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'User' }], // includes the captain
    idea: { type: String, required: true, maxlength: 400 },
    track: { type: String, default: 'Open' },

    // The roles the team is still missing. Accepting a member removes the roles they cover.
    neededRoles: [{ type: String, enum: ROLES }],
    // Languages/tools the team plans to use. Shared languages add +1 each to a hacker's score.
    stack: [String],

    maxSize: { type: Number, default: 4, min: 2, max: 6 },
    // Flips to false automatically when memberIds reaches maxSize. Closed teams get no suggestions.
    isOpen: { type: Boolean, default: true },
  },
  { timestamps: true }
);

teamSchema.set('toJSON', { versionKey: false });

// ---- Request --------------------------------------------------------------
// type "join":   a hacker (fromUserId) asks to join a team; toUserId is the team's captain.
// type "invite": a team member (fromUserId) invites a hacker (toUserId) to their team.
// Either way, the person in toUserId is the one who can accept or decline.
const requestSchema = new Schema(
  {
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    type: { type: String, enum: ['join', 'invite'], required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    message: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true }
);

requestSchema.set('toJSON', { versionKey: false });

// ---- Models ---------------------------------------------------------------
export const User = mongoose.model('User', userSchema);
export const Team = mongoose.model('Team', teamSchema);
export const Request = mongoose.model('Request', requestSchema);
