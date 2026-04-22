import { resolve, dirname, relative } from "path";
import { existsSync, readFileSync, statSync, readdirSync } from "fs";
import chalk from "chalk";
import { parseSkillFile, findSkillFiles } from "../parser/skill.js";
import { extractFileReferences } from "../linter/rules/references.js";

export interface DriftOptions {
  projectRoot?: string;
  json?: boolean;
  fix?: boolean;
}

interface DriftIssue {
  type: "missing-file" | "stale-reference" | "empty-reference";
  reference: string;
  message: string;
  suggestion?: string;
}

interface DriftReport {
  skill: string;
  path: string;
  issues: DriftIssue[];
  checkedReferences: number;
  validReferences: number;
}

// Extract inline code references (backtick-wrapped paths)
function extractInlineCodeRefs(body: string): string[] {
  const refs: string[] = [];
  const inlineCodeRegex = /`([^`]+)`/g;
  let match;

  while ((match = inlineCodeRegex.exec(body)) !== null) {
    const content = match[1].trim();
    // Only include things that look like file paths
    if (
      content.includes("/") &&
      !content.includes(" ") &&
      !content.startsWith("http") &&
      !content.startsWith("$")
    ) {
      refs.push(content);
    }
  }

  return [...new Set(refs)];
}

// Try to find similar files when one is missing (rename detection)
function findSimilarFiles(
  missingPath: string,
  projectRoot: string
): string[] {
  const fileName = missingPath.split("/").pop() ?? "";
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const ext = fileName.split(".").pop() ?? "";
  const suggestions: string[] = [];

  // Try common renames: index -> mod, .js -> .ts, etc.
  const nameVariants = [
    baseName,
    baseName.replace(/-/g, "_"),
    baseName.replace(/_/g, "-"),
    `${baseName}.${ext === "js" ? "ts" : ext === "ts" ? "js" : ext}`,
  ];

  // Walk up the path to find the deepest existing directory
  const parts = missingPath.split("/");
  let existingPrefix = "";
  for (let i = 0; i < parts.length - 1; i++) {
    const check = resolve(projectRoot, parts.slice(0, i + 1).join("/"));
    if (existsSync(check) && statSync(check).isDirectory()) {
      existingPrefix = parts.slice(0, i + 1).join("/");
    } else {
      break;
    }
  }

  // If we found a partial match, scan that directory for similar files
  if (existingPrefix) {
    const searchDir = resolve(projectRoot, existingPrefix);
    try {
      const entries = readdirSync(searchDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const entryBase = entry.name.replace(/\.[^.]+$/, "");
          if (
            nameVariants.some(
              (v) =>
                entryBase.toLowerCase() === v.toLowerCase() ||
                entryBase.includes(baseName)
            )
          ) {
            suggestions.push(`${existingPrefix}/${entry.name}`);
          }
        }
      }
    } catch {
      // Directory not readable
    }
  }

  return suggestions.slice(0, 3);
}

function analyzeSkillDrift(
  skillPath: string,
  projectRoot: string
): DriftReport {
  const skill = parseSkillFile(skillPath);
  const skillDir = dirname(skillPath);

  // Get all file references from the skill body
  const regexRefs = extractFileReferences(skill.body);
  const inlineRefs = extractInlineCodeRefs(skill.body);
  const allRefs = [...new Set([...regexRefs, ...inlineRefs])];

  const issues: DriftIssue[] = [];
  let validCount = 0;

  for (const ref of allRefs) {
    // Skip standalone filenames without directory separators (likely examples)
    if (!ref.includes("/")) continue;

    // Try resolving from project root and skill directory
    const fromRoot = resolve(projectRoot, ref);
    const fromSkill = resolve(skillDir, ref);

    if (existsSync(fromRoot) || existsSync(fromSkill)) {
      validCount++;
      continue;
    }

    // File not found — this is drift
    const suggestions = findSimilarFiles(ref, projectRoot);
    const issue: DriftIssue = {
      type: "missing-file",
      reference: ref,
      message: `Referenced file not found: ${ref}`,
    };

    if (suggestions.length > 0) {
      issue.type = "stale-reference";
      issue.message = `File appears to have moved or been renamed: ${ref}`;
      issue.suggestion = `Did you mean: ${suggestions.join(", ")}?`;
    }

    issues.push(issue);
  }

  return {
    skill: skill.frontmatter.name ?? skill.dirName,
    path: skillPath,
    issues,
    checkedReferences: allRefs.filter((r) => r.includes("/")).length,
    validReferences: validCount,
  };
}

function formatDriftReport(report: DriftReport): string {
  const lines: string[] = [];

  if (report.issues.length === 0) {
    lines.push(
      chalk.green(
        `  ${report.skill}: ${report.validReferences}/${report.checkedReferences} references valid`
      )
    );
    return lines.join("\n");
  }

  lines.push(chalk.bold(`  ${report.skill} (${report.path})`));
  lines.push(
    chalk.dim(
      `  ${report.validReferences}/${report.checkedReferences} references valid, ${report.issues.length} drifted`
    )
  );

  for (const issue of report.issues) {
    const icon =
      issue.type === "stale-reference"
        ? chalk.yellow("  ⚠")
        : chalk.red("  ✗");

    lines.push(`${icon} ${issue.message}`);
    if (issue.suggestion) {
      lines.push(chalk.cyan(`    → ${issue.suggestion}`));
    }
  }

  return lines.join("\n");
}

export async function driftCommand(
  paths: string[],
  options: DriftOptions
): Promise<void> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const skillPaths: string[] = [];

  if (paths.length === 0) {
    const defaultPaths = [
      ".claude/skills",
      ".skillmother/skills",
      "skills",
      ".",
    ];
    for (const p of defaultPaths) {
      const found = findSkillFiles(resolve(process.cwd(), p));
      skillPaths.push(...found);
    }
  } else {
    for (const p of paths) {
      const resolved = resolve(process.cwd(), p);
      if (resolved.endsWith("SKILL.md")) {
        skillPaths.push(resolved);
      } else {
        skillPaths.push(...findSkillFiles(resolved));
      }
    }
  }

  const uniquePaths = [...new Set(skillPaths)];

  if (uniquePaths.length === 0) {
    console.log(chalk.yellow("No SKILL.md files found."));
    process.exit(0);
  }

  console.log(
    chalk.bold(
      `\nChecking ${uniquePaths.length} skill(s) for drift against ${relative(process.cwd(), projectRoot) || "."}/\n`
    )
  );

  const reports: DriftReport[] = [];

  for (const skillPath of uniquePaths) {
    try {
      const report = analyzeSkillDrift(skillPath, projectRoot);
      reports.push(report);
    } catch (err) {
      console.log(
        chalk.red(
          `  ✗ Failed to analyze ${skillPath}: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  }

  if (options.json) {
    console.log(JSON.stringify(reports, null, 2));
    return;
  }

  for (const report of reports) {
    console.log(formatDriftReport(report));
    console.log();
  }

  // Summary
  const totalIssues = reports.reduce((s, r) => s + r.issues.length, 0);
  const totalChecked = reports.reduce((s, r) => s + r.checkedReferences, 0);
  const totalValid = reports.reduce((s, r) => s + r.validReferences, 0);

  const status =
    totalIssues > 0
      ? chalk.yellow.bold("DRIFT DETECTED")
      : chalk.green.bold("NO DRIFT");

  console.log(
    `${status} ${totalValid}/${totalChecked} references valid across ${reports.length} skill(s)`
  );

  if (totalIssues > 0) {
    console.log(
      chalk.dim(
        `\n  ${totalIssues} stale reference(s) found. Update your SKILL.md files to match the current codebase.`
      )
    );
    process.exit(1);
  }
}
