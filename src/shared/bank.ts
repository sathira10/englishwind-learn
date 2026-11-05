// Where a bank-transfer buyer sends the money. The one place these details are written down:
// the API returns them and the order page shows what the API returns. They match `bank` in the
// public site's src/data/site.ts (englishwind-web).
export const BANK_DETAILS = {
  bank: "Bank of Ceylon",
  branch: "Galle Fort",
  account: "0081406387",
  accountName: "T.M.J. Tennakoon",
} as const;

export interface BankDetails {
  bank: string;
  branch: string;
  account: string;
  accountName: string;
}
