import { z } from "zod";
import type { ParsedSkill } from "../../parser/skill.js";
import type { LintResult } from "../index.js";

const NAME_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const FrontmatterSchema = z.object({
  name: z
    .string()
    .min(1, "name is required")
    .max(64, "name must be 64 characters or less")
    .regex(NAME_REGEX, "name must be lowercase alphanumeric with hyphens, no leading/trailing/consecutive hyphens"),
  description: z
    .string()
    .min(1, "description is required")
    .max(1024, "description must be 1024 characters or less"),
  license: z.string().optional(),
  compatibility: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  "allowed-tools": z.string().optional(),
});

export function validateFrontmatter(skill: ParsedSkill): LintResult[] {
  const results: LintResult[] = [];
  const fm = skill.frontmatter;

  // Check required fields exist
  if (!fm.name && !fm.description) {
    // Tolerate skills that only have description (common pattern)
    if (!fm.description) {
      results.push({
        rule: "frontmatter/description-required",
        severity: "error",
        message: "SKILL.md must have a 'description' field in frontmatter",
        file: skill.path,
      });
    }
  }

  // If name is present, validate it
  if (fm.name) {
    if (fm.name.length > 64) {
      results.push({
        rule: "frontmatter/name-length",
        severity: "error",
        message: `name '${fm.name}' exceeds 64 characters (${fm.name.length})`,
        file: skill.path,
      });
    }
    if (!NAME_REGEX.test(fm.name)) {
      results.push({
        rule: "frontmatter/name-format",
        severity: "error",
        message: `name '${fm.name}' must be lowercase alphanumeric with hyphens`,
        file: skill.path,
      });
    }
    if (fm.name.includes("--")) {
      results.push({
        rule: "frontmatter/name-consecutive-hyphens",
        severity: "error",
        message: `name '${fm.name}' contains consecutive hyphens`,
        file: skill.path,
      });
    }
    // Name should match directory name
    if (fm.name !== skill.dirName) {
      results.push({
        rule: "frontmatter/name-dir-mismatch",
        severity: "warning",
        message: `name '${fm.name}' doesn't match directory name '${skill.dirName}'`,
        file: skill.path,
      });
    }
  }

  // Validate description quality
  if (fm.description) {
    if (fm.description.length > 1024) {
      results.push({
        rule: "frontmatter/description-length",
        severity: "error",
        message: `description exceeds 1024 characters (${fm.description.length})`,
        file: skill.path,
      });
    }
    if (fm.description.length < 10) {
      results.push({
        rule: "frontmatter/description-too-short",
        severity: "warning",
        message: "description is very short -- Claude may not activate this skill reliably",
        file: skill.path,
      });
    }
  }

  return results;
}
