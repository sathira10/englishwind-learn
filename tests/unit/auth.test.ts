import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { requireStudent, type AppEnv } from "../../src/worker/auth/require-student";
import { createApp } from "../../src/worker/app";
import { linkStudent } from "../../src/worker/auth/link-student";
import { createConsoleMailer } from "../../src/worker/mail/console";
import { mailerFromEnv, type Mailer } from "../../src/worker/mail";

// Plan 03 (student auth). Real D1, the real Hono app and Better Auth; only the mailer is
// swapped for one that captures the code. D1 state persists across tests in a file, so every
// test uses its own email address and its own client IP (the rate limiter keys on IP).

const ORIGIN = "https://learn.test";
let counter = 0;
const unique = () => `${Date.now()}-${++counter}`;
const freshIp = () => `203.0.${Math.floor(counter / 250)}.${(++counter % 250) + 1}`;

function setup() {
  const sent: { to: string; code: string }[] = [];
  const mailer: Mailer = {
    async sendLoginCode(to, code) {
      sent.push({ to, code });
    },
  };
  const app = createApp({ mailer });
  const ip = freshIp();
  const call = (
    path: string,
    init: RequestInit & { cookie?: string; ip?: string; extra?: Record<string, string> } = {},
  ) => {
    const { cookie, ip: ipOverride, extra, ...rest } = init;
    return app.fetch(
      new Request(`${ORIGIN}${path}`, {
        ...rest,
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          "cf-connecting-ip": ipOverride ?? ip,
          ...(cookie ? { cookie } : {}),
          ...extra,
        },
      }),
      env,
    );
  };
  const sendCode = (email: string, ipOverride?: string) =>
    call("/api/auth/email-otp/send-verification-otp", {
      method: "POST",
      body: JSON.stringify({ email, type: "sign-in" }),
      ip: ipOverride,
    });
  const signIn = (email: string, otp: string, ipOverride?: string) =>
    call("/api/auth/sign-in/email-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
      ip: ipOverride,
    });
  const cookieOf = (res: Response) =>
    res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  async function signInFully(email: string) {
    await sendCode(email);
    const res = await signIn(email, sent.at(-1)!.code);
    return { res, cookie: cookieOf(res) };
  }
  return { sent, call, sendCode, signIn, signInFully, cookieOf };
}

const studentByEmail = (email: string) =>
  env.DB.prepare("SELECT id, email, name, user_id FROM students WHERE email = ?")
    .bind(email)
    .first<{ id: string; email: string; name: string; user_id: string | null }>();

