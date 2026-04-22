import { describe, it, expect } from "vitest";
import {
  normalizeName,
  validateDescription,
  generateSkillMd,
  generateTestsJson,
  type SkillAnswers,
} from "../src/commands/create.js";

describe("normalizeName", () => {
  it("lowercases and converts spaces to hyphens", () => {
    expect(normalizeName("My Cool Skill")).toBe("my-cool-skill");
  });

  it("removes special characters", () => {
    expect(normalizeName("skill@v2!")).toBe("skill-v2");
  });

  it("collapses consecutive hyphens", () => {
    expect(normalizeName("my--bad---name")).toBe("my-bad-name");
  });

  it("strips leading and trailing hyphens", () => {
    expect(normalizeName("-leading-")).toBe("leading");
  });

  it("truncates to 64 characters", () => {
    const long = "a".repeat(100);
    expect(normalizeName(long).length).toBe(64);
  });

  it("handles already-valid names", () => {
    expect(normalizeName("valid-name")).toBe("valid-name");
  });
});

describe("validateDescription", () => {
  it("returns no issues for a good description", () => {
    const issues = validateDescription(
      "Review and enforce TypeScript coding standards across the project"
    );
    expect(issues).toEqual([]);
  });

  it("flags descriptions that are too short", () => {
    const issues = validateDescription("fix bugs");
    expect(issues.some((i) => i.includes("too short"))).toBe(true);
  });

  it("flags descriptions without action verbs", () => {
    const issues = validateDescription(
      "A comprehensive set of patterns for the codebase"
    );
    expect(issues.some((i) => i.includes("action verb"))).toBe(true);
  });

  it("flags weak starting phrases", () => {
    const issues = validateDescription(
      "A skill that helps developers write better code and review changes"
    );
    expect(issues.some((i) => i.includes("generic phrases"))).toBe(true);
  });
});

describe("generateSkillMd", () => {
  const baseAnswers: SkillAnswers = {
    name: "test-skill",
    description: "Test and validate code quality across the project",
    domain: "TypeScript web application",
    keyFiles: ["src/index.ts", "src/utils/helpers.ts"],
    patterns: ["Use async/await"],
    antiPatterns: ["Never use var"],
    instructions: ["Always use strict mode"],
    outputFormat: "",
    userInvocable: false,
    allowedTools: "",
    argumentHint: "",
  };

  it("generates valid frontmatter", () => {
    const md = generateSkillMd(baseAnswers);
    expect(md).toMatch(/^---\n/);
    expect(md).toContain(
      "description: Test and validate code quality across the project"
    );
    expect(md).toContain("---\n");
  });

  it("generates a title from the name", () => {
    const md = generateSkillMd(baseAnswers);
    expect(md).toContain("# Test Skill");
  });

  it("includes domain context", () => {
    const md = generateSkillMd(baseAnswers);
    expect(md).toContain("TypeScript web application");
  });

  it("lists key files", () => {
    const md = generateSkillMd(baseAnswers);
    expect(md).toContain("## Key Files");
    expect(md).toContain("`src/index.ts`");
    expect(md).toContain("`src/utils/helpers.ts`");
  });

  it("lists instructions", () => {
    const md = generateSkillMd(baseAnswers);
    expect(md).toContain("## Instructions");
    expect(md).toContain("- Always use strict mode");
  });

  it("lists patterns and anti-patterns", () => {
    const md = generateSkillMd(baseAnswers);
    expect(md).toContain("## Patterns");
    expect(md).toContain("- Use async/await");
    expect(md).toContain("## Anti-Patterns");
    expect(md).toContain("- Never use var");
  });

  it("includes $ARGUMENTS for user-invocable skills", () => {
    const md = generateSkillMd({ ...baseAnswers, userInvocable: true });
    expect(md).toContain("$ARGUMENTS");
    expect(md).toContain("user-invocable: true");
  });

  it("omits $ARGUMENTS for non-invocable skills", () => {
    const md = generateSkillMd(baseAnswers);
    expect(md).not.toContain("$ARGUMENTS");
    expect(md).not.toContain("user-invocable");
  });

  it("includes allowed-tools and argument-hint when set", () => {
    const md = generateSkillMd({
      ...baseAnswers,
      userInvocable: true,
      allowedTools: "Bash, Read",
      argumentHint: "<file-path>",
    });
    expect(md).toContain("allowed-tools: Bash, Read");
    expect(md).toContain("argument-hint: <file-path>");
  });

  it("omits empty sections", () => {
    const minimal = generateSkillMd({
      ...baseAnswers,
      keyFiles: [],
      patterns: [],
      antiPatterns: [],
      instructions: [],
    });
    expect(minimal).not.toContain("## Key Files");
    expect(minimal).not.toContain("## Patterns");
    expect(minimal).not.toContain("## Anti-Patterns");
    expect(minimal).not.toContain("## Instructions");
  });
});

describe("generateTestsJson", () => {
  const baseAnswers: SkillAnswers = {
    name: "test-skill",
    description: "Validate code quality",
    domain: "TypeScript project",
    keyFiles: ["src/index.ts"],
    patterns: ["Use async/await"],
    antiPatterns: ["Never use var", "Avoid console.log"],
    instructions: [],
    outputFormat: "",
    userInvocable: false,
    allowedTools: "",
    argumentHint: "",
  };

  it("generates valid JSON", () => {
    const json = generateTestsJson(baseAnswers);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("always includes a primary instruction test", () => {
    const config = JSON.parse(generateTestsJson(baseAnswers));
    expect(config.tests[0].name).toBe("follows primary instruction");
  });

  it("generates anti-pattern tests", () => {
    const config = JSON.parse(generateTestsJson(baseAnswers));
    const antiTests = config.tests.filter((t: { name: string }) =>
      t.name.startsWith("avoids:")
    );
    expect(antiTests.length).toBe(2);
  });

  it("generates file reference test when keyFiles provided", () => {
    const config = JSON.parse(generateTestsJson(baseAnswers));
    const fileTest = config.tests.find(
      (t: { name: string }) => t.name === "references key files when relevant"
    );
    expect(fileTest).toBeDefined();
    expect(fileTest.assert[0].value).toBe("src/index.ts");
  });

  it("generates pattern test when patterns provided", () => {
    const config = JSON.parse(generateTestsJson(baseAnswers));
    const patternTest = config.tests.find(
      (t: { name: string }) => t.name === "uses expected patterns"
    );
    expect(patternTest).toBeDefined();
  });

  it("limits anti-pattern tests to 3", () => {
    const answers = {
      ...baseAnswers,
      antiPatterns: ["a", "b", "c", "d", "e"],
    };
    const config = JSON.parse(generateTestsJson(answers));
    const antiTests = config.tests.filter((t: { name: string }) =>
      t.name.startsWith("avoids:")
    );
    expect(antiTests.length).toBe(3);
  });

  it("sets the skill name and model", () => {
    const config = JSON.parse(generateTestsJson(baseAnswers));
    expect(config.skill).toBe("test-skill");
    expect(config.model).toBe("claude-haiku-4-5-20250501");
  });
});
