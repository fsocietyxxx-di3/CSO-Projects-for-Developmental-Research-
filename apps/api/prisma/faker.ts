/**
 * Minimal local faker (no extra dependency) — only wants deterministic-ish dates.
 */
export const faker = {
  /** Random date inside the given birth year (keeps seed data realistic + varied). */
  birthdate(birthYear: number): Date {
    const start = new Date(birthYear, 0, 1);
    const end = new Date(birthYear, 11, 28);
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  },
};
