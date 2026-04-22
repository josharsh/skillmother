import type { ParsedSkill } from "../../parser/skill.js";
import type { LintResult } from "../index.js";

// Based on 650-trial research: description wording has 20x impact on activation.
// Skills need strong, specific trigger words in description.
const WEAK_DESCRIPTIONS = [
  /^a skill/i,
  /^this skill/i,
  /^skill for/i,
  /^helper/i,
  /^utility/i,
  /^general/i,
  /^misc/i,
];

const MIN_DESCRIPTION_WORDS = 5;

export function validateActivation(skill: ParsedSkill): LintResult[] {
  const results: LintResult[] = [];
  const desc = skill.frontmatter.description;

  if (!desc) return results;

  // Check for weak/generic description
  for (const pattern of WEAK_DESCRIPTIONS) {
    if (pattern.test(desc)) {
      results.push({
        rule: "activation/weak-description",
        severity: "warning",
        message: `Description starts with a weak pattern ('${desc.substring(0, 30)}...'). Use specific, action-oriented keywords that Claude can match against user requests.`,
        file: skill.path,
      });
      break;
    }
  }

  // Check description word count
  const words = desc.split(/\s+/).filter(Boolean);
  if (words.length < MIN_DESCRIPTION_WORDS) {
    results.push({
      rule: "activation/description-too-brief",
      severity: "warning",
      message: `Description has only ${words.length} words. Aim for 5+ words with specific context about when this skill should activate.`,
      file: skill.path,
    });
  }

  // Check if description contains actionable verbs
  const actionVerbs = [
    "create", "build", "generate", "review", "analyze", "deploy",
    "test", "write", "fix", "debug", "refactor", "design", "implement",
    "configure", "setup", "migrate", "convert", "format", "validate",
    "optimize", "monitor", "document",
  ];
  const hasActionVerb = actionVerbs.some((verb) =>
    desc.toLowerCase().includes(verb)
  );
  if (!hasActionVerb) {
    results.push({
      rule: "activation/no-action-verb",
      severity: "info",
      message: `Description lacks common action verbs (create, build, review, test, etc.). Adding them improves activation reliability.`,
      file: skill.path,
    });
  }

  return results;
}
