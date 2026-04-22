import { resolve } from "path";
import chalk from "chalk";
import { parseSkillFile, findSkillFiles } from "../parser/skill.js";
import { lintSkill } from "../linter/index.js";
import { formatLintReport, formatLintSummary } from "../utils/format.js";

export interface LintOptions {
  projectRoot?: string;
  json?: boolean;
}

export async function lintCommand(
  paths: string[],
  options: LintOptions
): Promise<void> {
  const skillPaths: string[] = [];

  if (paths.length === 0) {
    // Default: look in current directory and common skill locations
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

    if (skillPaths.length === 0) {
      console.log(
        chalk.yellow(
          "No SKILL.md files found. Searched: .claude/skills/, .skillmother/skills/, skills/, ."
        )
      );
      process.exit(0);
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

  // Deduplicate
  const uniquePaths = [...new Set(skillPaths)];

  console.log(chalk.bold(`\nLinting ${uniquePaths.length} skill(s)...\n`));

  const reports = [];
  for (const skillPath of uniquePaths) {
    try {
      const skill = parseSkillFile(skillPath);
      const report = lintSkill(skill, {
        projectRoot: options.projectRoot ?? process.cwd(),
      });
      reports.push(report);
    } catch (err) {
      console.log(
        chalk.red(
          `  ✗ Failed to parse ${skillPath}: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  }

  if (options.json) {
    console.log(JSON.stringify(reports, null, 2));
    return;
  }

  for (const report of reports) {
    console.log(formatLintReport(report));
    console.log();
  }

  console.log(formatLintSummary(reports));

  const hasErrors = reports.some((r) => r.errors > 0);
  if (hasErrors) {
    process.exit(1);
  }
}
