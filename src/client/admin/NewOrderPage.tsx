import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { formatLkr } from "../../domain/orders";
import type { AdminOffer, AdminOrder } from "../../shared/admin";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { useToast } from "../components/toast-context";
import { adminApi, errorMessage, useAdminLoad } from "./api";
import { Select } from "./Select";

/** An order for a buyer who asked by phone or WhatsApp. It joins the queue as pending. */
export default function NewOrderPage() {
  const [offers] = useAdminLoad<{ offers: AdminOffer[] }>("/offers");
  const toast = useToast();
  const [values, setValues] = useState({ offer: "", name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<AdminOrder | null>(null);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setProblem("");
    const offer =
      values.offer || (offers.state === "ready" ? (offers.data.offers[0]?.id ?? "") : "");
    const res = await adminApi<{ order: AdminOrder }>("POST", "/orders", { ...values, offer });
    setBusy(false);
    if (res.ok) {
      setCreated(res.data.order);
      toast.show(`Order ${res.data.order.reference} added to the queue.`);
    } else if (res.status === 422 && res.error.fields) {
      setErrors(res.error.fields);
    } else {
      setProblem(errorMessage(res.error));
    }
  }

  if (created) {
    return (
      <div className="grid max-w-measure gap-6">
        <h1 className="m-0 font-display text-h2 font-bold text-fg-strong">Order added</h1>
        {created.amountCents === 0 ? (
          <p className="m-0 text-body text-fg">
            No transfer is due for <strong>{created.reference}</strong>. Check {created.buyerName}'s
            class enrolment, then approve it from the queue.
          </p>
        ) : (
          <p className="m-0 text-body text-fg">
            Tell {created.buyerName} to transfer {formatLkr(created.amountCents)} and write{" "}
            <strong>{created.reference}</strong> in the transfer note. Approve it from the queue
            when the money arrives.
          </p>
        )}
        <div className="flex flex-wrap gap-4">
          <Link to="/admin" className="ew-btn ew-btn-primary">
            Go to the queue
          </Link>
          <Button
            variant="secondary"
            outline
            onClick={() => {
              setCreated(null);
              setValues({ offer: values.offer, name: "", email: "", phone: "" });
            }}
          >
            Add another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid max-w-measure gap-6">
      <h1 className="m-0 font-display text-h2 font-bold text-fg-strong">New order</h1>
      <p className="m-0 text-body text-fg">
        For a buyer who asked by phone or WhatsApp. The price comes from the offer.
      </p>
      {offers.state === "error" ? (
        <p className="ew-notice" role="alert">
          {offers.message}
        </p>
      ) : null}
      <Select
        label="Offer"
        value={values.offer || (offers.state === "ready" ? (offers.data.offers[0]?.id ?? "") : "")}
        onChange={set("offer")}
        error={errors.offer}
      >
        {offers.state === "ready"
          ? offers.data.offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} ({formatLkr(o.priceCents)})
              </option>
            ))
          : null}
      </Select>
      <TextField
        label="Full name"
        autoComplete="off"
        value={values.name}
        onChange={set("name")}
        error={errors.name}
      />
      <TextField
        label="Email"
        hint="Their access is sent here."
        type="email"
        autoComplete="off"
        value={values.email}
        onChange={set("email")}
        error={errors.email}
      />
      <TextField
        label="WhatsApp number"
        type="tel"
        autoComplete="off"
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
        <Button type="submit" loading={busy} loadingLabel="Adding order">
          Add order
        </Button>
      </div>
    </form>
  );
}
