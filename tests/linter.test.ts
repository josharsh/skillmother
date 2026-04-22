import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { parseSkillFile } from "../src/parser/skill.js";
import { lintSkill } from "../src/linter/index.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

describe("lintSkill (integration)", () => {
  it("passes a valid skill with zero errors", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "valid-skill/SKILL.md"));
    const report = lintSkill(skill);
    expect(report.errors).toBe(0);
    expect(report.skill).toBeDefined();
    expect(report.path).toContain("valid-skill/SKILL.md");
  });

  it("catches multiple issues on a bad skill", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "bad-name/SKILL.md"));
    const report = lintSkill(skill);
    expect(report.errors).toBeGreaterThan(0);
    // Should have name-format error and description-too-short warning
    const rules = report.results.map((r) => r.rule);
    expect(rules).toContain("frontmatter/name-format");
    expect(rules).toContain("frontmatter/description-too-short");
  });

  it("errors on empty body", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "empty-body/SKILL.md"));
    const report = lintSkill(skill);
    expect(report.errors).toBeGreaterThan(0);
    expect(report.results.some((r) => r.rule === "length/empty-body")).toBe(
      true
    );
  });

  it("reports correct error/warning/info counts", () => {
    const skill = parseSkillFile(
      resolve(FIXTURES, "weak-activation/SKILL.md")
    );
    const report = lintSkill(skill);
    const errorCount = report.results.filter(
      (r) => r.severity === "error"
    ).length;
    const warnCount = report.results.filter(
      (r) => r.severity === "warning"
    ).length;
    const infoCount = report.results.filter(
      (r) => r.severity === "info"
    ).length;
    expect(report.errors).toBe(errorCount);
    expect(report.warnings).toBe(warnCount);
    expect(report.infos).toBe(infoCount);
  });

  it("uses dirName as skill name when frontmatter name is missing", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "valid-skill/SKILL.md"));
    const report = lintSkill(skill);
    expect(report.skill).toBe("valid-skill");
  });
});
