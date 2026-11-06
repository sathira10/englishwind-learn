import { NavLink, Outlet } from "react-router";
import { EmptyState } from "../components/EmptyState";
import { useAdminLoad } from "./api";

const links = [
  { to: "/admin", label: "Orders", end: true },
  { to: "/admin/orders/new", label: "New order" },
  { to: "/admin/students", label: "Students" },
  { to: "/admin/audit", label: "Audit log" },
];

/** The frame for every admin screen: who is signed in, and a nav that works with a thumb. */
export default function AdminLayout() {
  const [me] = useAdminLoad<{ email: string; role: string }>("/me");

  if (me.state === "loading") {
    return (
      <main className="ew-section">
        <div className="mx-auto max-w-page px-4">
          <p className="text-body text-fg">Loading...</p>
        </div>
      </main>
    );
  }
  if (me.state === "error") {
    return (
      <main className="ew-section">
        <div className="mx-auto max-w-page px-4">
          <EmptyState title="Not signed in as staff" headingLevel={2}>
            Sign in with the staff Google account, then reload this page.
          </EmptyState>
        </div>
      </main>
    );
  }

  return (
    <div>
      <header className="bg-surface-dark" data-surface="navy">
        <div className="mx-auto max-w-page px-4 py-3">
          <p className="m-0 text-base text-fg-on-dark-muted">Signed in as {me.data.email}</p>
          <nav aria-label="Admin" className="mt-2">
            <ul className="m-0 flex list-none flex-wrap gap-x-2 gap-y-1 p-0">
              {links.map((link) => (
                <li key={link.to} className="m-0 p-0">
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      `inline-flex min-h-12 items-center px-3 text-base font-bold text-fg-on-dark ${
                        isActive ? "underline decoration-2 underline-offset-8" : "no-underline"
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="ew-section">
        <div className="mx-auto max-w-page px-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
