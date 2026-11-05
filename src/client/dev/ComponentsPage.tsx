// Dev-only specimen page (routed only when import.meta.env.DEV). Every app component in each of
// its states, for checking against the design rules at 375px and 1280px. Not part of the product.
import { useState, type ReactNode } from "react";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { LessonCompleteMark } from "../components/LessonCompleteMark";
import { ListRow, ListRows } from "../components/ListRow";
import { StatusLabel } from "../components/StatusLabel";
import { TextField } from "../components/TextField";
import { useToast } from "../components/toast-context";
import { VimeoFrame } from "../components/VimeoFrame";

function Specimen({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="mt-12" aria-labelledby={`spec-${name}`}>
      <h2 id={`spec-${name}`} className="m-0 mb-6 text-h3 font-semibold">
        {name}
      </h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">{children}</div>
    </section>
  );
}

function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <p className="m-0 text-base text-fg-muted">{label}</p>
      {children}
    </div>
  );
}

const fallback = (
  <>
    <p className="m-0">This video isn't available yet. Nothing is wrong with your course access.</p>
    <p className="m-0 mt-2">
      <a href="https://wa.me/" className="ew-link" style={{ color: "inherit" }}>
        Tell us on WhatsApp →
      </a>
    </p>
  </>
);

export default function ComponentsPage() {
  const toast = useToast();
  const [dialog, setDialog] = useState<"closed" | "open" | "busy">("closed");
  const [loading, setLoading] = useState(false);

  function confirm() {
    setDialog("busy");
    setTimeout(() => {
      setDialog("closed");
      toast.show("Order EW-7KQ4XM approved.");
    }, 1200);
  }

  function fakeSave() {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  }

  return (
    <main className="ew-section">
      <div className="mx-auto max-w-page px-4">
        <h1 className="m-0 text-h2 font-bold">App components</h1>
        <p className="mt-4 max-w-measure text-body">
          Dev only. Every component in each state, built from the design system's classes and
          tokens. Plan 14.
        </p>

        <Specimen name="Button">
          <State label="Primary, secondary, secondary outline, small">
            <div className="flex flex-wrap items-center gap-4">
              <Button>Approve order</Button>
              <Button variant="secondary">Copy</Button>
              <Button variant="secondary" outline>
                Reject order
              </Button>
              <Button small>Save</Button>
            </div>
          </State>
          <State label="Disabled (primary and secondary)">
            <div className="flex flex-wrap items-center gap-4">
              <Button disabled>Approve order</Button>
              <Button variant="secondary" outline disabled>
                Reject order
              </Button>
            </div>
          </State>
          <State label="Loading: stays focusable, ignores clicks (press to try)">
            <div className="flex flex-wrap items-center gap-4">
              <Button loading={loading} loadingLabel="Saving" onClick={fakeSave}>
                Save changes
              </Button>
              <Button loading loadingLabel="Saving">
                Save changes
              </Button>
              <Button variant="secondary" outline loading>
                Reject order
              </Button>
            </div>
          </State>
          <State label="On a navy band">
            <div
              className="flex flex-wrap items-center gap-4 bg-surface-dark p-6"
              data-surface="navy"
            >
              <Button>Go to course</Button>
              <Button variant="secondary">Back</Button>
              <Button disabled>Go to course</Button>
            </div>
          </State>
        </Specimen>

        <Specimen name="ConfirmDialog">
          <State label="Native dialog: Tab stays inside, Esc closes, focus starts on Cancel">
            <div className="flex flex-wrap gap-4">
              <Button variant="secondary" outline onClick={() => setDialog("open")}>
                Open dialog
              </Button>
            </div>
          </State>
          <ConfirmDialog
            open={dialog !== "closed"}
            title="Approve this order?"
            confirmLabel="Approve order"
            busy={dialog === "busy"}
            busyLabel="Approving"
            onConfirm={confirm}
            onClose={() => setDialog("closed")}
          >
            <p className="m-0">
              Order EW-7KQ4XM for LKR 10,000 will give the student 3 years of access to the
              Blueprint. You can't approve it twice.
            </p>
          </ConfirmDialog>
        </Specimen>

        <Specimen name="Toast">
          <State label="Polite live region, dismisses itself, pauses on hover or focus">
            <div className="flex flex-wrap gap-4">
              <Button variant="secondary" outline onClick={() => toast.show("Order approved.")}>
                Show a toast
              </Button>
              <Button
                variant="secondary"
                outline
                onClick={() =>
                  toast.show(
                    "Saved. The student can open the course now, and the grant ends in three years.",
                  )
                }
              >
                Show a long toast
              </Button>
            </div>
          </State>
        </Specimen>

        <Specimen name="ListRow">
          <State label="Link rows with a status, a text action and a mark">
            <ListRows label="Orders waiting">
              <ListRow
                to="/dev/components"
                title="Nimali Perera"
                meta="EW-7KQ4XM · LKR 10,000 · 2 days ago"
                trailing={<StatusLabel status="pending" />}
              />
              <ListRow
                to="/dev/components"
                title="Kasun Fernando"
                meta="EW-3MZ9TA · LKR 2,000 · 5 days ago"
                trailing={<span className="font-bold text-fg-strong">Review →</span>}
              />
              <ListRow
                to="/dev/components"
                title="Lesson 3: Say it in a sentence"
                meta="Lesson 3 · 12 min"
                trailing={<LessonCompleteMark complete />}
              />
            </ListRows>
          </State>
          <State label="Button row, and a static row holding a real button">
            <ListRows>
              <ListRow
                onClick={() => {}}
                title="Dilini Jayawardena"
                meta="dilini@example.com"
                trailing={<StatusLabel status="approved" />}
              />
              <ListRow
                title="Ruwan Silva"
                meta="Rejected yesterday"
                trailing={
                  <Button small variant="secondary" outline>
                    Undo
                  </Button>
                }
              />
            </ListRows>
          </State>
          <State label="Long text wraps, one line, no trailing">
            <ListRows>
              <ListRow
                to="/dev/components"
                title="A very long student name that keeps going so we can see the row wrap on a narrow phone"
                meta="averyveryverylongemailaddress.that.does.not.break@example.com"
                trailing={<StatusLabel status="rejected" />}
              />
              <ListRow to="/dev/components" title="Welcome" />
            </ListRows>
          </State>
        </Specimen>

        <Specimen name="EmptyState">
          <State label="With a sentence and a next step">
            <EmptyState
              title="No orders waiting"
              action={
                <Button variant="secondary" outline>
                  Create an order
                </Button>
              }
            >
              Nothing needs checking right now. New bank-transfer orders appear here.
            </EmptyState>
          </State>
          <State label="Title only">
            <EmptyState title="No courses yet" />
          </State>
        </Specimen>

        <Specimen name="StatusLabel">
          <State label="Pending (outline), Approved (fill), Rejected (strike)">
            <div className="flex flex-wrap items-center gap-4">
              <StatusLabel status="pending" />
              <StatusLabel status="approved" />
              <StatusLabel status="rejected" />
            </div>
          </State>
          <State label="On a surface field">
            <div className="flex flex-wrap items-center gap-4 bg-surface p-4">
              <StatusLabel status="pending" />
              <StatusLabel status="approved" />
              <StatusLabel status="rejected" />
            </div>
          </State>
        </Specimen>

        <Specimen name="LessonCompleteMark">
          <State label="Complete (nothing is drawn for an unfinished lesson)">
            <div className="flex flex-wrap items-center gap-4">
              <LessonCompleteMark complete />
              <span className="text-base text-fg-muted">complete=false renders nothing:</span>
              <LessonCompleteMark complete={false} />
            </div>
          </State>
        </Specimen>

        <Specimen name="VimeoFrame">
          <State label="Player (private video: Vimeo shows its own message when it is not reachable here)">
            <VimeoFrame videoId="76979871" title="Lesson 1: Welcome" fallback={fallback} />
          </State>
          <State label="Caller says Vimeo refused: friendly fallback">
            <VimeoFrame
              videoId="76979871"
              title="Lesson 1: Welcome"
              fallback={fallback}
              unavailable
            />
          </State>
          <State label="Not a Vimeo ID: same fallback, no iframe">
            <VimeoFrame videoId="not-an-id" title="Lesson 1: Welcome" fallback={fallback} />
          </State>
        </Specimen>

        <Specimen name="TextField">
          <State label="Default, with hint">
            <TextField label="Full name" hint="As it appears on the bank transfer." name="name" />
          </State>
          <State label="Optional">
            <TextField label="WhatsApp number" optional type="tel" name="phone" />
          </State>
          <State label="Error notice">
            <TextField
              label="Email address"
              type="email"
              name="email"
              defaultValue="nimali@"
              error="Add an email address or a WhatsApp number. Either one works."
            />
          </State>
          <State label="Disabled">
            <TextField label="Order reference" defaultValue="EW-7KQ4XM" disabled name="ref" />
          </State>
          <State label="On a surface field (the 1px line border is 3:1 on both grounds)">
            <div className="bg-surface p-4">
              <TextField label="Search students" type="search" name="q" />
            </div>
          </State>
        </Specimen>
      </div>
    </main>
  );
}
