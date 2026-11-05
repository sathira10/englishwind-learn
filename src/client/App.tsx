import { Route, Routes } from "react-router";

// Placeholder shell. Screens arrive with their slices (plans/roadmap.md).
export function App() {
  return (
    <Routes>
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
