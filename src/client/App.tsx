import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes } from "react-router";
import { CoursePage } from "./screens/CoursePage";
import { LessonPage } from "./screens/LessonPage";
import { MyCourses } from "./screens/MyCourses";
import { NotFoundScreen, Shell } from "./screens/Shell";
import { SignIn } from "./screens/SignIn";
import OrderPage from "./OrderPage";

// Dev-only specimen page. The condition is a build-time constant, so production builds drop both
// the route and the import.
const ComponentsPage = import.meta.env.DEV ? lazy(() => import("./dev/ComponentsPage")) : null;

// Student screens are slice 06; the admin and the order form arrive with their slices.
export function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<Admin />} />
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
      <Route path="/" element={<MyCourses />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/courses/:courseId" element={<CoursePage />} />
      <Route path="/courses/:courseId/lessons/:key" element={<LessonPage />} />
      <Route
        path="*"
        element={
          <Shell signedIn={false}>
            <NotFoundScreen />
          </Shell>
        }
      />
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
