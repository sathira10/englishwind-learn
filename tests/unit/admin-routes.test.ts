import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import type { AdminOrder, AuditEntry, StudentDetail } from "../../src/shared/admin";
import { createKeyProvider, type Jwk } from "../../src/worker/admin/access";
import { attachOrder } from "../../src/worker/admin/repo";
import { createPendingOrder } from "../../src/worker/orders/repo";
import { createAdmin } from "../../src/worker/routes/admin";

// Plan 09 (admin API). Real D1; Access tokens are signed with a generated RSA key the way
// tests/unit/admin-access.test.ts does. These cases mirror plan 09's reference table (R1 to R11)
// pending Sathira's copy in tests/reference/ (Q10).

const TEAM = "ew-test.cloudflareaccess.com";
const AUD = "aud-tag-123";
const NOW_MS = Date.now();
const NOW_S = Math.floor(NOW_MS / 1000);
const ORIGIN = "https://learn.test";
const bindings = { ...env, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } as unknown as Env;
const DB = env.DB;

const RSA = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

function b64url(input: string | ArrayBuffer) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

let privateKey: CryptoKey;
let jwk: Jwk;

async function tokenFor(email: string) {
  const payload = { aud: [AUD], iss: `https://${TEAM}`, exp: NOW_S + 3600, iat: NOW_S - 10, email };
  const input = `${b64url(JSON.stringify({ alg: "RS256", kid: "k1" }))}.${b64url(JSON.stringify(payload))}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(input),
  );
  return `${input}.${b64url(sig)}`;
}

function app() {
  const keys = createKeyProvider(
    async () => [jwk],
    () => NOW_MS,
  );
  return createAdmin({ keys });
}

const admin = app();

interface CallOptions {
  as?: string | null; // staff email; null = no token
  body?: unknown;
  raw?: string;
  headers?: Record<string, string | null>; // null removes a default header
}

async function call(method: string, path: string, options: CallOptions = {}) {
  const headers = new Headers();
  const as = options.as === undefined ? "amma@example.com" : options.as;
  if (as) headers.set("Cf-Access-Jwt-Assertion", await tokenFor(as));
  if (method !== "GET") {
    headers.set("origin", ORIGIN);
    headers.set("content-type", "application/json");
  }
  for (const [k, v] of Object.entries(options.headers ?? {})) {
    if (v === null) headers.delete(k);
    else headers.set(k, v);
  }
  const body =
    method === "GET"
      ? undefined
      : (options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body)));
  return admin.fetch(new Request(`${ORIGIN}${path}`, { method, headers, body }), bindings);
}

const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T;

let n = 0;
const email = () => `buyer${++n}-${NOW_MS}@example.com`;

async function pendingOrder(offerId = "blueprint", buyerEmail = email()) {
  const created = await createPendingOrder(DB, {
    offerId,
    name: "Kasun Perera",
    email: buyerEmail,
    phone: "+94 77 123 4567",
  });
  if (!created.ok) throw new Error("seed failed");
  return created.value.order;
}

async function student(name = "Nimali Silva", studentEmail = email(), phone: string | null = null) {
  const id = crypto.randomUUID();
  await DB.prepare(
    "INSERT INTO students (id, email, name, phone, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, studentEmail, name, phone, NOW_MS)
    .run();
  return { id, email: studentEmail };
}

async function insertGrant(studentId: string, endsAt: number, startsAt = NOW_MS - 86_400_000) {
  const id = crypto.randomUUID();
  await DB.prepare(
    `INSERT INTO grants (id, student_id, course_id, starts_at, ends_at, created_by, created_at)
     VALUES (?, ?, 'blueprint', ?, ?, 'seed', ?)`,
  )
    .bind(id, studentId, startsAt, endsAt, NOW_MS)
    .run();
  return id;
}

const count = async (sql: string, ...binds: unknown[]) =>
  (await DB.prepare(sql)
    .bind(...binds)
    .first<{ n: number }>())!.n;
const auditCount = (action: string, entityId: string) =>
  count("SELECT count(*) AS n FROM audit_log WHERE action = ? AND entity_id = ?", action, entityId);

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(RSA, true, ["sign", "verify"])) as CryptoKeyPair;
  privateKey = pair.privateKey;
  jwk = {
    ...(await crypto.subtle.exportKey("jwk", pair.publicKey)),
    kid: "k1",
    alg: "RS256",
  } as Jwk;
  await DB.batch([
    DB.prepare("INSERT INTO staff_roles (email, role, created_at) VALUES (?, 'owner', ?)").bind(
      "amma@example.com",
      NOW_MS,
    ),
    DB.prepare("INSERT INTO staff_roles (email, role, created_at) VALUES (?, 'admin', ?)").bind(
      "helper@example.com",
      NOW_MS,
    ),
  ]);
});

// ---- R1, R2: the gate ----

const ROUTES: [string, string, unknown?][] = [
  ["GET", "/me"],
  ["GET", "/offers"],
  ["GET", "/courses"],
  ["GET", "/orders"],
  [
    "POST",
    "/orders",
    { offer: "blueprint", name: "A", email: "a@example.com", phone: "0771234567" },
  ],
  ["POST", "/orders/x/approve", {}],
  ["POST", "/orders/x/reject", {}],
  ["POST", "/orders/x/attach", { studentId: "y" }],
  ["GET", "/students?q=nim"],
  ["GET", "/students/x"],
  ["POST", "/students/x/grants", { courseId: "blueprint" }],
  ["POST", "/grants/x/extend", { years: 1 }],
  ["POST", "/grants/x/revoke", { reason: "r" }],
  ["GET", "/audit"],
];

describe("every admin route is staff only (R1)", () => {
  it.each(ROUTES)("%s %s refuses a request with no token", async (method, path, body) => {
    const res = await call(method, path, { as: null, body });
    expect(res.status).toBe(401);
    expect(await json(res)).toEqual({ error: "unauthorized" });
  });

  it.each(ROUTES)("%s %s refuses a verified non-staff email", async (method, path, body) => {
    const res = await call(method, path, { as: "stranger@example.com", body });
    expect(res.status).toBe(403);
    expect(await json(res)).toEqual({ error: "forbidden" });
  });

  it("answers 401 before the CSRF checks, so a bad Origin does not reveal anything either", async () => {
    const res = await call("POST", "/orders/x/approve", {
      as: null,
      headers: { origin: "https://evil.example", "content-type": "text/plain" },
    });
    expect(res.status).toBe(401);
  });

  it("search gives non-staff nothing, even for a name that exists", async () => {
    const s = await student("Leaky Person", `leaky-${NOW_MS}@example.com`);
    for (const as of [null, "stranger@example.com"]) {
      const res = await call("GET", "/students?q=leaky", { as });
      const text = await res.text();
      expect(res.status).toBe(as ? 403 : 401);
      expect(text).not.toContain("Leaky");
      expect(text).not.toContain(s.email);
    }
    const staff = await call("GET", "/students?q=leaky");
    expect((await json<{ students: unknown[] }>(staff)).students).toHaveLength(1);
  });

  it("lets both roles in", async () => {
    expect((await call("GET", "/me", { as: "helper@example.com" })).status).toBe(200);
  });
});

describe("CSRF guard on state-changing routes (R2)", () => {
  const body = {
    offer: "blueprint",
    name: "Csrf Buyer",
    email: "csrf@example.com",
    phone: "0771234567",
  };

  it.each([
    ["text/plain", 415],
    ["application/x-www-form-urlencoded", 415],
    ["multipart/form-data; boundary=x", 415],
  ])("refuses content type %s", async (type, status) => {
    const before = await count("SELECT count(*) AS n FROM orders");
    const res = await call("POST", "/orders", { body, headers: { "content-type": type } });
    expect(res.status).toBe(status);
    expect(await count("SELECT count(*) AS n FROM orders")).toBe(before);
  });

  it("refuses a request with no content type", async () => {
    const res = await call("POST", "/orders", { body, headers: { "content-type": null } });
    expect(res.status).toBe(415);
  });

  it.each([
    ["no Origin", null],
    ["another Origin", "https://evil.example"],
    ["a look-alike Origin", `${ORIGIN}.evil.example`],
    ["the same host over http", "http://learn.test"],
    ["Origin null", "null"],
  ])("refuses %s", async (_name, origin) => {
    const before = await count("SELECT count(*) AS n FROM orders");
    const res = await call("POST", "/orders", { body, headers: { origin } });
    expect(res.status).toBe(403);
    expect(await count("SELECT count(*) AS n FROM orders")).toBe(before);
  });

  it("refuses a state change that would otherwise work", async () => {
    const order = await pendingOrder();
    const res = await call("POST", `/orders/${order.id}/approve`, {
      body: {},
      headers: { origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect(await count("SELECT count(*) AS n FROM grants WHERE order_id = ?", order.id)).toBe(0);
  });

  it("accepts a JSON type with a charset", async () => {
    const res = await call("POST", "/orders", {
      body: { ...body, email: email() },
      headers: { "content-type": "application/json; charset=utf-8" },
    });
    expect(res.status).toBe(201);
  });
});

// ---- Orders ----

describe("orders", () => {
  it("lists pending orders oldest first with the fields the queue shows", async () => {
    const a = await pendingOrder();
    const res = await call("GET", "/orders");
    const { orders } = await json<{ orders: Record<string, unknown>[] }>(res);
    const row = orders.find((o) => o.id === a.id)!;
    expect(row).toMatchObject({
      reference: a.reference,
      amountCents: 1_000_000,
      buyerName: "Kasun Perera",
      buyerPhone: "+94 77 123 4567",
      offerLabel: "Blueprint",
      needsStaffCheck: false,
      status: "pending",
    });
    const times = orders.map((o) => o.createdAt as number);
    expect(times).toEqual([...times].sort((x, y) => x - y));
  });

  it("shows the linked student, and none when the order is not linked", async () => {
    const s = await student("Linked Person", `linked-${NOW_MS}@example.com`);
    const linked = await pendingOrder("blueprint", email());
    const plain = await pendingOrder("blueprint", email());
    await call("POST", `/orders/${linked.id}/attach`, { body: { studentId: s.id } });
    const { orders } = await json<{ orders: AdminOrder[] }>(await call("GET", "/orders"));
    expect(orders.find((o) => o.id === linked.id)?.student).toEqual({
      id: s.id,
      name: "Linked Person",
      email: s.email,
    });
    expect(orders.find((o) => o.id === plain.id)?.student).toBeNull();
  });

  it("rejects an unknown status filter", async () => {
    expect((await call("GET", "/orders?status=bogus")).status).toBe(422);
  });

  it("approve creates exactly one grant and one audit row, and a second approve adds nothing (R3)", async () => {
    const order = await pendingOrder();
    const first = await call("POST", `/orders/${order.id}/approve`, { body: {} });
    expect(first.status).toBe(200);
    const firstBody = await json<{ granted: boolean; order: { status: string } }>(first);
    expect(firstBody).toMatchObject({ granted: true, order: { status: "approved" } });

    const second = await call("POST", `/orders/${order.id}/approve`, { body: {} });
    expect(second.status).toBe(200);
    expect((await json<{ granted: boolean }>(second)).granted).toBe(false);

    expect(await count("SELECT count(*) AS n FROM grants WHERE order_id = ?", order.id)).toBe(1);
    expect(await auditCount("order.approve", order.id)).toBe(1);
    const grant = (await DB.prepare(
      "SELECT starts_at, ends_at, created_by FROM grants WHERE order_id = ?",
    )
      .bind(order.id)
      .first<{ starts_at: number; ends_at: number; created_by: string }>())!;
    expect(new Date(grant.ends_at + 19_800_000).getUTCFullYear()).toBe(
      new Date(grant.starts_at + 19_800_000).getUTCFullYear() + 3,
    );
    expect(grant.created_by).toBe("amma@example.com");
  });

  it("approves with no body at all", async () => {
    const order = await pendingOrder();
    const res = await call("POST", `/orders/${order.id}/approve`);
    expect(res.status).toBe(200);
  });

  it("makes the buyer a student with a current grant", async () => {
    const buyer = email();
    const order = await pendingOrder("blueprint", buyer);
    await call("POST", `/orders/${order.id}/approve`, { body: {} });
    const row = await DB.prepare(
      `SELECT g.ends_at FROM grants g JOIN students s ON s.id = g.student_id WHERE s.email = ?`,
    )
      .bind(buyer)
      .first<{ ends_at: number }>();
    expect(row!.ends_at).toBeGreaterThan(Date.now());
  });

  it("needs the explicit staffChecked field for a class offer (R4)", async () => {
    const order = await pendingOrder("blueprint-class-monthly");
    const refused = await call("POST", `/orders/${order.id}/approve`, { body: {} });
    expect(refused.status).toBe(409);
    expect(await json(refused)).toEqual({ error: "staff_check_required" });

    // Look-alike values do not count.
    for (const staffChecked of ["true", 1, "yes"]) {
      const res = await call("POST", `/orders/${order.id}/approve`, { body: { staffChecked } });
      expect(res.status).toBe(422);
    }
    const unknownKey = await call("POST", `/orders/${order.id}/approve`, {
      body: { staff_checked: true, checked: true },
    });
    expect(unknownKey.status).toBe(422);
    const falseFlag = await call("POST", `/orders/${order.id}/approve`, {
      body: { staffChecked: false },
    });
    expect(falseFlag.status).toBe(409);
    expect(await count("SELECT count(*) AS n FROM grants WHERE order_id = ?", order.id)).toBe(0);
    expect(
      (await DB.prepare("SELECT status FROM orders WHERE id = ?")
        .bind(order.id)
        .first<{ status: string }>())!.status,
    ).toBe("pending");

    const ok = await call("POST", `/orders/${order.id}/approve`, { body: { staffChecked: true } });
    expect(ok.status).toBe(200);
    expect(await auditCount("order.approve", order.id)).toBe(1);
    const data = await DB.prepare(
      "SELECT data_json FROM audit_log WHERE action = 'order.approve' AND entity_id = ?",
    )
      .bind(order.id)
      .first<{ data_json: string }>();
    expect(JSON.parse(data!.data_json)).toMatchObject({ staffChecked: true });
  });

  it("answers 404 for an unknown order", async () => {
    expect((await call("POST", "/orders/nope/approve", { body: {} })).status).toBe(404);
    expect((await call("POST", "/orders/nope/reject", { body: {} })).status).toBe(404);
  });

  it("rejects with an optional reason, once, and then refuses to approve", async () => {
    const order = await pendingOrder();
    const res = await call("POST", `/orders/${order.id}/reject`, {
      body: { reason: "Transfer not found" },
    });
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({
      order: { status: "rejected", note: "Transfer not found" },
    });
    await call("POST", `/orders/${order.id}/reject`, { body: {} });
    expect(await auditCount("order.reject", order.id)).toBe(1);

    const approve = await call("POST", `/orders/${order.id}/approve`, { body: {} });
    expect(approve.status).toBe(409);
    expect(await json(approve)).toEqual({ error: "rejected" });
    expect(await count("SELECT count(*) AS n FROM grants WHERE order_id = ?", order.id)).toBe(0);
  });

  it("rejects without a reason, and refuses to reject an approved order", async () => {
    const a = await pendingOrder();
    expect((await call("POST", `/orders/${a.id}/reject`)).status).toBe(200);
    const b = await pendingOrder();
    await call("POST", `/orders/${b.id}/approve`, { body: {} });
    const res = await call("POST", `/orders/${b.id}/reject`, { body: {} });
    expect(res.status).toBe(409);
    expect(await json(res)).toEqual({ error: "already_approved" });
  });

  it("rejects an over-long reason and bad JSON", async () => {
    const order = await pendingOrder();
    const long = await call("POST", `/orders/${order.id}/reject`, {
      body: { reason: "x".repeat(501) },
    });
    expect(long.status).toBe(422);
    const bad = await call("POST", `/orders/${order.id}/reject`, { raw: "{nope" });
    expect(bad.status).toBe(400);
  });

  it("creates a manual order at the offer's price with one audit row (R10)", async () => {
    const buyer = email();
    const res = await call("POST", "/orders", {
      body: {
        offer: "blueprint",
        name: "Phone Buyer",
        email: buyer,
        phone: "0771234567",
        amountCents: 1,
      },
    });
    // amountCents is not a field: the strict body of the public form drops it, ours too.
    expect(res.status).toBe(201);
    const { order } = await json<{
      order: { id: string; amountCents: number; reference: string; status: string };
    }>(res);
    expect(order).toMatchObject({ amountCents: 1_000_000, status: "pending" });
    expect(order.reference).toMatch(/^EW-/);
    expect(await auditCount("order.create_manual", order.id)).toBe(1);
  });

  it("refuses a manual order for an unknown offer or bad fields, writing nothing", async () => {
    const before = await count(
      "SELECT count(*) AS n FROM audit_log WHERE action = 'order.create_manual'",
    );
    const missing = await call("POST", "/orders", {
      body: { offer: "nope", name: "A", email: email(), phone: "0771234567" },
    });
    expect(missing.status).toBe(404);
    const bad = await call("POST", "/orders", {
      body: { offer: "blueprint", name: "", email: "x", phone: "0771234567" },
    });
    expect(bad.status).toBe(422);
    expect(Object.keys((await json<{ fields: object }>(bad)).fields)).toEqual(["name", "email"]);
    expect(
      await count("SELECT count(*) AS n FROM audit_log WHERE action = 'order.create_manual'"),
    ).toBe(before);
  });

  it("attaches a pending order to a student, and approving then grants that student (R9)", async () => {
    const s = await student();
    const order = await pendingOrder("blueprint", email()); // a different email
    const buyerEmail = (await DB.prepare("SELECT buyer_email FROM orders WHERE id = ?")
      .bind(order.id)
      .first<{ buyer_email: string }>())!.buyer_email;
    const attach = await call("POST", `/orders/${order.id}/attach`, { body: { studentId: s.id } });
    expect(attach.status).toBe(200);
    expect(await auditCount("order.attach", order.id)).toBe(1);

    await call("POST", `/orders/${order.id}/approve`, { body: {} });
    const grant = await DB.prepare("SELECT student_id FROM grants WHERE order_id = ?")
      .bind(order.id)
      .first<{ student_id: string }>();
    expect(grant!.student_id).toBe(s.id);
    expect(await count("SELECT count(*) AS n FROM students WHERE email = ?", buyerEmail)).toBe(0);
  });

  it("answers conflict, with no audit row, when the order is decided during the attach", async () => {
    const s = await student();
    const order = await pendingOrder();
    // Rejects the order just before the attach batch runs, as a second tab could.
    const racing = new Proxy(DB, {
      get(target, prop) {
        if (prop === "batch") {
          return async (statements: D1PreparedStatement[]) => {
            await DB.prepare("UPDATE orders SET status = 'rejected' WHERE id = ?")
              .bind(order.id)
              .run();
            return target.batch(statements);
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const result = await attachOrder(racing, order.id, s.id, "amma@example.com");
    expect(result).toEqual({ ok: false, error: "conflict" });
    expect(await auditCount("order.attach", order.id)).toBe(0);
  });

  it("refuses to attach an approved order, an unknown order or an unknown student", async () => {
    const s = await student();
    const approved = await pendingOrder();
    await call("POST", `/orders/${approved.id}/approve`, { body: {} });
    const res = await call("POST", `/orders/${approved.id}/attach`, { body: { studentId: s.id } });
    expect(res.status).toBe(409);
    expect(await auditCount("order.attach", approved.id)).toBe(0);

    expect((await call("POST", "/orders/nope/attach", { body: { studentId: s.id } })).status).toBe(
      404,
    );
    const pending = await pendingOrder();
    const ghost = await call("POST", `/orders/${pending.id}/attach`, {
      body: { studentId: "ghost" },
    });
    expect(ghost.status).toBe(404);
    expect(await json(ghost)).toEqual({ error: "student_not_found" });
  });
});

// ---- Students ----

describe("student search and detail", () => {
  it("matches email, name and phone, case-insensitively", async () => {
    const tag = `zq${NOW_MS}`;
    const s = await student(`Tharindu ${tag}`, `t.${tag}@example.com`, "+94 71 555 0199");
    for (const q of [tag.toUpperCase(), `T.${tag}@Example`, "071 555", "+94 71 555 0199"]) {
      const found = await json<{ students: { id: string }[] }>(
        await call("GET", `/students?q=${encodeURIComponent(q)}`),
      );
      // "071 555" is not a substring of the stored phone; the other three are.
      if (q === "071 555") expect(found.students.some((x) => x.id === s.id)).toBe(false);
      else expect(found.students.map((x) => x.id)).toContain(s.id);
    }
  });

  it("treats % and _ literally (R11)", async () => {
    await student("Plain Name", `plain-${NOW_MS}@example.com`);
    const wild = await json<{ students: unknown[] }>(await call("GET", "/students?q=%25%25"));
    expect(wild.students).toHaveLength(0);
    const under = await json<{ students: unknown[] }>(await call("GET", "/students?q=__"));
    expect(under.students).toHaveLength(0);
    const literal = await student("Under_score Person", `us-${NOW_MS}@example.com`);
    const hit = await json<{ students: { id: string }[] }>(await call("GET", "/students?q=r_s"));
    expect(hit.students.map((x) => x.id)).toContain(literal.id);
  });

  it("asks for at least two characters", async () => {
    expect((await call("GET", "/students?q=a")).status).toBe(422);
    expect((await call("GET", "/students")).status).toBe(422);
  });

  it("returns grants, orders and a progress summary", async () => {
    const s = await student();
    const grantId = await insertGrant(s.id, NOW_MS + 86_400_000 * 365);
    const linked = await pendingOrder("blueprint", s.email);
    const unlinked = await pendingOrder("blueprint", s.email.toUpperCase());
    await DB.batch([
      DB.prepare("UPDATE orders SET student_id = NULL WHERE id = ?").bind(unlinked.id),
      DB.prepare(
        `INSERT INTO lesson_progress (student_id, course_id, lesson_key, completed_at, last_visited_at)
         VALUES (?1, 'blueprint', 'a', ?2, ?3), (?1, 'blueprint', 'b', ?2, ?4), (?1, 'blueprint', 'c', NULL, ?5)`,
      ).bind(s.id, 1000, 2000, 3000, 4000),
    ]);
    const res = await call("GET", `/students/${s.id}`);
    expect(res.status).toBe(200);
    const detail = await json<StudentDetail>(res);
    expect(detail.student).toMatchObject({ id: s.id, email: s.email });
    expect(detail.grants).toMatchObject([
      { id: grantId, courseTitle: "Blueprint", state: "current" },
    ]);
    expect(detail.orders.map((o: { id: string }) => o.id).sort()).toEqual(
      [linked.id, unlinked.id].sort(),
    );
    expect(detail.progress).toEqual([
      { courseId: "blueprint", courseTitle: "Blueprint", completedLessons: 2, lastVisitedAt: 4000 },
    ]);
  });

  it("answers 404 for an unknown student", async () => {
    expect((await call("GET", "/students/nope")).status).toBe(404);
  });
});

// ---- Grants ----

describe("grants", () => {
  it("creates a manual grant for the course's period with one audit row", async () => {
    const s = await student();
    const res = await call("POST", `/students/${s.id}/grants`, { body: { courseId: "blueprint" } });
    expect(res.status).toBe(201);
    const { grant } = await json<{
      grant: { id: string; startsAt: number; endsAt: number; orderId: null; state: string };
    }>(res);
    expect(grant.orderId).toBeNull();
    expect(grant.state).toBe("current");
    expect(new Date(grant.endsAt + 19_800_000).getUTCFullYear()).toBe(
      new Date(grant.startsAt + 19_800_000).getUTCFullYear() + 3,
    );
    expect(await auditCount("grant.create", grant.id)).toBe(1);
  });

  it("takes whole years when given, and refuses other values", async () => {
    const s = await student();
    const res = await call("POST", `/students/${s.id}/grants`, {
      body: { courseId: "blueprint", years: 1 },
    });
    const { grant } = await json<{ grant: { startsAt: number; endsAt: number } }>(res);
    expect(new Date(grant.endsAt + 19_800_000).getUTCFullYear()).toBe(
      new Date(grant.startsAt + 19_800_000).getUTCFullYear() + 1,
    );
    const other = await student();
    for (const years of [0, -1, 1.5, "2", 11]) {
      const bad = await call("POST", `/students/${other.id}/grants`, {
        body: { courseId: "blueprint", years },
      });
      expect(bad.status).toBe(422);
    }
  });

  it("refuses a second current grant for the same course (R8)", async () => {
    const s = await student();
    await insertGrant(s.id, NOW_MS + 1_000_000_000);
    const res = await call("POST", `/students/${s.id}/grants`, { body: { courseId: "blueprint" } });
    expect(res.status).toBe(409);
    expect(await json(res)).toEqual({ error: "already_has_access" });
    expect(await count("SELECT count(*) AS n FROM grants WHERE student_id = ?", s.id)).toBe(1);
  });

  it("allows a new grant once the old one ended or was revoked", async () => {
    const ended = await student();
    await insertGrant(ended.id, NOW_MS - 1000, NOW_MS - 1_000_000);
    expect(
      (await call("POST", `/students/${ended.id}/grants`, { body: { courseId: "blueprint" } }))
        .status,
    ).toBe(201);

    const revoked = await student();
    const id = await insertGrant(revoked.id, NOW_MS + 1_000_000_000);
    await call("POST", `/grants/${id}/revoke`, { body: { reason: "Refunded" } });
    expect(
      (await call("POST", `/students/${revoked.id}/grants`, { body: { courseId: "blueprint" } }))
        .status,
    ).toBe(201);
  });

  it("answers 404 for an unknown student or course", async () => {
    const s = await student();
    expect(
      (await call("POST", "/students/nope/grants", { body: { courseId: "blueprint" } })).status,
    ).toBe(404);
    expect(
      (await call("POST", `/students/${s.id}/grants`, { body: { courseId: "nope" } })).status,
    ).toBe(404);
  });

  it("extends from the current end by whole years and writes one audit row (R5)", async () => {
    const s = await student();
    const endsAt = Date.UTC(2099, 11, 1, 0, 0, 0);
    const id = await insertGrant(s.id, endsAt);
    const res = await call("POST", `/grants/${id}/extend`, { body: { years: 1 } });
    expect(res.status).toBe(200);
    const { grant } = await json<{ grant: { endsAt: number } }>(res);
    expect(grant.endsAt).toBe(Date.UTC(2100, 11, 1, 0, 0, 0));
    expect(await auditCount("grant.extend", id)).toBe(1);
  });

  it("extends an ended grant from now, not from its old end", async () => {
    const s = await student();
    const id = await insertGrant(s.id, NOW_MS - 365 * 86_400_000, NOW_MS - 3 * 365 * 86_400_000);
    const res = await call("POST", `/grants/${id}/extend`, { body: { years: 1 } });
    const { grant } = await json<{ grant: { endsAt: number; state: string } }>(res);
    expect(grant.state).toBe("current");
    const oneYear = 365 * 86_400_000;
    expect(grant.endsAt).toBeGreaterThanOrEqual(Date.now() + oneYear - 2 * 86_400_000);
    expect(grant.endsAt).toBeLessThanOrEqual(Date.now() + oneYear + 2 * 86_400_000);
  });

  it("refuses to extend a revoked grant (R6) and bad years", async () => {
    const s = await student();
    const id = await insertGrant(s.id, NOW_MS + 1_000_000_000);
    await call("POST", `/grants/${id}/revoke`, { body: { reason: "Chargeback" } });
    const before = await DB.prepare("SELECT ends_at FROM grants WHERE id = ?")
      .bind(id)
      .first<{ ends_at: number }>();
    const res = await call("POST", `/grants/${id}/extend`, { body: { years: 1 } });
    expect(res.status).toBe(409);
    expect(await json(res)).toEqual({ error: "revoked" });
    const after = await DB.prepare("SELECT ends_at FROM grants WHERE id = ?")
      .bind(id)
      .first<{ ends_at: number }>();
    expect(after!.ends_at).toBe(before!.ends_at);
    expect(await auditCount("grant.extend", id)).toBe(0);

    const other = await insertGrant((await student()).id, NOW_MS + 1_000_000_000);
    for (const years of [0, 0.5, "1", 11, null]) {
      expect((await call("POST", `/grants/${other}/extend`, { body: { years } })).status).toBe(422);
    }
    expect((await call("POST", "/grants/nope/extend", { body: { years: 1 } })).status).toBe(404);
  });

  it("revokes with a reason, keeps the first revocation, and writes one audit row (R7)", async () => {
    const s = await student();
    const id = await insertGrant(s.id, NOW_MS + 1_000_000_000);
    const first = await call("POST", `/grants/${id}/revoke`, { body: { reason: "Refunded" } });
    expect(first.status).toBe(200);
    const one = (
      await json<{
        grant: { revokedAt: number; reason: string; revokedBy: string; state: string };
      }>(first)
    ).grant;
    expect(one).toMatchObject({
      reason: "Refunded",
      revokedBy: "amma@example.com",
      state: "revoked",
    });

    const second = await call("POST", `/grants/${id}/revoke`, {
      body: { reason: "Something else" },
    });
    expect(second.status).toBe(200);
    const two = (await json<{ grant: { revokedAt: number; reason: string } }>(second)).grant;
    expect(two.revokedAt).toBe(one.revokedAt);
    expect(two.reason).toBe("Refunded");
    expect(await auditCount("grant.revoke", id)).toBe(1);
  });

  it("requires a reason to revoke", async () => {
    const id = await insertGrant((await student()).id, NOW_MS + 1_000_000_000);
    for (const body of [{}, { reason: "" }, { reason: "   " }, { reason: "x".repeat(501) }]) {
      expect((await call("POST", `/grants/${id}/revoke`, { body })).status).toBe(422);
    }
    expect((await call("POST", "/grants/nope/revoke", { body: { reason: "r" } })).status).toBe(404);
    expect(await auditCount("grant.revoke", id)).toBe(0);
  });
});

// ---- Offers, courses, audit log ----

describe("offers, courses and the audit log", () => {
  it("lists active offers and courses for the forms", async () => {
    const offers = await json<{ offers: { id: string; needsStaffCheck: boolean }[] }>(
      await call("GET", "/offers"),
    );
    expect(offers.offers.map((o) => o.id)).toEqual(
      expect.arrayContaining(["blueprint", "blueprint-class-monthly", "blueprint-class-full"]),
    );
    const courses = await json<{ courses: { id: string; accessYears: number }[] }>(
      await call("GET", "/courses"),
    );
    expect(courses.courses).toContainEqual({ id: "blueprint", title: "Blueprint", accessYears: 3 });
  });

  it("pages the audit log newest first without gaps or repeats", async () => {
    const total = await count("SELECT count(*) AS n FROM audit_log");
    expect(total).toBeGreaterThan(5);
    // Rows that share a timestamp must not be skipped across a page boundary.
    const ids: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res = await call(
        "GET",
        `/audit?limit=3${cursor ? `&before=${encodeURIComponent(cursor)}` : ""}`,
      );
      expect(res.status).toBe(200);
      const page: { entries: { id: string; at: number }[]; next: string | null } = await json(res);
      expect(page.entries.length).toBeLessThanOrEqual(3);
      ids.push(...page.entries.map((e) => e.id));
      cursor = page.next;
      pages++;
    } while (cursor && pages < 1000);
    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);

    const all = await DB.prepare("SELECT id FROM audit_log ORDER BY at DESC, id DESC").all<{
      id: string;
    }>();
    expect(ids).toEqual(all.results.map((r) => r.id));
  });

  it("returns the actor, action and parsed data", async () => {
    const order = await pendingOrder();
    await call("POST", `/orders/${order.id}/reject`, { body: { reason: "No transfer" } });
    const page = await json<{ entries: AuditEntry[] }>(await call("GET", "/audit?limit=100"));
    const entry = page.entries.find((e) => e.entityId === order.id)!;
    expect(entry).toMatchObject({
      actorEmail: "amma@example.com",
      action: "order.reject",
      entityType: "order",
      data: { hasReason: true },
    });
  });

  it("validates limit and cursor", async () => {
    for (const q of ["limit=0", "limit=101", "limit=abc", "before=garbage", "before=.x"]) {
      expect((await call("GET", `/audit?${q}`)).status).toBe(422);
    }
  });
});
