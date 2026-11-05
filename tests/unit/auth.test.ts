import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
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
  const call = (path: string, init: RequestInit & { cookie?: string; ip?: string } = {}) => {
    const { cookie, ip: ipOverride, ...rest } = init;
    return app.fetch(
      new Request(`${ORIGIN}${path}`, {
        ...rest,
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          "cf-connecting-ip": ipOverride ?? ip,
          ...(cookie ? { cookie } : {}),
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

  it("linkStudent is idempotent and keeps an existing link", async () => {
    const email = `idem-${unique()}@example.lk`;
    const first = await linkStudent(env.DB, { id: "user-a", email });
    const again = await linkStudent(env.DB, { id: "user-b", email: email.toUpperCase() });
    expect(again).toBe(first);
    expect((await studentByEmail(email))?.user_id).toBe("user-a");
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
