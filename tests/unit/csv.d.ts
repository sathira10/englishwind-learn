// Vite imports a fixture as text (tests/unit/buyer-import.test.ts).
declare module "*.csv?raw" {
  const text: string;
  export default text;
}
