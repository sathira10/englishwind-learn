// Outgoing email goes through this interface so the sender can change without touching auth.
// Later slices (10) add more messages here.
export interface Mailer {
  sendLoginCode(to: string, code: string): Promise<void>;
}
