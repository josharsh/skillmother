import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { parseSkillFile } from "../src/parser/skill.js";
import {
  extractFileReferences,
  validateReferences,
} from "../src/linter/rules/references.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

describe("extractFileReferences", () => {
  it("extracts paths with directory separators", () => {
    const refs = extractFileReferences("Check `src/index.ts` for the entry point.");
    expect(refs).toContain("src/index.ts");
  });

  it("extracts relative paths", () => {
    const refs = extractFileReferences("Run `./setup.sh` first.");
    expect(refs).toContain("./setup.sh");
  });

  it("ignores URLs", () => {
    const refs = extractFileReferences(
      "See https://example.com/page.html for docs."
    );
    expect(refs).not.toContain("https://example.com/page.html");
  });

  it("ignores domain-like extensions (.com, .org, .io)", () => {
    const refs = extractFileReferences("Visit example.com for info.");
    expect(refs).toEqual([]);
  });

  it("extracts multiple unique references", () => {
    const body = `
      Use src/routes/api.ts for endpoints.
      Config is in config/db.json file.
      Also check src/routes/api.ts again.
    `;
    const refs = extractFileReferences(body);
    expect(refs).toContain("src/routes/api.ts");
    expect(refs).toContain("config/db.json");
    // Deduplication
    expect(refs.filter((r) => r === "src/routes/api.ts")).toHaveLength(1);
  });
});

describe("validateReferences", () => {
  it("reports missing files with directory paths", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "with-refs/SKILL.md"));
    const results = validateReferences(skill, FIXTURES);
    const missing = results.filter(
      (r) => r.rule === "references/file-not-found"
    );
    // src/nonexistent/missing.ts and ./also-missing.sh should be flagged
    // src/index.ts, config/settings.json are also missing from fixtures but contain /
    // example.tsx has no / so should be skipped
    expect(missing.length).toBeGreaterThanOrEqual(2);
    expect(
      missing.some((r) => r.message.includes("nonexistent/missing.ts"))
    ).toBe(true);
    expect(
      missing.some((r) => r.message.includes("also-missing.sh"))
    ).toBe(true);
  });

  it("skips standalone filenames without directory separators", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "with-refs/SKILL.md"));
    const results = validateReferences(skill, FIXTURES);
    const exampleRef = results.find((r) =>
      r.message.includes("example.tsx")
    );
    expect(exampleRef).toBeUndefined();
  });

  it("returns empty for a skill with no file references", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "valid-skill/SKILL.md"));
    const results = validateReferences(skill, FIXTURES);
    expect(results).toEqual([]);
  });
});
