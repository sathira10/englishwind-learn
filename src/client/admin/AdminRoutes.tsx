import { Route, Routes } from "react-router";
import AdminLayout from "./AdminLayout";
import AuditPage from "./AuditPage";
import NewOrderPage from "./NewOrderPage";
import QueuePage from "./QueuePage";
import StudentPage from "./StudentPage";
import StudentsPage from "./StudentsPage";

// Mounted at /admin/* (plan 09). Loaded on demand so the student app does not carry it.
export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<QueuePage />} />
        <Route path="orders/new" element={<NewOrderPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:id" element={<StudentPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="*" element={<QueuePage />} />
      </Route>
    </Routes>
  );
}
