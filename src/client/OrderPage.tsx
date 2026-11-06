import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router";
import { formatLkr } from "../domain/orders";
import type {
  OfferResponse,
  OrderErrorResponse,
  OrderRequest,
  OrderResponse,
} from "../shared/orders";
import { Button } from "./components/Button";
import { EmptyState } from "./components/EmptyState";
import { TextField } from "./components/TextField";

// The public order page (plan 13, ADR 0007). No sign-in. The price shown comes from the server.
// PLACEHOLDER: a WhatsApp help link. The number is not in a data file in this repo yet
// (plans/OPEN-QUESTIONS.md Q26), so there is no link until it is.

type Load = { state: "loading" } | { state: "missing" } | { state: "ready"; offer: OfferResponse };

export default function OrderPage() {
  const { offer: slug = "" } = useParams();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [placed, setPlaced] = useState<OrderResponse | null>(null);

  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    fetch(`/api/offers/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? (r.json() as Promise<OfferResponse>) : Promise.reject(r.status)))
      .then((offer) => live && setLoad({ state: "ready", offer }))
      .catch(() => live && setLoad({ state: "missing" }));
    return () => {
      live = false;
    };
  }, [slug]);

  return (
    <main className="ew-section">
      <div className="mx-auto max-w-page px-4">
        {load.state === "loading" ? <p className="text-body text-fg">Loading...</p> : null}
        {load.state === "missing" ? (
          <EmptyState title="We can't find that order page">
            Check the link, or ask the person who sent it.
          </EmptyState>
        ) : null}
        {load.state === "ready" && placed ? <Confirmation order={placed} /> : null}
        {load.state === "ready" && !placed ? (
          <OrderForm offer={load.offer} onPlaced={setPlaced} />
        ) : null}
      </div>
    </main>
  );
}

function OrderForm({
  offer,
  onPlaced,
}: {
  offer: OfferResponse;
  onPlaced: (order: OrderResponse) => void;
}) {
  const [values, setValues] = useState({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setProblem("");
    try {
      const body: OrderRequest = { offer: offer.slug, ...values };
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 201) return onPlaced((await res.json()) as OrderResponse);
      const err = (await res.json().catch(() => ({}))) as Partial<OrderErrorResponse>;
      if (res.status === 422 && err.fields) setErrors(err.fields);
      else if (res.status === 429) setProblem("Too many orders just now. Please try again later.");
      else setProblem("Something went wrong. Please try again.");
    } catch {
      setProblem("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid max-w-measure gap-6">
      <div>
        <h1 className="m-0 font-display text-h2 font-bold text-fg-strong">{offer.label}</h1>
        <p className="mt-2 text-body font-bold text-fg-strong">{formatLkr(offer.priceCents)}</p>
        <p className="mt-2 text-body text-fg">
          {offer.priceCents === 0
            ? "Nothing to pay. Fill in your details and we will check your class enrolment."
            : "Pay by bank transfer. Fill in your details first."}
        </p>
      </div>
      <TextField
        label="Full name"
        name="name"
        autoComplete="name"
        value={values.name}
        onChange={set("name")}
        error={errors.name}
      />
      <TextField
        label="Email"
        hint="We send your access here."
        name="email"
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={set("email")}
        error={errors.email}
      />
      <TextField
        label="WhatsApp number"
        name="phone"
        type="tel"
        autoComplete="tel"
        value={values.phone}
        onChange={set("phone")}
        error={errors.phone}
      />
      {problem ? (
        <p className="ew-notice" role="alert">
          {problem}
        </p>
      ) : null}
      <div>
        <Button type="submit" loading={busy} loadingLabel="Placing order">
          Place order
        </Button>
      </div>
    </form>
  );
}

function Confirmation({ order }: { order: OrderResponse }) {
  if (order.amountCents === 0) return <FreeConfirmation order={order} />;
  const { bank } = order;
  const rows: [string, string][] = [
    ["Amount", formatLkr(order.amountCents)],
    ["Bank", `${bank.bank}, ${bank.branch}`],
    ["Account number", bank.account],
    ["Account name", bank.accountName],
    ["Note to put in the transfer", order.reference],
  ];
  return (
    <section className="grid max-w-measure gap-6" aria-labelledby="order-placed">
      <div>
        <h1 id="order-placed" className="m-0 font-display text-h2 font-bold text-fg-strong">
          Order placed
        </h1>
        <p className="mt-2 text-body text-fg">
          {order.label}. Transfer the amount below and write your reference in the note.
        </p>
      </div>
      <dl className="m-0 grid gap-4 bg-surface p-4">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt className="text-base text-fg-muted">{term}</dt>
            <dd className="m-0 text-body font-bold text-fg-strong">{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h2 className="m-0 text-h3 font-semibold text-fg-strong">What happens next</h2>
        <ol className="mt-2 grid gap-2 pl-6 text-body text-fg">
          <li>You make the transfer.</li>
          <li>Amma checks it in the bank account.</li>
          <li>We email your access to class materials and resources.</li>
        </ol>
      </div>
      <p className="m-0 text-base text-fg-muted">Keep this page or write down your reference.</p>
    </section>
  );
}

/** A zero-price offer (Blueprint included with the full live class): nothing to transfer. */
function FreeConfirmation({ order }: { order: OrderResponse }) {
  return (
    <section className="grid max-w-measure gap-6" aria-labelledby="order-placed">
      <div>
        <h1 id="order-placed" className="m-0 font-display text-h2 font-bold text-fg-strong">
          Order placed
        </h1>
        <p className="mt-2 text-body text-fg">
          {order.label}. There is nothing to pay. Your reference is{" "}
          <strong className="text-fg-strong">{order.reference}</strong>.
        </p>
      </div>
      <div>
        <h2 className="m-0 text-h3 font-semibold text-fg-strong">What happens next</h2>
        <ol className="mt-2 grid gap-2 pl-6 text-body text-fg">
          <li>Amma checks your class enrolment.</li>
          <li>We email your access to class materials and resources.</li>
        </ol>
      </div>
      <p className="m-0 text-base text-fg-muted">Keep this page or write down your reference.</p>
    </section>
  );
}
