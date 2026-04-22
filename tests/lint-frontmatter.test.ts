import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { parseSkillFile } from "../src/parser/skill.js";
import { validateFrontmatter } from "../src/linter/rules/frontmatter.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

describe("frontmatter rules", () => {
  it("passes a valid skill with description", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "valid-skill/SKILL.md"));
    const results = validateFrontmatter(skill);
    expect(results).toEqual([]);
  });

  it("errors on missing description", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "no-frontmatter/SKILL.md"));
    const results = validateFrontmatter(skill);
    const descRule = results.find(
      (r) => r.rule === "frontmatter/description-required"
    );
    expect(descRule).toBeDefined();
    expect(descRule!.severity).toBe("error");
  });

  it("errors on invalid name format", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "bad-name/SKILL.md"));
    const results = validateFrontmatter(skill);
    const nameRule = results.find(
      (r) => r.rule === "frontmatter/name-format"
    );
    expect(nameRule).toBeDefined();
    expect(nameRule!.severity).toBe("error");
  });

  it("warns on short description", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "bad-name/SKILL.md"));
    const results = validateFrontmatter(skill);
    const shortDesc = results.find(
      (r) => r.rule === "frontmatter/description-too-short"
    );
    expect(shortDesc).toBeDefined();
    expect(shortDesc!.severity).toBe("warning");
  });

  it("warns on name-directory mismatch", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "bad-name/SKILL.md"));
    const results = validateFrontmatter(skill);
    const mismatch = results.find(
      (r) => r.rule === "frontmatter/name-dir-mismatch"
    );
    expect(mismatch).toBeDefined();
  });
});
