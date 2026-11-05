import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  colomboMidnight,
  importStatements,
  parseBuyersCsv,
  planGrants,
} from "../../src/domain/buyer-import";
import { colomboDate, hasAccess } from "../../src/domain/grants";
import { linkStudent } from "../../src/worker/auth/link-student";
import sample from "../fixtures/buyers-sample.csv?raw";

// The B-cases mirror the reference-case table in plans/12-buyer-import.md. They are unit tests
// until Sathira approves them and copies them to tests/reference/ (OPEN-QUESTIONS Q10).

const at = (colombo: string) => Date.parse(`${colombo}+05:30`);
const NOW = at("2026-11-05T12:00:00");
const opts = { courseId: "blueprint", accessYears: 3, now: NOW };
const HEADER = "email,name,phone,purchased_on,note\n";

function planOne(purchasedOn: string, now = NOW) {
  const parsed = parseBuyersCsv(`${HEADER}a@example.org,A,,${purchasedOn},\n`);
  expect(parsed.errors).toEqual([]);
  const plan = planGrants(parsed.rows, { ...opts, now });
  expect(plan.errors).toEqual([]);
  return plan.grants[0]!;
}

describe("plan 12 reference cases", () => {
  it("B1: 2026-03-14 starts at Colombo midnight, ends 2029-03-14 midnight", () => {
    const g = planOne("2026-03-14");
    expect(g.startsAt).toBe(Date.parse("2026-03-13T18:30:00Z"));
    expect(g.endsAt).toBe(Date.parse("2029-03-13T18:30:00Z"));
    expect(g.ended).toBe(false);
  });

  it("B2: 2025-12-31 ends 2028-12-31 Colombo", () => {
    const g = planOne("2025-12-31");
    expect(colomboDate(g.startsAt)).toBe("2025-12-31");
    expect(colomboDate(g.endsAt)).toBe("2028-12-31");
  });

  it("B3: 2024-02-29 ends 2027-03-01 (never shorter, Q12)", () => {
    const g = planOne("2024-02-29");
    expect(g.startsAt).toBe(Date.parse("2024-02-28T18:30:00Z"));
    expect(g.endsAt).toBe(Date.parse("2027-02-28T18:30:00Z"));
    expect(colomboDate(g.endsAt)).toBe("2027-03-01");
  });

  it("B4: 2028-02-29 (a future leap day is rejected, a past one is not)", () => {
    const parsed = parseBuyersCsv(`${HEADER}a@example.org,A,,2028-02-29,\n`);
    expect(planGrants(parsed.rows, opts).errors).toEqual([
      { line: 2, message: "purchased_on 2028-02-29 is in the future" },
    ]);
    const later = planGrants(parsed.rows, { ...opts, now: at("2028-03-01T09:00:00") });
    expect(colomboDate(later.grants[0]!.endsAt)).toBe("2031-03-01");
  });

  it("B5: 2026-01-01 is 2025-12-31 18:30Z (the UTC date differs from Colombo)", () => {
    const g = planOne("2026-01-01");
    expect(g.startsAt).toBe(Date.parse("2025-12-31T18:30:00Z"));
    expect(g.endsAt).toBe(Date.parse("2028-12-31T18:30:00Z"));
  });

  it("B6: access that has ended is flagged; the end instant itself is over", () => {
    const g = planOne("2023-11-05"); // ends 2026-11-05 00:00 Colombo
    expect(g.endsAt).toBe(at("2026-11-05T00:00:00"));
    expect(planOne("2023-11-05", at("2026-11-05T00:00:00")).ended).toBe(true);
    expect(planOne("2023-11-05", at("2026-11-04T23:59:59")).ended).toBe(false);
    expect(planOne("2020-01-15").ended).toBe(true);
    expect(planOne("2023-11-06").ended).toBe(false);
  });

  it("B7: duplicate emails, ignoring case and spaces, name the line of both", () => {
    const r = parseBuyersCsv(
      `${HEADER}a@example.org,A,,2026-01-02,\nb@example.org,B,,2026-01-03,\n  A@Example.ORG ,A again,,2026-01-04,\n`,
    );
    expect(r.rows.map((x) => x.email)).toEqual(["a@example.org", "b@example.org"]);
    expect(r.errors).toEqual([{ line: 4, message: "duplicate email, first seen on line 2" }]);
  });

  it("B8: bad and missing dates are errors with their line numbers", () => {
    const r = parseBuyersCsv(
      [
        HEADER.trim(),
        "a@example.org,A,,2026-02-30,",
        "b@example.org,B,,2026-13-01,",
        "c@example.org,C,,14/03/2026,",
        "d@example.org,D,,,",
        "e@example.org,E,,2026-3-4,",
        "f@example.org,F,,2026-02-28,",
        "",
      ].join("\n"),
    );
    expect(r.rows.map((x) => x.email)).toEqual(["f@example.org"]);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6]);
    expect(r.errors[0]!.message).toContain("2026-02-30");
    expect(r.errors[3]!.message).toBe("purchased_on is empty");
  });

  it("B9: a purchase date after now is an error", () => {
    const parsed = parseBuyersCsv(`${HEADER}a@example.org,A,,2026-11-06,\n`);
    expect(planGrants(parsed.rows, opts).errors).toHaveLength(1);
    // Today in Colombo (after midnight) is fine.
    const today = parseBuyersCsv(`${HEADER}a@example.org,A,,2026-11-05,\n`);
    expect(planGrants(today.rows, opts).errors).toEqual([]);
  });

  it("B10: the sample file gives 5 buyers and no problems", () => {
    const parsed = parseBuyersCsv(sample);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(5);
    expect(parsed.rows[0]).toMatchObject({
      line: 2,
      email: "nimali.perera@example.org",
      phone: "0771234567",
      purchasedOn: "2026-03-14",
      note: "paid by bank transfer",
    });
    expect(parsed.rows[1]).toMatchObject({ phone: null, note: null });
    expect(parsed.rows[2]).toMatchObject({ name: "Fernando, Amal", note: "quoted, with a comma" });
    const plan = planGrants(parsed.rows, opts);
    expect(plan.errors).toEqual([]);
    expect(plan.grants.map((g) => colomboDate(g.endsAt))).toEqual([
      "2029-03-14",
      "2028-12-31",
      "2027-03-01",
      "2029-10-01",
      "2029-01-01",
    ]);
  });
});

