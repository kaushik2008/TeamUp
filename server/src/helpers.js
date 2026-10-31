// ============================================================================
// helpers.js — small utilities shared by the route files.
// ============================================================================
import mongoose from 'mongoose';

/**
 * An error with an HTTP status attached. Routes `throw new HttpError(404, 'Team not found')`
 * and the error handler in server.js turns it into `res.status(404).json({ error })`.
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Wraps an async route handler so a rejected promise is passed to `next(err)`.
 * Without this, an `await` that throws inside a route would crash or hang the request.
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Reject ids that aren't valid MongoDB ObjectIds with a 400 instead of letting Mongoose throw a 500. */
export function assertId(id, label = 'id') {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, `Invalid ${label}`);
}

/**
 * Accepts either "a, b" (a query string) or ["a", "b"] (a JSON body) and returns a clean array.
 * Lets the same route take input from a URL filter or a form submission.
 */
export function toList(value) {
  if (value == null || value === '') return [];
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return arr.map((v) => String(v).trim()).filter(Boolean);
}
