import { normalizeEmail } from "./email.ts";
import { accessEnd, colomboDate } from "./grants.ts";

// Plan 12. Pure parser and planner for the one-off import of the existing buyers: no I/O. The
// import script reads the file and runs the SQL; everything decided here is tested.

const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const COLUMNS = ["email", "name", "phone", "purchased_on", "note"] as const;
const REQUIRED = ["email", "name", "purchased_on"] as const;

export type BuyerRow = {
  /** 1-based line in the file where the row starts, for error messages. */
  line: number;
  /** Lower-case, trimmed. */
  email: string;
  name: string;
  phone: string | null;
  /** `YYYY-MM-DD`, a Colombo calendar date. */
  purchasedOn: string;
  note: string | null;
};

export type RowError = { line: number; message: string };

export type ParseResult = { rows: BuyerRow[]; errors: RowError[] };

/** Splits CSV text into records of fields, each with its starting line. Handles "quoted, fields". */
function records(text: string): {
  recs: { line: number; fields: string[] }[];
  /** The line where a quote was opened and never closed, if the file ends inside one. */
  unclosedQuoteLine: number | null;
} {
  const out: { line: number; fields: string[] }[] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let start = 1;
  const endRecord = () => {
    fields.push(field);
    if (fields.some((f) => f.trim() !== "")) out.push({ line: start, fields });
    fields = [];
    field = "";
  };
  const src = text.startsWith("﻿") ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else {
        if (ch === "\n") line++;
        field += ch;
      }
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      fields.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRecord();
      line++;
      start = line;
    } else field += ch;
  }
  // Ending inside a quote means the last record swallowed the rest of the file: drop it.
  if (quoted) return { recs: out, unclosedQuoteLine: start };
  if (field !== "" || fields.length > 0) endRecord();
  return { recs: out, unclosedQuoteLine: null };
}

/** The instant a Colombo calendar date begins (midnight, UTC+05:30), or null if not a real date. */
export function colomboMidnight(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d) - COLOMBO_OFFSET_MS;
  // Date.UTC rolls 31 Feb over to March, so a round trip tells a real date from a bad one.
  return colomboDate(ms) === date ? ms : null;
}

/**
 * Parses the buyers CSV. The header row names the columns (any order): `email`, `name`,
 * `purchased_on` are required, `phone` and `note` optional. Bad rows are reported with their
 * line number and left out; duplicate emails (after normalising) are errors on the later row.
 */
export function parseBuyersCsv(text: string): ParseResult {
  const { recs, unclosedQuoteLine } = records(text);
  const errors: RowError[] = [];
  if (unclosedQuoteLine !== null) {
    errors.push({
      line: unclosedQuoteLine,
      message: "unclosed quote (the row runs to the end of the file)",
    });
  }
  const header = recs.shift();
  if (!header) return { rows: [], errors: [...errors, { line: 1, message: "the file is empty" }] };
  const names = header.fields.map((h) => h.trim().toLowerCase());
  const missing = REQUIRED.filter((c) => !names.includes(c));
  const unknown = names.filter((n) => !(COLUMNS as readonly string[]).includes(n));
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length > 0) {
    return {
      rows: [],
      errors: [
        { line: header.line, message: `duplicate column: ${[...new Set(dupes)].join(", ")}` },
      ],
    };
  }
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ line: header.line, message: `missing column: ${missing.join(", ")}` }],
    };
  }
  if (unknown.length > 0) {
    return {
      rows: [],
      errors: [{ line: header.line, message: `unknown column: ${unknown.join(", ")}` }],
    };
  }
  const col = (fields: string[], name: (typeof COLUMNS)[number]) =>
    (fields[names.indexOf(name)] ?? "").trim();

  const rows: BuyerRow[] = [];
  const seen = new Map<string, number>();
  for (const { line, fields } of recs) {
    if (fields.length > names.length) {
      errors.push({
        line,
        message: `too many columns (${fields.length}, expected ${names.length})`,
      });
      continue;
    }
    const email = normalizeEmail(col(fields, "email"));
    const name = col(fields, "name");
    const purchasedOn = col(fields, "purchased_on");
    const problems: string[] = [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push("bad email");
    if (name === "") problems.push("name is empty");
    if (purchasedOn === "") problems.push("purchased_on is empty");
    else if (colomboMidnight(purchasedOn) === null) {
      problems.push(`bad purchased_on "${purchasedOn}" (want a real date as YYYY-MM-DD)`);
    }
    const first = seen.get(email);
    if (first !== undefined) problems.push(`duplicate email, first seen on line ${first}`);
    if (problems.length > 0) {
      for (const message of problems) errors.push({ line, message });
      continue;
    }
    seen.set(email, line);
    rows.push({
      line,
      email,
      name,
      phone: col(fields, "phone") || null,
      purchasedOn,
      note: col(fields, "note") || null,
    });
  }
  return { rows, errors };
}

