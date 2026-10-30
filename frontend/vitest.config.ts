import { defineConfig } from "vitest/config";

// Pure helpers under src/lib and markup-only component tests (react-dom/server,
// no DOM) run in the node environment. See AGENTS.md.
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
