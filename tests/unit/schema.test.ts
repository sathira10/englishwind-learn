import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// Plan 01 (data model). Runs against real local D1 with migrations applied in tests/setup.ts.
// Foreign keys are on in D1, so rows are created parent first. Ids are unique per test because
// D1 state persists across tests in a file.

const db = env.DB;
const NOW = 1_793_836_800_000;

async function run(sql: string, ...binds: unknown[]) {
  return db
    .prepare(sql)
    .bind(...binds)
    .run();
}

async function student(id: string) {
  await run(
    "INSERT INTO students (id, email, name, created_at) VALUES (?, ?, 'Test', ?)",
    id,
    `${id}@example.com`,
    NOW,
  );
}

async function order(id: string, status = "pending") {
  await run(
    `INSERT INTO orders (id, reference, buyer_email, buyer_name, buyer_phone, offer_id,
       amount_cents, status, created_at)
     VALUES (?, ?, 'b@example.com', 'Buyer', '0770000000', 'blueprint', 1000000, ?, ?)`,
    id,
    `EW-${id}`,
    status,
    NOW,
  );
}

async function grant(id: string, studentId: string, orderId: string | null) {
  await run(
    `INSERT INTO grants (id, student_id, course_id, order_id, starts_at, ends_at, created_by, created_at)
     VALUES (?, ?, 'blueprint', ?, ?, ?, 'amma@example.com', ?)`,
    id,
    studentId,
    orderId,
    NOW,
    NOW + 1000,
    NOW,
  );
}

describe("schema", () => {
  it("creates every table", async () => {
    const { results } = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%'",
      )
      .all<{ name: string }>();
    const names = results.map((r) => r.name);
    for (const table of [
      "students",
      "courses",
      "course_publications",
      "resources",
      "offers",
      "orders",
      "grants",
      "lesson_progress",
      "staff_roles",
      "audit_log",
    ]) {
      expect(names).toContain(table);
    }
    // Auth tables (plan 03) sit beside them.
    for (const table of ["users", "sessions", "accounts", "verifications", "rate_limits"]) {
      expect(names).toContain(table);
    }
  });

  it("seeds the blueprint course with 3 years of access", async () => {
    const course = await db
      .prepare("SELECT id, access_years FROM courses WHERE id = 'blueprint'")
      .first();
    expect(course).toEqual({ id: "blueprint", access_years: 3 });
  });

  it("seeds the three offers with launch-plan prices in LKR cents", async () => {
    const { results } = await db
      .prepare(
        "SELECT id, course_id, price_cents, needs_staff_check, active FROM offers ORDER BY id",
      )
      .all();
    expect(results).toEqual([
      {
        id: "blueprint",
        course_id: "blueprint",
        price_cents: 1_000_000,
        needs_staff_check: 0,
        active: 1,
      },
      {
        id: "blueprint-class-full",
        course_id: "blueprint",
        price_cents: 0,
        needs_staff_check: 1,
        active: 1,
      },
      {
        id: "blueprint-class-monthly",
        course_id: "blueprint",
        price_cents: 200_000,
        needs_staff_check: 1,
        active: 1,
      },
    ]);
  });

  it("rejects a negative offer price", async () => {
    await expect(
      run(
        "INSERT INTO offers (id, course_id, label, price_cents, created_at) VALUES ('neg', 'blueprint', 'Neg', -1, ?)",
        NOW,
      ),
    ).rejects.toThrow(/CHECK constraint/i);
  });

  it("rejects an unknown order status", async () => {
    await expect(order("badstatus", "refunded")).rejects.toThrow(/CHECK constraint/i);
  });

  it("rejects a duplicate order reference", async () => {
    await order("dupref");
    await expect(
      run(
        `INSERT INTO orders (id, reference, buyer_email, buyer_name, buyer_phone, offer_id,
           amount_cents, created_at)
         VALUES ('dupref2', 'EW-dupref', 'b@example.com', 'B', '077', 'blueprint', 0, ?)`,
        NOW,
      ),
    ).rejects.toThrow(/UNIQUE constraint/i);
  });

  it("allows one grant per order and rejects a second (approve once)", async () => {
    await student("s-once");
    await order("o-once", "approved");
    await grant("g-once-1", "s-once", "o-once");
    await expect(grant("g-once-2", "s-once", "o-once")).rejects.toThrow(/UNIQUE constraint/i);
  });

  it("allows many grants without an order (manual grants)", async () => {
    await student("s-manual");
    await grant("g-manual-1", "s-manual", null);
    await grant("g-manual-2", "s-manual", null);
    const row = await db
      .prepare("SELECT COUNT(*) AS n FROM grants WHERE student_id = 's-manual'")
      .first<{ n: number }>();
    expect(row?.n).toBe(2);
  });

  it("enforces foreign keys", async () => {
    await expect(grant("g-orphan", "no-such-student", null)).rejects.toThrow(/FOREIGN KEY/i);
  });

  it("keeps student emails unique", async () => {
    await student("dupemail");
    await expect(
      run(
        "INSERT INTO students (id, email, name, created_at) VALUES ('dupemail2', 'dupemail@example.com', 'X', ?)",
        NOW,
      ),
    ).rejects.toThrow(/UNIQUE constraint/i);
  });

  it("only accepts the owner and admin staff roles", async () => {
    await run(
      "INSERT INTO staff_roles (email, role, created_at) VALUES ('a@example.com', 'owner', ?)",
      NOW,
    );
    await expect(
      run(
        "INSERT INTO staff_roles (email, role, created_at) VALUES ('b@example.com', 'root', ?)",
        NOW,
      ),
    ).rejects.toThrow(/CHECK constraint/i);
  });

  it("keeps one progress row per student, course and lesson", async () => {
    await student("s-prog");
    const insert = () =>
      run(
        "INSERT INTO lesson_progress (student_id, course_id, lesson_key) VALUES ('s-prog', 'blueprint', 'lesson-01')",
      );
    await insert();
    await expect(insert()).rejects.toThrow(/UNIQUE constraint|PRIMARY KEY/i);
  });

  it("keeps one publication per course version and one r2 key per resource", async () => {
    const publish = () =>
      run(
        "INSERT INTO course_publications (id, course_id, version, content_json, published_at, published_by) VALUES (?, 'blueprint', 1, '{}', ?, 'sathira@example.com')",
        crypto.randomUUID(),
        NOW,
      );
    await publish();
    await expect(publish()).rejects.toThrow(/UNIQUE constraint/i);

    const resource = () =>
      run(
        "INSERT INTO resources (id, course_id, lesson_key, kind, label, r2_key, content_type, bytes, created_at) VALUES (?, 'blueprint', 'lesson-01', 'worksheet', 'W', 'courses/blueprint/lesson-01.pdf', 'application/pdf', 10, ?)",
        crypto.randomUUID(),
        NOW,
      );
    await resource();
    await expect(resource()).rejects.toThrow(/UNIQUE constraint/i);
  });
});
