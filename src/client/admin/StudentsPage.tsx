import { useState, type FormEvent } from "react";
import type { AdminStudent } from "../../shared/admin";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ListRow, ListRows } from "../components/ListRow";
import { TextField } from "../components/TextField";
import { adminApi, errorMessage } from "./api";

type Result =
  | { state: "idle" }
  | { state: "busy" }
  | { state: "error"; message: string }
  | { state: "done"; students: AdminStudent[] };

/** Find a student by email, name or phone. */
export default function StudentsPage() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<Result>({ state: "idle" });

  async function search(event: FormEvent) {
    event.preventDefault();
    setResult({ state: "busy" });
    const res = await adminApi<{ students: AdminStudent[] }>(
      "GET",
      `/students?q=${encodeURIComponent(q.trim())}`,
    );
    if (res.ok) setResult({ state: "done", students: res.data.students });
    else setResult({ state: "error", message: res.error.fields?.q ?? errorMessage(res.error) });
  }

  return (
    <div className="grid max-w-measure gap-6">
      <h1 className="m-0 font-display text-h2 font-bold text-fg-strong">Students</h1>
      <form onSubmit={search} noValidate className="grid gap-4">
        <TextField
          label="Email, name or phone"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          error={result.state === "error" ? result.message : undefined}
        />
        <div>
          <Button type="submit" loading={result.state === "busy"} loadingLabel="Searching">
            Search
          </Button>
        </div>
      </form>
      {result.state === "done" && result.students.length === 0 ? (
        <EmptyState title="No students found">
          Check the spelling, or search by part of the email or phone number.
        </EmptyState>
      ) : null}
      {result.state === "done" && result.students.length > 0 ? (
        <ListRows label="Students found">
          {result.students.map((s) => (
            <ListRow
              key={s.id}
              to={`/admin/students/${s.id}`}
              title={s.name}
              meta={[s.email, s.phone].filter(Boolean).join(" · ")}
              trailing="Open"
            />
          ))}
        </ListRows>
      ) : null}
    </div>
  );
}
