import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { loadTestConfig } from "../src/tester/runner.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

describe("loadTestConfig", () => {
  it("loads a valid JSON test config", () => {
    const config = loadTestConfig(
      resolve(FIXTURES, "valid-skill/tests.json")
    );
    expect(config.skill).toBe("valid-skill");
    expect(config.tests).toHaveLength(1);
    expect(config.tests[0].name).toBe("uses strict mode");
    expect(config.tests[0].prompt).toBe("Create a new file");
    expect(config.tests[0].assert).toHaveLength(1);
    expect(config.tests[0].assert[0].type).toBe("contains");
    expect(config.tests[0].assert[0].value).toBe("const");
  });
});

// Note: runTests() requires ANTHROPIC_API_KEY and makes real API calls.
// Those are integration tests that should be run manually, not in CI.
// The assertion evaluation logic is tested via the lint/create tests.