export type PlannedGrant = {
  buyer: BuyerRow;
  courseId: string;
  startsAt: number;
  endsAt: number;
  /** True when the access period was already over at `now`. */
  ended: boolean;
};

export type Plan = { grants: PlannedGrant[]; errors: RowError[] };

/**
 * One grant per buyer: starts at Colombo midnight on the purchase date and ends `accessYears`
 * calendar years later (the grant rules, plans/02). A purchase date after `now` is an error. A
 * buyer whose access has already ended is kept but flagged `ended`.
 */
export function planGrants(
  rows: readonly BuyerRow[],
  opts: { courseId: string; accessYears: number; now: number },
): Plan {
  const grants: PlannedGrant[] = [];
  const errors: RowError[] = [];
  for (const buyer of rows) {
    const startsAt = colomboMidnight(buyer.purchasedOn);
    if (startsAt === null) {
      errors.push({ line: buyer.line, message: `bad purchased_on "${buyer.purchasedOn}"` });
      continue;
    }
    if (startsAt > opts.now) {
      errors.push({
        line: buyer.line,
        message: `purchased_on ${buyer.purchasedOn} is in the future`,
      });
      continue;
    }
    const endsAt = accessEnd(startsAt, opts.accessYears);
    grants.push({ buyer, courseId: opts.courseId, startsAt, endsAt, ended: endsAt <= opts.now });
  }
  return { grants, errors };
}

const q = (s: string) => `'${s.replaceAll("'", "''")}'`;
const qn = (s: string | null) => (s === null ? "NULL" : q(s));

/**
 * The SQL for a plan, safe to run any number of times (plans/12). Per buyer, in order:
 * 1. a students row, unless one exists for the email (an existing row is left untouched);
 * 2. a grant (no order, `created_by = 'import'`), unless the student already has any grant for
 *    the course;
 * 3. an `audit_log` row (`actor_email = 'import'`) for each import grant that has none yet.
 * One statement per entry, each on a single line.
 */
export function importStatements(plan: readonly PlannedGrant[], opts: { now: number }): string[] {
  const out: string[] = [];
  for (const g of plan) {
    const { email, name, phone, purchasedOn, note } = g.buyer;
    const reason = note ? `Imported buyer. ${note}` : "Imported buyer.";
    const data = JSON.stringify({
      courseId: g.courseId,
      purchasedOn,
      startsAt: g.startsAt,
      endsAt: g.endsAt,
    });
    out.push(
      `INSERT INTO students (id, email, name, phone, created_at) VALUES (lower(hex(randomblob(16))), ${q(email)}, ${q(name)}, ${qn(phone)}, ${opts.now}) ON CONFLICT(email) DO NOTHING;`,
      `INSERT INTO grants (id, student_id, course_id, order_id, starts_at, ends_at, reason, created_by, created_at) SELECT lower(hex(randomblob(16))), s.id, ${q(g.courseId)}, NULL, ${g.startsAt}, ${g.endsAt}, ${q(reason)}, 'import', ${opts.now} FROM students s WHERE s.email = ${q(email)} AND NOT EXISTS (SELECT 1 FROM grants x WHERE x.student_id = s.id AND x.course_id = ${q(g.courseId)});`,
      `INSERT INTO audit_log (id, at, actor_email, action, entity_type, entity_id, data_json) SELECT lower(hex(randomblob(16))), ${opts.now}, 'import', 'grant.import', 'grant', x.id, ${q(data)} FROM grants x JOIN students s ON s.id = x.student_id WHERE s.email = ${q(email)} AND x.course_id = ${q(g.courseId)} AND x.created_by = 'import' AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.action = 'grant.import' AND a.entity_id = x.id);`,
    );
  }
  return out;
}
