import type { ParsedSkill } from "../../parser/skill.js";
import type { LintResult } from "../index.js";

const MAX_RECOMMENDED_LINES = 500;
const MAX_RECOMMENDED_WORDS = 5000;
const WARN_INSTRUCTION_COUNT = 150;

export function validateLength(skill: ParsedSkill): LintResult[] {
  const results: LintResult[] = [];

  if (skill.lineCount > MAX_RECOMMENDED_LINES) {
    results.push({
      rule: "length/too-long",
      severity: "warning",
      message: `Skill is ${skill.lineCount} lines (recommended max: ${MAX_RECOMMENDED_LINES}). LLMs reliably follow ~150-200 instructions; longer skills risk context rot.`,
      file: skill.path,
    });
  }

  if (skill.wordCount > MAX_RECOMMENDED_WORDS) {
    results.push({
      rule: "length/word-count",
      severity: "warning",
      message: `Skill is ${skill.wordCount} words (recommended max: ${MAX_RECOMMENDED_WORDS}). Consider splitting into multiple focused skills.`,
      file: skill.path,
    });
  }

  // Count imperative instructions (lines starting with -, *, or numbered)
  const instructionLines = skill.body
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed.match(/^[-*]\s/) ||
        trimmed.match(/^\d+[.)]\s/) ||
        trimmed.match(/^(always|never|must|should|do not|don't|ensure|avoid|use|prefer)\s/i)
      );
    });

  if (instructionLines.length > WARN_INSTRUCTION_COUNT) {
    results.push({
      rule: "length/instruction-overload",
      severity: "warning",
      message: `Found ~${instructionLines.length} instructions. LLMs reliably follow ~150-200 max. Beyond that, adherence drops significantly.`,
      file: skill.path,
    });
  }

  // Empty body
  if (skill.body.trim().length === 0) {
    results.push({
      rule: "length/empty-body",
      severity: "error",
      message: "SKILL.md has no body content after frontmatter",
      file: skill.path,
    });
  }

  return results;
}