describe("parseBuyersCsv", () => {
  it("accepts any column order, CRLF, a BOM and blank lines, and counts lines", () => {
    const r = parseBuyersCsv(
      "﻿purchased_on,name,email\r\n2026-01-02,A,a@example.org\r\n\r\n2026-01-03,B,not-an-email\r\n",
    );
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toEqual([{ line: 4, message: "bad email" }]);
  });

  it("keeps the line count right across a quoted newline and an escaped quote", () => {
    const r = parseBuyersCsv(
      `${HEADER}a@example.org,"A ""Ace""\nSmith",,2026-01-02,\nb@example.org,B,,bad,\n`,
    );
    expect(r.rows[0]!.name).toBe('A "Ace"\nSmith');
    expect(r.errors).toEqual([expect.objectContaining({ line: 4 })]);
  });

  it("rejects a missing or unknown column, an empty file, and extra fields", () => {
    expect(parseBuyersCsv("email,name\na@example.org,A\n").errors[0]!.message).toBe(
      "missing column: purchased_on",
    );
    expect(parseBuyersCsv(`${HEADER.trim()},extra\n`).errors[0]!.message).toBe(
      "unknown column: extra",
    );
    expect(parseBuyersCsv("").errors).toEqual([{ line: 1, message: "the file is empty" }]);
    expect(parseBuyersCsv(`${HEADER}a@example.org,A,,2026-01-02,x,y\n`).errors[0]!.message).toBe(
      "too many columns (6, expected 5)",
    );
  });

  it("reports an unclosed quote instead of swallowing the rest of the file", () => {
    const r = parseBuyersCsv(
      `${HEADER}a@example.org,"Open name,,2026-01-02,\nb@example.org,B,,2026-01-03,\nc@example.org,C,,2026-01-04,\n`,
    );
    expect(r.errors).toEqual([expect.objectContaining({ line: 2 })]);
    expect(r.errors[0]!.message).toContain("unclosed quote");
    expect(r.rows).toEqual([]);
    // A quote closed on a later line is fine; rows before the open one still parse.
    const ok = parseBuyersCsv(
      `${HEADER}b@example.org,B,,2026-01-03,\nc@example.org,"C,,2026-01-04,\n`,
    );
    expect(ok.rows.map((x) => x.email)).toEqual(["b@example.org"]);
    expect(ok.errors).toEqual([expect.objectContaining({ line: 3 })]);
  });

  it("rejects a repeated column name", () => {
    const r = parseBuyersCsv(
      "email,name,email,purchased_on\na@example.org,A,b@example.org,2026-01-02\n",
    );
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([{ line: 1, message: "duplicate column: email" }]);
  });

  it("does not repeat the address in a bad-email error", () => {
    const r = parseBuyersCsv(`${HEADER}secret-person-at-example,A,,2026-01-02,\n`);
    expect(JSON.stringify(r.errors)).not.toContain("secret-person");
  });

  it("requires a name and reports every problem on a row", () => {
    const r = parseBuyersCsv(`${HEADER}a@example.org,,,,\n`);
    expect(r.errors.map((e) => e.message)).toEqual(["name is empty", "purchased_on is empty"]);
  });

  it("colomboMidnight only accepts real dates", () => {
    expect(colomboMidnight("2024-02-29")).not.toBeNull();
    expect(colomboMidnight("2026-02-29")).toBeNull();
    expect(colomboMidnight("2026-04-31")).toBeNull();
    expect(colomboMidnight("2026-1-1")).toBeNull();
  });
});

