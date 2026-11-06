import { describe, expect, it } from "vitest";
import {
  accessGrantedEmail,
  escapeHtml,
  formatColomboDate,
  loginCodeEmail,
  oneLine,
  orderReceivedEmail,
  orderRejectedEmail,
} from "../../src/domain/email-templates";
import { BANK_DETAILS } from "../../src/shared/bank";

// Plan 10 reference cases E1 to E6, mirrored here pending Sathira's copy in tests/reference/.

const received = {
  name: "Kasun Perera",
  reference: "EW-7KQ4XM",
  label: "Blueprint",
  amountCents: 1_000_000,
  bank: BANK_DETAILS,
};

// 2029-11-05 20:00 UTC is 2029-11-06 01:30 in Colombo.
const NEXT_DAY_COLOMBO = Date.UTC(2029, 10, 5, 20, 0, 0);
const granted = {
  name: "Kasun Perera",
  courseTitle: "Blueprint",
  endsAt: NEXT_DAY_COLOMBO,
  signInUrl: "https://learn.englishwind.lk/sign-in",
};

const all = (c: { subject: string; text: string; html: string }) =>
  `${c.subject}\n${c.text}\n${c.html}`;

describe("orderReceivedEmail", () => {
  it("asks for no transfer and shows no bank details for a zero-price order", () => {
    const mail = orderReceivedEmail({ ...received, amountCents: 0 });
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("nothing to pay");
      expect(body).toContain(received.reference);
      expect(body).not.toContain(BANK_DETAILS.account);
    }
  });

  it("E1: carries the reference, amount, bank details and next step", () => {
    const mail = orderReceivedEmail(received);
    expect(mail.subject).toBe("Your EnglishWind order EW-7KQ4XM");
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("EW-7KQ4XM");
      expect(body).toContain("LKR 10,000");
      expect(body).toContain("Bank of Ceylon");
      expect(body).toContain("Galle Fort");
      expect(body).toContain("0081406387");
      expect(body).toContain("T.M.J. Tennakoon");
      expect(body).toContain("transfer note");
      expect(body).toContain("class materials and resources");
    }
  });

  it("matches the plain-text snapshot", () => {
    expect(orderReceivedEmail(received).text).toMatchInlineSnapshot(`
      "Hello Kasun Perera,

      We have your order for Blueprint.

      Reference: EW-7KQ4XM
      Amount: LKR 10,000

      Please send LKR 10,000 by bank transfer to this account:
      Bank: Bank of Ceylon
      Branch: Galle Fort
      Account number: 0081406387
      Account name: T.M.J. Tennakoon

      Put your reference EW-7KQ4XM in the transfer note, so we can find your payment.

      When we see your payment we will email you. Then you can sign in and start. Your access includes the lessons, class materials and resources.

      EnglishWind"
    `);
  });

  it("E2: escapes user text in the HTML, and leaves the plain text as typed", () => {
    const mail = orderReceivedEmail({
      ...received,
      name: `<script>alert("x")</script> & O'Neil`,
      label: "<b>Blueprint</b>",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<b>Blueprint</b>");
    expect(mail.html).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; O&#39;Neil",
    );
    expect(mail.text).toContain(`<script>alert("x")</script> & O'Neil`);
  });

  it("E3: a line break in a name or label cannot add a subject header", () => {
    const mail = orderReceivedEmail({
      ...received,
      reference: "EW-7KQ4XM\r\nBcc: x@evil.example",
    });
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });

  it("formats an amount with cents", () => {
    expect(orderReceivedEmail({ ...received, amountCents: 200_050 }).text).toContain(
      "Amount: LKR 2,000.50",
    );
  });
});

describe("accessGrantedEmail", () => {
  it("E4: gives the course, the end date in Colombo time and the sign-in link", () => {
    const mail = accessGrantedEmail(granted);
    expect(mail.subject).toBe("You now have access to Blueprint");
    // 20:00 UTC on 5 Nov is already 6 Nov in Colombo.
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("6 November 2029");
      expect(body).not.toContain("5 November 2029");
      expect(body).toContain("https://learn.englishwind.lk/sign-in");
      expect(body).toContain("class materials and resources");
    }
  });

  it("escapes the course title and the link in the HTML", () => {
    const mail = accessGrantedEmail({
      ...granted,
      courseTitle: "<i>Blueprint</i>",
      signInUrl: `https://learn.test/?a=1&b="2"`,
    });
    expect(mail.html).toContain("&lt;i&gt;Blueprint&lt;/i&gt;");
    expect(mail.html).toContain("a=1&amp;b=&quot;2&quot;");
    expect(mail.html).not.toContain("<i>");
  });
});

describe("orderRejectedEmail", () => {
  it("E5: gives no reason unless staff entered one", () => {
    for (const reason of [undefined, null, "", "   "]) {
      const mail = orderRejectedEmail({ name: "Kasun", reference: "EW-7KQ4XM", reason });
      expect(mail.text).not.toContain("Note from us");
      expect(mail.html).not.toContain("Note from us");
    }
    const withReason = orderRejectedEmail({
      name: "Kasun",
      reference: "EW-7KQ4XM",
      reason: "No payment <seen>",
    });
    expect(withReason.text).toContain("Note from us: No payment <seen>");
    expect(withReason.html).toContain("No payment &lt;seen&gt;");
  });
});

describe("loginCodeEmail", () => {
  it("puts the code in the subject, text and HTML, and says how long it works", () => {
    const mail = loginCodeEmail("482913");
    expect(mail.subject).toBe("482913 is your EnglishWind sign-in code");
    expect(mail.text).toContain("482913");
    expect(mail.html).toContain("482913");
    expect(mail.text).toContain("5 minutes");
  });
});

describe("every message", () => {
  const mails = [
    orderReceivedEmail(received),
    accessGrantedEmail(granted),
    orderRejectedEmail({ name: "Kasun", reference: "EW-7KQ4XM", reason: "Not seen" }),
    loginCodeEmail("482913"),
  ];

  it("E6: never says books, has no images or scripts, and keeps the text readable", () => {
    for (const mail of mails) {
      expect(all(mail)).not.toMatch(/book/i);
      expect(mail.html).not.toMatch(/<img|<script|<link|<iframe|url\(/i);
      expect(mail.text).not.toMatch(/<[a-z]/i);
      expect(mail.html).toContain("<!doctype html>");
    }
  });

  it("greets by a single-line name, or 'there' when the name is blank", () => {
    expect(orderRejectedEmail({ name: "  \n ", reference: "EW-1", reason: null }).text).toMatch(
      /^Hello there,/,
    );
  });
});

describe("helpers", () => {
  it("escapeHtml covers & < > \" '", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    expect(escapeHtml("plain")).toBe("plain");
  });

  it("oneLine collapses breaks and spaces", () => {
    expect(oneLine("  a\r\nb \t c ")).toBe("a b c");
  });

  it("formatColomboDate uses the Colombo calendar day", () => {
    expect(formatColomboDate(Date.UTC(2029, 10, 5, 18, 29, 59))).toBe("5 November 2029");
    expect(formatColomboDate(Date.UTC(2029, 10, 5, 18, 30, 0))).toBe("6 November 2029");
    expect(formatColomboDate(Date.UTC(2028, 1, 29, 0, 0, 0))).toBe("29 February 2028");
  });
});
