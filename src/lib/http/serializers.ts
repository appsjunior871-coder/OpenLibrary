/** Shapes returned to the client. Never include password hashes or storage keys. */
export function publicUser(u: { id: string; displayName: string; email: string; role: string; preferences: unknown }) {
  return { id: u.id, displayName: u.displayName, email: u.email, role: u.role, preferences: u.preferences };
}