describe("email code sign-in", () => {
  it("signs a student in end to end and /api/me answers for them", async () => {
    const t = setup();
    const email = `flow-${unique()}@example.lk`;

    expect((await t.call("/api/me")).status).toBe(401);

    const sendRes = await t.sendCode(email);
    expect(sendRes.status).toBe(200);
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]!.to).toBe(email);
    expect(t.sent[0]!.code).toMatch(/^\d{6}$/);

    const { res, cookie } = await t.signInFully(email);
    expect(res.status).toBe(200);

    const meRes = await t.call("/api/me", { cookie });
    expect(meRes.status).toBe(200);
    expect(await meRes.json()).toEqual({ name: email.split("@")[0], email });
  });

  it("rejects a wrong code and sets no cookie", async () => {
    const t = setup();
    const email = `wrong-${unique()}@example.lk`;
    await t.sendCode(email);
    const real = t.sent[0]!.code;
    const res = await t.signIn(email, real === "000000" ? "111111" : "000000");
    expect(res.status).toBe(400);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("sets httpOnly, secure, SameSite=Lax cookies", async () => {
    const t = setup();
    const { res } = await t.signInFully(`cookie-${unique()}@example.lk`);
    const setCookie = res.headers.getSetCookie().join("\n").toLowerCase();
    expect(setCookie).toContain("httponly");
    expect(setCookie).toContain("secure");
    expect(setCookie).toContain("samesite=lax");
  });

  it("answers 401 JSON from /api/me with a forged session cookie", async () => {
    const t = setup();
    const res = await t.call("/api/me", { cookie: "__Secure-better-auth.session_token=forged" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("does not offer Google when its keys are unset", async () => {
    const t = setup();
    const res = await t.call("/api/auth/sign-in/social", {
      method: "POST",
      body: JSON.stringify({ provider: "google", callbackURL: "/" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("student linking", () => {
  it("attaches an existing students row (any email case) and does not duplicate it", async () => {
    const t = setup();
    const email = `buyer-${unique()}@example.lk`;
    await env.DB.prepare(
      "INSERT INTO students (id, email, name, created_at) VALUES (?, ?, 'Nimali Perera', 1)",
    )
      .bind(`stu-${unique()}`, email)
      .run();

    // The student types their address in capitals.
    await t.sendCode(email.toUpperCase());
    const res = await t.signIn(email.toUpperCase(), t.sent[0]!.code);
    expect(res.status).toBe(200);

    const row = await studentByEmail(email);
    expect(row?.user_id).toBeTruthy();
    expect(row?.name).toBe("Nimali Perera");
    const count = await env.DB.prepare("SELECT count(*) AS n FROM students WHERE email = ?")
      .bind(email)
      .first<{ n: number }>();
    expect(count?.n).toBe(1);

    const me = await t.call("/api/me", { cookie: t.cookieOf(res) });
    expect(await me.json()).toEqual({ name: "Nimali Perera", email });
  });

  it("creates a students row for a new email, lower-cased", async () => {
    const t = setup();
    const email = `brandnew-${unique()}@example.lk`;
    await t.signInFully(email.toUpperCase());
    const row = await studentByEmail(email);
    expect(row?.user_id).toBeTruthy();
    expect(row?.name).toBe(email.split("@")[0]);
  });

  it("linkStudent is idempotent for the same user", async () => {
    const email = `idem-${unique()}@example.lk`;
    const user = { id: `u-${unique()}`, email, emailVerified: true };
    const first = await linkStudent(env.DB, user);
    const again = await linkStudent(env.DB, { ...user, email: email.toUpperCase() });
    expect(first.status).toBe("linked");
    expect(again).toEqual(first);
  });

  it("linkStudent does not link an unverified email, and creates no row", async () => {
    const email = `unverified-${unique()}@example.lk`;
    await env.DB.prepare("INSERT INTO students (id, email, name, created_at) VALUES (?, ?, 'B', 1)")
      .bind(`stu-${unique()}`, email)
      .run();
    const result = await linkStudent(env.DB, { id: `u-${unique()}`, email, emailVerified: false });
    expect(result).toEqual({ status: "unverified" });
    expect((await studentByEmail(email))?.user_id).toBeNull();
    const fresh = `unverified-new-${unique()}@example.lk`;
    await linkStudent(env.DB, { id: `u-${unique()}`, email: fresh, emailVerified: false });
    expect(await studentByEmail(fresh)).toBeNull();
  });

  it("linkStudent refuses a row that belongs to a different user", async () => {
    const email = `taken-${unique()}@example.lk`;
    const owner = `u-${unique()}`;
    await linkStudent(env.DB, { id: owner, email, emailVerified: true });
    const result = await linkStudent(env.DB, { id: `u-${unique()}`, email, emailVerified: true });
    expect(result).toEqual({ status: "conflict" });
    expect((await studentByEmail(email))?.user_id).toBe(owner);
  });

  it("linkStudent reports a conflict when the user is already linked under another email", async () => {
    const userId = `u-${unique()}`;
    await linkStudent(env.DB, {
      id: userId,
      email: `old-${unique()}@example.lk`,
      emailVerified: true,
    });
    const result = await linkStudent(env.DB, {
      id: userId,
      email: `new-${unique()}@example.lk`,
      emailVerified: true,
    });
    expect(result).toEqual({ status: "conflict" });
  });
});

describe("requireStudent with a given session", () => {
  // A stand-in for Better Auth's getSession, so the verified flag can be chosen.
  function appFor(user: { id: string; email: string; name: string; emailVerified: boolean }) {
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("auth", { api: { getSession: async () => ({ user }) } } as never);
      await next();
    });
    app.get("/x", requireStudent, (c) => c.json(c.var.student));
    return app;
  }
  const run = (user: Parameters<typeof appFor>[0]) =>
    appFor(user).fetch(new Request("https://learn.test/x"), env);

  it("answers 403 email_not_verified and links nothing for an unverified user", async () => {
    const email = `rs-unverified-${unique()}@example.lk`;
    const res = await run({ id: `u-${unique()}`, email, name: "", emailVerified: false });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "email_not_verified" });
    expect(await studentByEmail(email)).toBeNull();
  });

  it("links and answers 200 for a verified user", async () => {
    const email = `rs-ok-${unique()}@example.lk`;
    const id = `u-${unique()}`;
    const res = await run({ id, email, name: "", emailVerified: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ userId: id, email });
    expect((await studentByEmail(email))?.user_id).toBe(id);
  });

  it("answers 409 when the email's student row belongs to another user", async () => {
    const email = `rs-taken-${unique()}@example.lk`;
    await linkStudent(env.DB, { id: `u-${unique()}`, email, emailVerified: true });
    const res = await run({ id: `u-${unique()}`, email, name: "", emailVerified: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "account_conflict" });
  });

  it("keeps serving a linked user whose email has changed", async () => {
    const id = `u-${unique()}`;
    await linkStudent(env.DB, { id, email: `rs-old-${unique()}@example.lk`, emailVerified: true });
    const res = await run({
      id,
      email: `rs-new-${unique()}@example.lk`,
      name: "",
      emailVerified: true,
    });
    expect(res.status).toBe(200);
  });
});

describe("rate limits", () => {
  it("allows 3 code requests per 10 minutes per IP, then answers 429", async () => {
    const t = setup();
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await t.sendCode(`rl-${unique()}@example.lk`, ip)).status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(t.sent).toHaveLength(3);
  });

  it("ignores x-forwarded-for, which a client can set", async () => {
    const t = setup();
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await t.call("/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        body: JSON.stringify({ email: `xff-${unique()}@example.lk`, type: "sign-in" }),
        ip,
        extra: { "x-forwarded-for": `10.9.${i}.${i + 1}` },
      });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it("caps sends to one address at 5 per hour across IPs", async () => {
    const t = setup();
    const email = `flood-${unique()}@example.lk`;
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await t.sendCode(i % 2 ? email.toUpperCase() : email, freshIp())).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(t.sent).toHaveLength(5);
    const rows = await env.DB.prepare(
      "SELECT key FROM rate_limits WHERE key LIKE 'otp-email:%'",
    ).all<{ key: string }>();
    expect(rows.results.length).toBeGreaterThan(0);
    for (const { key } of rows.results) expect(key).not.toContain("flood-");
  });

  it("answers 429 the same way for an address with no account", async () => {
    const t = setup();
    const email = `ghost-${unique()}@example.lk`;
    let last: Response | undefined;
    for (let i = 0; i < 6; i++) last = await t.sendCode(email, freshIp());
    expect(last!.status).toBe(429);
    expect(await last!.json()).toEqual({ message: "Too many requests. Please try again later." });
  });

  it("refuses a 4th guess on one code even if it is the right one", async () => {
    const t = setup();
    const email = `guess-${unique()}@example.lk`;
    await t.sendCode(email);
    const real = t.sent[0]!.code;
    const wrong = real === "000000" ? "111111" : "000000";
    for (let i = 0; i < 3; i++) expect((await t.signIn(email, wrong)).status).toBe(400);
    const res = await t.signIn(email, real);
    expect(res.status).toBe(403);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("does not count another IP against the limit", async () => {
    const t = setup();
    const res = await t.sendCode(`other-${unique()}@example.lk`, freshIp());
    expect(res.status).toBe(200);
  });

  it("limits code checks to 10 per 10 minutes per IP", async () => {
    const t = setup();
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await t.signIn(`nobody-${unique()}@example.lk`, "123456", ip)).status);
    }
    expect(statuses.slice(0, 10).every((s) => s !== 429)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("stores the counters in D1", async () => {
    const t = setup();
    await t.sendCode(`stored-${unique()}@example.lk`);
    const row = await env.DB.prepare(
      "SELECT count(*) AS n FROM rate_limits WHERE key LIKE '%|/email-otp/send-verification-otp'",
    ).first<{ n: number }>();
    expect(row!.n).toBeGreaterThan(0);
  });
});

describe("mailers", () => {
  it("the console mailer logs a masked address, never the full one", async () => {
    const lines: string[] = [];
    await createConsoleMailer((l) => lines.push(l)).sendLoginCode(
      "kasun.perera@gmail.com",
      "123456",
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("k***@gmail.com");
    expect(lines[0]).not.toContain("kasun.perera");
  });

  it("MAIL_DRIVER=cloudflare throws 'not configured' until Q6 is answered", async () => {
    const mailer = mailerFromEnv({ MAIL_DRIVER: "cloudflare", BETTER_AUTH_URL: ORIGIN } as never);
    await expect(mailer.sendLoginCode("a@b.lk", "123456")).rejects.toThrow(/not configured/);
  });

  it("refuses the console driver on a public https host", () => {
    expect(() =>
      mailerFromEnv({ MAIL_DRIVER: "console", BETTER_AUTH_URL: "https://learn.englishwind.lk" }),
    ).toThrow(/public host/);
    expect(() =>
      mailerFromEnv({ MAIL_DRIVER: "console", BETTER_AUTH_URL: "http://localhost:5173" }),
    ).not.toThrow();
  });
});
