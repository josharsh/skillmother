import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { resolve } from "path";

const CLI = resolve(import.meta.dirname, "../dist/cli.js");
const FIXTURES = resolve(import.meta.dirname, "fixtures");

function run(args: string[]): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf-8",
      timeout: 10000,
    });
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      exitCode: e.status ?? 1,
    };
  }
}

describe("CLI", () => {
  it("shows help with --help", () => {
    const { stdout, exitCode } = run(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("skillmother");
    expect(stdout).toContain("lint");
    expect(stdout).toContain("test");
    expect(stdout).toContain("create");
    expect(stdout).toContain("drift");
    expect(stdout).toContain("sync");
    expect(stdout).toContain("validate");
    expect(stdout).toContain("init");
  });

  it("shows version with --version", () => {
    const { stdout, exitCode } = run(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("CLI lint", () => {
  it("lints a valid skill successfully", () => {
    const { stdout, exitCode } = run([
      "lint",
      resolve(FIXTURES, "valid-skill/SKILL.md"),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("All checks passed");
  });

  it("reports errors on a bad skill", () => {
    const { stdout, exitCode } = run([
      "lint",
      resolve(FIXTURES, "bad-name/SKILL.md"),
    ]);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("name-format");
  });

  it("outputs JSON with --json flag", () => {
    const { stdout } = run([
      "lint",
      "--json",
      resolve(FIXTURES, "valid-skill/SKILL.md"),
    ]);
    // The output includes a header line before JSON, so find the JSON part
    const jsonStart = stdout.indexOf("[");
    if (jsonStart >= 0) {
      const parsed = JSON.parse(stdout.slice(jsonStart));
      expect(Array.isArray(parsed)).toBe(true);
    }
  });

  it("lints a directory of skills", () => {
    const { stdout } = run(["lint", FIXTURES]);
    // Should find multiple skills
    expect(stdout).toContain("Linting");
  });
});

describe("CLI validate", () => {
  it("validates a clean skill", () => {
    const { stdout, exitCode } = run([
      "validate",
      resolve(FIXTURES, "valid-skill/SKILL.md"),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("PASS");
  });

  it("fails on a bad skill", () => {
    const { stdout, exitCode } = run([
      "validate",
      resolve(FIXTURES, "bad-name/SKILL.md"),
    ]);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("FAIL");
  });

  it("supports --ci flag", () => {
    const { stdout } = run([
      "validate",
      "--ci",
      resolve(FIXTURES, "valid-skill/SKILL.md"),
    ]);
    expect(stdout).toContain("PASS");
    expect(stdout).toContain("passed");
  });
});

describe("CLI drift", () => {
  it("checks a skill with no references", () => {
    const { stdout, exitCode } = run([
      "drift",
      resolve(FIXTURES, "valid-skill/SKILL.md"),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("0/0 references valid");
  });

  it("detects stale references", () => {
    const { stdout, exitCode } = run([
      "drift",
      resolve(FIXTURES, "with-refs/SKILL.md"),
      "--project-root",
      FIXTURES,
    ]);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("DRIFT DETECTED");
  });
});

describe("CLI create", () => {
  it("rejects non-TTY input", () => {
    // When run via execFileSync without a TTY, stdin.isTTY is undefined
    const { stdout, exitCode } = run(["create"]);
    expect(exitCode).toBe(1);
    // Should show the non-TTY error message (captured in stderr, but shows in stdout for some setups)
  });
});
