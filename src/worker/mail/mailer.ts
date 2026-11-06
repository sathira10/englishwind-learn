import type {
  AccessGrantedData,
  OrderReceivedData,
  OrderRejectedData,
} from "../../domain/email-templates";

// Outgoing email goes through this interface so the sender can change without touching callers.
// A real sender renders each message with the pure templates in src/domain/email-templates.ts.
export type { AccessGrantedData, OrderReceivedData, OrderRejectedData };

export interface Mailer {
  sendLoginCode(to: string, code: string): Promise<void>;
  /** To the buyer after POST /api/orders: reference, amount, bank details, what happens next. */
  orderReceived(to: string, data: OrderReceivedData): Promise<void>;
  /** To the student after approval: course, access end date, sign-in link. */
  accessGranted(to: string, data: AccessGrantedData): Promise<void>;
  /** Optional and short; a reason only if staff typed one. Not sent at launch (Q19). */
  orderRejected(to: string, data: OrderRejectedData): Promise<void>;
}
