import type { ParsedSkill } from "../parser/skill.js";
import { validateFrontmatter } from "./rules/frontmatter.js";
import { validateLength } from "./rules/length.js";
import { validateReferences } from "./rules/references.js";
import { validateActivation } from "./rules/activation.js";

export type Severity = "error" | "warning" | "info";

export interface LintResult {
  rule: string;
  severity: Severity;
  message: string;
  file: string;
  line?: number;
}

export interface LintReport {
  skill: string;
  path: string;
  results: LintResult[];
  errors: number;
  warnings: number;
  infos: number;
}

export function lintSkill(
  skill: ParsedSkill,
  options?: { projectRoot?: string }
): LintReport {
  const results: LintResult[] = [
    ...validateFrontmatter(skill),
    ...validateLength(skill),
    ...validateReferences(skill, options?.projectRoot),
    ...validateActivation(skill),
  ];

  return {
    skill: skill.frontmatter.name ?? skill.dirName,
    path: skill.path,
    results,
    errors: results.filter((r) => r.severity === "error").length,
    warnings: results.filter((r) => r.severity === "warning").length,
    infos: results.filter((r) => r.severity === "info").length,
  };
}
