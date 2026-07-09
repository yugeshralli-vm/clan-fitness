import "server-only";

// No roles/permissions system — the admin dashboard has exactly one authorized user, the app's
// creator, checked against a single env var rather than anything stored in the database.
export function isAdminUser(userId: string | null | undefined): boolean {
  return !!userId && userId === process.env.ADMIN_USER_ID;
}
