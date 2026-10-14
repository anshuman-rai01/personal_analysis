import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

/**
 * Registers a user if not already registered.
 * Strict registration only: inserts a users row. Idempotent.
 */
export async function registerUser(uid: string, email: string, displayName?: string | null) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      if (displayName && displayName !== existing[0].displayName) {
        await db.update(users).set({ displayName }).where(eq(users.uid, uid));
        existing[0].displayName = displayName;
      }
      return { user: existing[0], created: false };
    }

    const result = await db.insert(users)
      .values({
        uid,
        email,
        displayName: displayName || null,
      })
      .returning();

    return { user: result[0], created: true };
  } catch (error) {
    console.error("User registration failed:", error);
    throw new Error("Failed to register user profile", { cause: error });
  }
}

export async function getUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error("Database query failed:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
