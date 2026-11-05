import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import OrderPage from "./OrderPage";

// Dev-only specimen page. The condition is a build-time constant, so production builds drop both
// the route and the import.
const AdminRoutes = lazy(() => import("./admin/AdminRoutes"));
const ComponentsPage = import.meta.env.DEV ? lazy(() => import("./dev/ComponentsPage")) : null;

// Placeholder shell. Screens arrive with their slices (plans/roadmap.md).
export function App() {
  return (
    <Routes>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={null}>
            <AdminRoutes />
          </Suspense>
        }
      />
      <Route path="/order/:offer" element={<OrderPage />} />
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
