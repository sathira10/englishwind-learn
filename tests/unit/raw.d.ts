// Vite raw imports in tests.
declare module "*?raw" {
  const source: string;
  export default source;
}
