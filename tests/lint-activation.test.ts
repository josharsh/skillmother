import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { parseSkillFile } from "../src/parser/skill.js";
import { validateActivation } from "../src/linter/rules/activation.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

describe("activation rules", () => {
  it("passes a skill with a strong description", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "valid-skill/SKILL.md"));
    const results = validateActivation(skill);
    expect(results).toEqual([]);
  });

  it("warns on weak description starting with 'a skill'", () => {
    const skill = parseSkillFile(
      resolve(FIXTURES, "weak-activation/SKILL.md")
    );
    const results = validateActivation(skill);
    const weak = results.find(
      (r) => r.rule === "activation/weak-description"
    );
    expect(weak).toBeDefined();
    expect(weak!.severity).toBe("warning");
  });

  it("warns on description too brief (<5 words)", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "bad-name/SKILL.md"));
    const results = validateActivation(skill);
    const brief = results.find(
      (r) => r.rule === "activation/description-too-brief"
    );
    expect(brief).toBeDefined();
  });

  it("informs when description lacks action verbs", () => {
    const skill = parseSkillFile(
      resolve(FIXTURES, "weak-activation/SKILL.md")
    );
    const results = validateActivation(skill);
    const noVerb = results.find(
      (r) => r.rule === "activation/no-action-verb"
    );
    expect(noVerb).toBeDefined();
    expect(noVerb!.severity).toBe("info");
  });

  it("skips if no description present", () => {
    const skill = parseSkillFile(
      resolve(FIXTURES, "no-frontmatter/SKILL.md")
    );
    const results = validateActivation(skill);
    expect(results).toEqual([]);
  });
});