// The generated SQL on real local D1 (the same engine wrangler d1 execute uses).
const db = env.DB;
const STAMP = 1_793_836_800_000;

async function runSql(statements: string[]) {
  await db.batch(statements.map((s) => db.prepare(s)));
}

async function rowsFor(email: string) {
  const student = await db
    .prepare("SELECT id, name, phone, user_id FROM students WHERE email = ?")
    .bind(email)
    .first<{ id: string; name: string; phone: string | null; user_id: string | null }>();
  const grants = student
    ? (
        await db
          .prepare(
            "SELECT id, order_id, starts_at, ends_at, created_by, reason FROM grants WHERE student_id = ?",
          )
          .bind(student.id)
          .all()
      ).results
    : [];
  const audit = (
    await db
      .prepare(
        "SELECT id, at, actor_email, action, entity_type, entity_id, data_json FROM audit_log WHERE entity_id IN (SELECT id FROM grants WHERE student_id = ?)",
      )
      .bind(student?.id ?? "")
      .all()
  ).results;
  return { student, grants, audit };
}

function planFor(emails: string[], date = "2026-03-14") {
  const csv =
    HEADER + emails.map((e, i) => `${e},Buyer ${i},0770000000,${date},note ${i}`).join("\n") + "\n";
  const parsed = parseBuyersCsv(csv);
  expect(parsed.errors).toEqual([]);
  return planGrants(parsed.rows, opts).grants;
}

