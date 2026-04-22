import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { parseSkillFile, findSkillFiles } from "../src/parser/skill.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

describe("parseSkillFile", () => {
  it("parses a valid SKILL.md with frontmatter and body", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "valid-skill/SKILL.md"));
    expect(skill.frontmatter.description).toBe(
      "Review and enforce TypeScript coding standards across the project"
    );
    expect(skill.body).toContain("# Coding Standards");
    expect(skill.dirName).toBe("valid-skill");
    expect(skill.lineCount).toBeGreaterThan(0);
    expect(skill.wordCount).toBeGreaterThan(0);
  });

  it("parses a SKILL.md with no frontmatter", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "no-frontmatter/SKILL.md"));
    expect(skill.frontmatter).toEqual({});
    expect(skill.body).toContain("A skill without frontmatter");
  });

  it("parses a SKILL.md with empty body", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "empty-body/SKILL.md"));
    expect(skill.frontmatter.description).toBe(
      "An empty skill with no body content"
    );
    expect(skill.body.trim()).toBe("");
  });

  it("throws on nonexistent file", () => {
    expect(() => parseSkillFile("/nonexistent/SKILL.md")).toThrow(
      "SKILL.md not found"
    );
  });

  it("counts lines and words accurately", () => {
    const skill = parseSkillFile(resolve(FIXTURES, "valid-skill/SKILL.md"));
    const expectedLines = skill.body.trim().split("\n").length;
    expect(skill.lineCount).toBe(expectedLines);
    const expectedWords = skill.body
      .split(/\s+/)
      .filter(Boolean).length;
    expect(skill.wordCount).toBe(expectedWords);
  });
});

describe("findSkillFiles", () => {
  it("finds SKILL.md files in subdirectories", () => {
    const found = findSkillFiles(FIXTURES);
    expect(found.length).toBeGreaterThanOrEqual(5);
    expect(found.every((f) => f.endsWith("SKILL.md"))).toBe(true);
  });

  it("returns direct SKILL.md if dir contains one", () => {
    const found = findSkillFiles(resolve(FIXTURES, "valid-skill"));
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("valid-skill/SKILL.md");
  });

  it("returns empty array for nonexistent directory", () => {
    const found = findSkillFiles("/nonexistent/path");
    expect(found).toEqual([]);
  });
});
