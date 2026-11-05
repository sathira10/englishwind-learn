import { createContext, useContext } from "react";

export type ToastApi = {
  /** Announces `message` politely and shows it for a few seconds. */
  show: (message: string, options?: { durationMs?: number }) => void;
};

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast needs a <ToastProvider> above it.");
  return api;
}
