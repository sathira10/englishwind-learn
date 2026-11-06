import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { CoursePage } from "./screens/CoursePage";
import { LessonPage } from "./screens/LessonPage";
import { MyCourses } from "./screens/MyCourses";
import { NotFoundScreen, Shell } from "./screens/Shell";
import { SignIn } from "./screens/SignIn";
import OrderPage from "./OrderPage";

// Dev-only specimen page. The condition is a build-time constant, so production builds drop both
// the route and the import.
const AdminRoutes = lazy(() => import("./admin/AdminRoutes"));
const ComponentsPage = import.meta.env.DEV ? lazy(() => import("./dev/ComponentsPage")) : null;

// Student screens, the order form, the lazy admin and the dev routes. `*` stays last.
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
