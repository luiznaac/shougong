import { defineConfig } from "vitest/config";

// Only src/lib/** is under test — pure logic, no React rendering. See AGENTS.md: this lane
// doesn't set up component/render tests yet, and `npm test` allows an empty suite.
export default defineConfig({
  test: {
    include: ["src/lib/**/*.test.ts"],
    environment: "node",
  },
});
