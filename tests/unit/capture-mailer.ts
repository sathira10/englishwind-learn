import type {
  AccessGrantedData,
  Mailer,
  OrderReceivedData,
  OrderRejectedData,
} from "../../src/worker/mail";

// A Mailer for tests: records what was sent, or throws when `failWith` is set.
export interface CaptureMailer extends Mailer {
  codes: { to: string; code: string }[];
  orderReceived_: { to: string; data: OrderReceivedData }[];
  accessGranted_: { to: string; data: AccessGrantedData }[];
  orderRejected_: { to: string; data: OrderRejectedData }[];
}

export function captureMailer(options: { failWith?: Error } = {}): CaptureMailer {
  const mailer: CaptureMailer = {
    codes: [],
    orderReceived_: [],
    accessGranted_: [],
    orderRejected_: [],
    async sendLoginCode(to, code) {
      mailer.codes.push({ to, code });
    },
    async orderReceived(to, data) {
      if (options.failWith) throw options.failWith;
      mailer.orderReceived_.push({ to, data });
    },
    async accessGranted(to, data) {
      if (options.failWith) throw options.failWith;
      mailer.accessGranted_.push({ to, data });
    },
    async orderRejected(to, data) {
      if (options.failWith) throw options.failWith;
      mailer.orderRejected_.push({ to, data });
    },
  };
  return mailer;
}
