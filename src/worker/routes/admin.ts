import { Hono } from "hono";
import { requireStaff, type AdminEnv, type RequireStaffOptions } from "../admin/staff";

// Every /api/admin/* route goes through requireStaff. Later slices add routes here and pass a
// role list where only the owner may act.
export function createAdmin(options?: RequireStaffOptions) {
  return new Hono<AdminEnv>()
    .use("*", requireStaff(undefined, options))
    .get("/me", (c) => c.json(c.get("staff")));
}

export const admin = createAdmin();
