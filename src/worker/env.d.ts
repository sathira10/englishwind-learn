// Optional secrets. `wrangler types` only lists the required ones (BETTER_AUTH_SECRET), so the
// Google pair is declared here. Google sign-in is on only when both are set (Q5).
interface Env {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}