describe("importStatements on local D1", () => {
  it("creates a student, a grant with no order, and an audit row", async () => {
    const email = "fresh-1@example.org";
    await runSql(importStatements(planFor([email]), { now: STAMP }));
    const { student, grants, audit } = await rowsFor(email);
    expect(student).toMatchObject({ name: "Buyer 0", phone: "0770000000", user_id: null });
    expect(grants).toEqual([
      {
        id: expect.any(String),
        order_id: null,
        starts_at: Date.parse("2026-03-13T18:30:00Z"),
        ends_at: Date.parse("2029-03-13T18:30:00Z"),
        created_by: "import",
        reason: "Imported buyer. note 0",
      },
    ]);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actor_email: "import",
      action: "grant.import",
      entity_type: "grant",
      entity_id: (grants[0] as { id: string }).id,
    });
  });

  it("is idempotent: running the same SQL twice, or again later, changes nothing", async () => {
    const emails = ["twice-1@example.org", "twice-2@example.org"];
    const counts = async () =>
      Promise.all(
        ["students", "grants", "audit_log"].map(
          async (t) =>
            (await db.prepare(`SELECT count(*) AS n FROM ${t}`).first<{ n: number }>())!.n,
        ),
      );
    const before = await counts();
    await runSql(importStatements(planFor(emails), { now: STAMP }));
    const once = await Promise.all(emails.map(rowsFor));
    const afterFirst = await counts();
    expect(afterFirst.map((n, i) => n - before[i]!)).toEqual([2, 2, 2]);

    await runSql(importStatements(planFor(emails), { now: STAMP }));
    // A later run, with a new clock, must not touch anything either.
    await runSql(importStatements(planFor(emails), { now: STAMP + 86_400_000 }));
    expect(await Promise.all(emails.map(rowsFor))).toEqual(once);
    expect(await counts()).toEqual(afterFirst);
  });

  it("leaves an existing student's row alone and adds the missing grant", async () => {
    const email = "existing-1@example.org";
    await db
      .prepare(
        "INSERT INTO students (id, email, name, created_at) VALUES ('stu-ex-1', ?, 'Own Name', 5)",
      )
      .bind(email)
      .run();
    await runSql(importStatements(planFor([email]), { now: STAMP }));
    const { student, grants } = await rowsFor(email);
    expect(student).toMatchObject({ id: "stu-ex-1", name: "Own Name", phone: null });
    expect(grants).toHaveLength(1);
  });

  it("adds no grant when the student already has one for the course", async () => {
    const email = "granted-1@example.org";
    await db
      .prepare("INSERT INTO students (id, email, name, created_at) VALUES ('stu-gr-1', ?, 'G', 5)")
      .bind(email)
      .run();
    await db
      .prepare(
        "INSERT INTO grants (id, student_id, course_id, starts_at, ends_at, created_by, created_at) VALUES ('gr-1', 'stu-gr-1', 'blueprint', 1, 2, 'amma@example.org', 5)",
      )
      .run();
    await runSql(importStatements(planFor([email]), { now: STAMP }));
    const { grants, audit } = await rowsFor(email);
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ id: "gr-1", created_by: "amma@example.org" });
    expect(audit).toEqual([]);
  });

  it("escapes quotes in names and notes", async () => {
    const parsed = parseBuyersCsv(
      `${HEADER}quote-1@example.org,"O'Brien, Pat",,2026-03-14,"it's ok"\n`,
    );
    const plan = planGrants(parsed.rows, opts).grants;
    await runSql(importStatements(plan, { now: STAMP }));
    const { student, grants } = await rowsFor("quote-1@example.org");
    expect(student?.name).toBe("O'Brien, Pat");
    expect((grants[0] as { reason: string }).reason).toBe("Imported buyer. it's ok");
  });

  it("an imported student links by verified email on first sign-in and keeps the grant", async () => {
    const email = "signin-1@example.org";
    await runSql(importStatements(planFor([email]), { now: STAMP }));
    const before = await rowsFor(email);
    const result = await linkStudent(
      db,
      { id: "auth-user-signin-1", email: email.toUpperCase(), name: "x", emailVerified: true },
      STAMP,
    );
    expect(result).toEqual({ status: "linked", studentId: before.student!.id });
    const after = await rowsFor(email);
    expect(after.student).toMatchObject({ name: "Buyer 0", user_id: "auth-user-signin-1" });
    expect(after.grants).toEqual(before.grants);
    const g = after.grants[0] as { starts_at: number; ends_at: number };
    expect(hasAccess([{ startsAt: g.starts_at, endsAt: g.ends_at, revokedAt: null }], NOW)).toBe(
      true,
    );
    // An unverified sign-in must not claim the row.
    const other = "signin-2@example.org";
    await runSql(importStatements(planFor([other]), { now: STAMP }));
    expect(
      await linkStudent(db, { id: "auth-user-signin-2", email: other, emailVerified: false }),
    ).toEqual({ status: "unverified" });
    expect((await rowsFor(other)).student?.user_id).toBeNull();
  });
});
