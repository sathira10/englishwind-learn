import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import type { Mailer } from "../mail";
import { linkStudent } from "./link-student";

// Rate limits, per client IP and endpoint, stored in D1 (`rate_limits`). Numbers are in
// plans/03-auth.md. Better Auth keys them "<ip>|<path>", so the IP must come from a header
// Cloudflare sets (cf-connecting-ip), never one the client can choose.
export const OTP_SEND_LIMIT = { window: 10 * 60, max: 3 } as const;
export const OTP_VERIFY_LIMIT = { window: 10 * 60, max: 10 } as const;
// Per lower-cased email address, on top of the per-IP limit (email-limit.ts).
export const EMAIL_SEND_LIMIT = { window: 60 * 60, max: 5 } as const;

export interface AuthDeps {
  mailer: Mailer;
  /** Keeps work running after the response (Worker `waitUntil`); omitted, work is awaited. */
  waitUntil?: (promise: Promise<unknown>) => void;
}

type AuthEnv = Pick<
  Env,
  "DB" | "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET"
>;

/** Built per request: a Worker has no state between requests and env arrives with each one. */
export function createAuth(env: AuthEnv, deps: AuthDeps) {
  const db = drizzle(env.DB, { schema });
  const secure = new URL(env.BETTER_AUTH_URL).protocol === "https:";
  const { GOOGLE_CLIENT_ID: googleId, GOOGLE_CLIENT_SECRET: googleSecret } = env;

  return betterAuth({
    appName: "EnglishWind",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL, // one origin (ADR 0002); /api/auth is the default base path
    database: drizzleAdapter(db, { provider: "sqlite", schema, usePlural: true }),
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    socialProviders:
      googleId && googleSecret
        ? { google: { clientId: googleId, clientSecret: googleSecret } }
        : {},
    // No trustedProviders: Better Auth then links a social login to an existing user only when
    // the provider reports the email as verified AND the local user is verified.
    account: { accountLinking: { enabled: true } },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 5 * 60,
        allowedAttempts: 3,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          if (type === "sign-in") await deps.mailer.sendLoginCode(email, otp);
        },
      }),
    ],
    rateLimit: {
      enabled: true, // off by default outside production
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/email-otp/send-verification-otp": OTP_SEND_LIMIT,
        "/sign-in/email-otp": OTP_VERIFY_LIMIT,
        // Matches no real path. It only tells Better Auth's pruning of old `rate_limits` rows that
        // a 1 hour window exists, so the per-email counters (email-limit.ts) are not pruned early.
        "/__keep-rate-limit-rows-for-the-email-window": EMAIL_SEND_LIMIT,
      },
    },
    advanced: {
      useSecureCookies: secure,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      ...(deps.waitUntil ? { backgroundTasks: { handler: deps.waitUntil } } : {}),
    },
    databaseHooks: {
      user: {
        create: {
          // Every new user gets a students row (new, or the one that matches their email).
          after: async (user) => {
            await linkStudent(env.DB, user);
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
