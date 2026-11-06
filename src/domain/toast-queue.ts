// The toast queue behind the app's polite live region. Pure: the provider owns timers and the DOM.

export const MAX_VISIBLE_TOASTS = 3;
export const MIN_TOAST_MS = 4000;
export const MAX_TOAST_MS = 10_000;
const MS_PER_CHARACTER = 40;

export type ToastItem = { id: number; message: string; durationMs: number };
export type ToastState = { items: ToastItem[]; nextId: number };
export type ToastAction =
  { type: "add"; message: string; durationMs?: number } | { type: "dismiss"; id: number };

export const initialToastState: ToastState = { items: [], nextId: 1 };

/** How long a message stays: 4 s, plus 40 ms a character so longer text can be read, up to 10 s. */
export function toastDuration(message: string): number {
  const ms = MIN_TOAST_MS + MS_PER_CHARACTER * message.length;
  return Math.min(MAX_TOAST_MS, Math.max(MIN_TOAST_MS, ms));
}

export function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "add": {
      const message = action.message.trim();
      if (message === "" || state.items.some((item) => item.message === message)) return state;
      const item: ToastItem = {
        id: state.nextId,
        message,
        durationMs: action.durationMs ?? toastDuration(message),
      };
      return {
        items: [...state.items, item].slice(-MAX_VISIBLE_TOASTS),
        nextId: state.nextId + 1,
      };
    }
    case "dismiss": {
      if (!state.items.some((item) => item.id === action.id)) return state;
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };
    }
  }
}
