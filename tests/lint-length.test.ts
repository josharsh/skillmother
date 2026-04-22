import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { parseSkillFile } from "../src/parser/skill.js";
import { validateLength } from "../src/linter/rules/length.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

describe("length rules", () => {
  it("passes a normal-length skill", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "valid-skill/SKILL.md"));
    const results = validateLength(skill);
    expect(results).toEqual([]);
  });

  it("errors on empty body", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "empty-body/SKILL.md"));
    const results = validateLength(skill);
    const emptyRule = results.find((r) => r.rule === "length/empty-body");
    expect(emptyRule).toBeDefined();
    expect(emptyRule!.severity).toBe("error");
  });

  it("warns on instruction overload (>150 instructions)", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "long-skill/SKILL.md"));
    const results = validateLength(skill);
    const overload = results.find(
      (r) => r.rule === "length/instruction-overload"
    );
    expect(overload).toBeDefined();
    expect(overload!.severity).toBe("warning");
  });
});
