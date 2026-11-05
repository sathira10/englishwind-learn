// These cases mirror plan 14's reference table (R1 to R10), pending Sathira's copy in
// tests/reference/.
import { describe, expect, it } from "vitest";
import { isReviewStatus, reviewStatuses, statusLabel } from "../../src/domain/status-label";
import {
  initialToastState,
  MAX_TOAST_MS,
  MIN_TOAST_MS,
  toastDuration,
  toastReducer,
  type ToastAction,
  type ToastState,
} from "../../src/domain/toast-queue";
import { vimeoPlayerUrl } from "../../src/domain/vimeo";

const run = (actions: ToastAction[]): ToastState => actions.reduce(toastReducer, initialToastState);
const add = (message: string): ToastAction => ({ type: "add", message });

describe("vimeoPlayerUrl", () => {
  it("R1: builds the privacy-friendly player URL", () => {
    expect(vimeoPlayerUrl("76979871")).toBe(
      "https://player.vimeo.com/video/76979871?dnt=1&title=0&byline=0&portrait=0",
    );
  });

  it("R2: refuses anything that is not a plain numeric ID", () => {
    for (const bad of ["12abc", "", "0123", "../x?y=1", "123 ", "1234567890123456"]) {
      expect(vimeoPlayerUrl(bad), bad).toBeNull();
    }
  });
});

describe("statusLabel", () => {
  it("R3 to R5: word and treatment for each status", () => {
    expect(statusLabel("pending")).toEqual({ text: "Pending", treatment: "outline" });
    expect(statusLabel("approved")).toEqual({ text: "Approved", treatment: "fill" });
    expect(statusLabel("rejected")).toEqual({ text: "Rejected", treatment: "strike" });
  });

  it("gives every status a different treatment", () => {
    const treatments = reviewStatuses.map((status) => statusLabel(status).treatment);
    expect(new Set(treatments).size).toBe(reviewStatuses.length);
  });

  it("recognises only the three statuses", () => {
    expect(isReviewStatus("pending")).toBe(true);
    expect(isReviewStatus("Pending")).toBe(false);
    expect(isReviewStatus("cancelled")).toBe(false);
  });
});

describe("toastDuration", () => {
  it("R6: 4 s plus 40 ms a character", () => {
    expect(toastDuration("Saved")).toBe(4200);
  });

  it("R7: capped at 10 s", () => {
    expect(toastDuration("x".repeat(500))).toBe(10_000);
  });

  it("never decreases as the message grows and stays in range", () => {
    let previous = 0;
    for (let length = 0; length <= 400; length += 7) {
      const ms = toastDuration("x".repeat(length));
      expect(ms).toBeGreaterThanOrEqual(previous);
      expect(ms).toBeGreaterThanOrEqual(MIN_TOAST_MS);
      expect(ms).toBeLessThanOrEqual(MAX_TOAST_MS);
      previous = ms;
    }
  });
});

describe("toastReducer", () => {
  it("R8: keeps the newest three and drops the oldest", () => {
    const state = run([add("A"), add("B"), add("C"), add("D")]);
    expect(state.items.map((item) => [item.id, item.message])).toEqual([
      [2, "B"],
      [3, "C"],
      [4, "D"],
    ]);
  });

  it("R9: ignores a repeat of a toast still showing", () => {
    expect(run([add("A"), add("A")]).items).toHaveLength(1);
  });

  it("ignores blank messages", () => {
    expect(run([add(""), add("   ")])).toEqual(initialToastState);
  });

  it("R10: dismisses by id and ignores unknown ids", () => {
    const shown = run([add("A")]);
    expect(toastReducer(shown, { type: "dismiss", id: 1 }).items).toEqual([]);
    expect(toastReducer(shown, { type: "dismiss", id: 99 })).toBe(shown);
  });

  it("never reuses an id, even after a dismiss", () => {
    const state = run([add("A"), { type: "dismiss", id: 1 }, add("A")]);
    expect(state.items.map((item) => item.id)).toEqual([2]);
  });

  it("uses an explicit duration when given", () => {
    const state = toastReducer(initialToastState, { type: "add", message: "A", durationMs: 1234 });
    expect(state.items[0]?.durationMs).toBe(1234);
  });
});
