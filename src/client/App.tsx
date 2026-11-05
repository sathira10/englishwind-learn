import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes } from "react-router";

// Dev-only specimen page. The condition is a build-time constant, so production builds drop both
// the route and the import.
const ComponentsPage = import.meta.env.DEV ? lazy(() => import("./dev/ComponentsPage")) : null;

// Placeholder shell. Screens arrive with their slices (plans/roadmap.md).
export function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<Admin />} />
      {ComponentsPage ? (
        <Route
          path="/dev/components"
          element={
            <Suspense fallback={null}>
              <ComponentsPage />
            </Suspense>
          }
        />
      ) : null}
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

// Slice 09 builds the real admin. For now it only shows who the Worker says you are.
function Admin() {
  const [who, setWho] = useState("Checking...");
  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => (r.ok ? (r.json() as Promise<{ email: string }>) : Promise.reject(r.status)))
      .then((me) => setWho(`Signed in as ${me.email}`))
      .catch(() => setWho("Not signed in as staff"));
  }, []);
  return (
    <main className="ew-section">
      <div className="mx-auto max-w-page px-4">
        <h1 className="font-display text-h2 font-bold text-fg-strong">Admin</h1>
        <p className="mt-4 max-w-measure text-body text-fg">{who}</p>
      </div>
    </main>
  );
}

function Home() {
  return (
    <main className="ew-section">
      <div className="mx-auto max-w-page px-4">
        <h1 className="font-display text-h2 font-bold text-fg-strong">EnglishWind Learn</h1>
        <p className="mt-4 max-w-measure text-body text-fg">
          The learning app is being built. Lessons will appear here.
        </p>
      </div>
    </main>
  );
}
