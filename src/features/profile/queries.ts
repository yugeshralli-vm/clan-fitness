import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function getProfileDetails(userId: string) {
  const [details] = await db
    .select({
      heightCm: users.heightCm,
      weightKg: users.weightKg,
      dateOfBirth: users.dateOfBirth,
      gender: users.gender,
      unitsPreference: users.unitsPreference,
      bio: users.bio,
    })
    .from(users)
    .where(eq(users.id, userId));

  return details ?? null;
}
