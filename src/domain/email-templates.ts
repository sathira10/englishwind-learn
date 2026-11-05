// Transactional email text (plans/10-emails.md). Pure: each function returns the subject, a
// plain-text body and a simple HTML body. No I/O, no tracking pixels, no remote images. Every
// piece of user-provided text goes through `escapeHtml` in the HTML and through `oneLine` in a
// subject. Wording: short, plain, and "class materials and resources", never "books".
import { colomboDate } from "./grants";
import { formatLkr } from "./orders";

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export interface BankLines {
  bank: string;
  branch: string;
  account: string;
  accountName: string;
}

export interface OrderReceivedData {
  name: string;
  /** e.g. `EW-7KQ4XM`. */
  reference: string;
  /** What was ordered, e.g. "Blueprint". */
  label: string;
  /** Integer LKR cents. */
  amountCents: number;
  bank: BankLines;
}

export interface AccessGrantedData {
  name: string;
  courseTitle: string;
  /** UTC epoch ms; shown as an Asia/Colombo date. */
  endsAt: number;
  signInUrl: string;
}

export interface OrderRejectedData {
  name: string;
  reference: string;
  /** Only when staff typed one (Q19). Never invented. */
  reason?: string | null;
}

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ENTITIES[ch] ?? ch);
}

/** Collapses line breaks and runs of space, so user text cannot add a header line to a subject. */
export function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** An instant as its Asia/Colombo calendar date: "5 November 2029". */
export function formatColomboDate(instant: number): string {
  const [year, month, day] = colomboDate(instant).split("-").map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
}

const greeting = (name: string) => `Hello ${oneLine(name) || "there"},`;
const SIGN_OFF = "EnglishWind";

// A tiny layout shared by every message: paragraphs and a two-column table.
function paragraph(text: string): string {
  return `<p style="margin:0 0 16px">${escapeHtml(text)}</p>`;
}

function rows(items: [string, string][]): string {
  const body = items
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 16px 4px 0">${escapeHtml(k)}</td>` +
        `<td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`,
    )
    .join("");
  return `<table role="presentation" style="margin:0 0 16px;border-collapse:collapse">${body}</table>`;
}

function page(parts: string[]): string {
  return (
    `<!doctype html><html lang="en"><body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;` +
    `font-size:16px;line-height:1.5"><div style="max-width:520px">${parts.join("")}</div></body></html>`
  );
}

export function orderReceivedEmail(data: OrderReceivedData): EmailContent {
  const amount = formatLkr(data.amountCents);
  const label = oneLine(data.label);
  const reference = oneLine(data.reference);
  const bank: [string, string][] = [
    ["Bank", data.bank.bank],
    ["Branch", data.bank.branch],
    ["Account number", data.bank.account],
    ["Account name", data.bank.accountName],
  ];
  const lead = `We have your order for ${label}.`;
  const pay = `Please send ${amount} by bank transfer to this account:`;
  const note = `Put your reference ${reference} in the transfer note, so we can find your payment.`;
  const next =
    "When we see your payment we will email you. Then you can sign in and start. " +
    "Your access includes the lessons, class materials and resources.";

  const text = [
    greeting(data.name),
    "",
    lead,
    "",
    `Reference: ${reference}`,
    `Amount: ${amount}`,
    "",
    pay,
    ...bank.map(([k, v]) => `${k}: ${v}`),
    "",
    note,
    "",
    next,
    "",
    SIGN_OFF,
  ].join("\n");

  const html = page([
    paragraph(greeting(data.name)),
    paragraph(lead),
    rows([
      ["Reference", reference],
      ["Amount", amount],
    ]),
    paragraph(pay),
    rows(bank),
    paragraph(note),
    paragraph(next),
    paragraph(SIGN_OFF),
  ]);
  return { subject: `Your EnglishWind order ${reference}`, text, html };
}

export function accessGrantedEmail(data: AccessGrantedData): EmailContent {
  const course = oneLine(data.courseTitle);
  const until = formatColomboDate(data.endsAt);
  const lead = `Your payment is confirmed. You now have access to ${course}.`;
  const materials = "You can open the lessons, class materials and resources when you sign in.";
  const dates = `Your access lasts until ${until} (Sri Lanka time).`;
  const how =
    "To sign in, open the link below and enter this email address. We will send you a code.";

  const text = [
    greeting(data.name),
    "",
    lead,
    materials,
    dates,
    "",
    how,
    data.signInUrl,
    "",
    SIGN_OFF,
  ].join("\n");

  const html = page([
    paragraph(greeting(data.name)),
    paragraph(lead),
    paragraph(materials),
    paragraph(dates),
    paragraph(how),
    `<p style="margin:0 0 16px"><a href="${escapeHtml(data.signInUrl)}">${escapeHtml(data.signInUrl)}</a></p>`,
    paragraph(SIGN_OFF),
  ]);
  return { subject: `You now have access to ${course}`, text, html };
}

export function orderRejectedEmail(data: OrderRejectedData): EmailContent {
  const reference = oneLine(data.reference);
  const reason = data.reason?.trim() ? data.reason.trim() : null;
  const lead = `We could not confirm your order ${reference}.`;
  const help = "If you think this is a mistake, reply to this email and we will help.";

  const text = [
    greeting(data.name),
    "",
    lead,
    ...(reason ? ["", `Note from us: ${reason}`] : []),
    "",
    help,
    "",
    SIGN_OFF,
  ].join("\n");

  const html = page([
    paragraph(greeting(data.name)),
    paragraph(lead),
    ...(reason ? [paragraph(`Note from us: ${reason}`)] : []),
    paragraph(help),
    paragraph(SIGN_OFF),
  ]);
  return { subject: `About your EnglishWind order ${reference}`, text, html };
}
