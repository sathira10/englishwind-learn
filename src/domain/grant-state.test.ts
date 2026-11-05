import { describe, expect, it } from "vitest";
import { grantState } from "./grants";

// Plan 09: the word the admin shows for a grant.
describe("grantState", () => {
  const g = { startsAt: 100, endsAt: 200, revokedAt: null };
  it("is upcoming before the start, current from it, ended from the end instant", () => {
    expect(grantState(g, 99)).toBe("upcoming");
    expect(grantState(g, 100)).toBe("current");
    expect(grantState(g, 199)).toBe("current");
    expect(grantState(g, 200)).toBe("ended");
  });
  it("is revoked from the revocation instant, even when the grant would have ended", () => {
    expect(grantState({ ...g, revokedAt: 150 }, 149)).toBe("current");
    expect(grantState({ ...g, revokedAt: 150 }, 150)).toBe("revoked");
    expect(grantState({ ...g, revokedAt: 150 }, 500)).toBe("revoked");
  });
});
