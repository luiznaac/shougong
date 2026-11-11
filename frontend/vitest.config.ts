import { configDefaults, defineConfig } from "vitest/config";

// Two lanes, split by file name:
// - `*.test.{ts,tsx}` — pure helpers and markup-only component tests, node environment.
// - `*.dom.test.tsx` — DOM component interaction tests through React Testing Library, jsdom.
// See AGENTS.md and CODING_STANDARDS.md.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: [...configDefaults.exclude, "src/**/*.dom.test.tsx"],
        },
      },
      {
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.dom.test.tsx"],
          setupFiles: ["./src/test/domSetup.ts"],
        },
      },
    ],
  },
});
