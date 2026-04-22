import { resolve } from "path";
import chalk from "chalk";
import { parseSkillFile, findSkillFiles } from "../parser/skill.js";
import { lintSkill } from "../linter/index.js";
import { extractFileReferences } from "../linter/rules/references.js";
import { existsSync } from "fs";
import { dirname } from "path";

export interface ValidateOptions {
  projectRoot?: string;
  json?: boolean;
  ci?: boolean;
}

interface ValidationResult {
  skill: string;
  path: string;
  passed: boolean;
  lintErrors: number;
  lintWarnings: number;
  staleReferences: number;
  issues: string[];
}

export async function validateCommand(
  paths: string[],
  options: ValidateOptions
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

  if (!options.ci) {
    console.log(chalk.bold(`\nValidating ${uniquePaths.length} skill(s)...\n`));
  }

  const results: ValidationResult[] = [];

  for (const skillPath of uniquePaths) {
    try {
      const skill = parseSkillFile(skillPath);
      const issues: string[] = [];

      // Run lint
      const lintReport = lintSkill(skill, { projectRoot });

      // Run drift check (inline, without the full drift command)
      const refs = extractFileReferences(skill.body);
      const skillDir = dirname(skillPath);
      let staleCount = 0;

      for (const ref of refs) {
        if (!ref.includes("/")) continue;
        const fromRoot = resolve(projectRoot, ref);
        const fromSkill = resolve(skillDir, ref);
        if (!existsSync(fromRoot) && !existsSync(fromSkill)) {
          staleCount++;
          issues.push(`Stale reference: ${ref}`);
        }
      }

      // Collect lint issues
      for (const r of lintReport.results) {
        if (r.severity === "error") {
          issues.push(`[lint] ${r.message}`);
        }
      }

      const passed = lintReport.errors === 0 && staleCount === 0;

      results.push({
        skill: skill.frontmatter.name ?? skill.dirName,
        path: skillPath,
        passed,
        lintErrors: lintReport.errors,
        lintWarnings: lintReport.warnings,
        staleReferences: staleCount,
        issues,
      });
    } catch (err) {
      results.push({
        skill: skillPath,
        path: skillPath,
        passed: false,
        lintErrors: 1,
        lintWarnings: 0,
        staleReferences: 0,
        issues: [`Parse error: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else if (options.ci) {
    // Minimal CI output
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    for (const r of results) {
      if (r.passed) {
        console.log(`PASS ${r.skill}`);
      } else {
        console.log(`FAIL ${r.skill}`);
        for (const issue of r.issues) {
          console.log(`  ${issue}`);
        }
      }
    }

    console.log(`\n${passed} passed, ${failed} failed`);
  } else {
    for (const r of results) {
      if (r.passed) {
        console.log(chalk.green(`  ✓ ${r.skill}`));
      } else {
        console.log(chalk.red(`  ✗ ${r.skill}`));
        for (const issue of r.issues) {
          console.log(chalk.dim(`    ${issue}`));
        }
      }
    }

    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    const status = passed === total
      ? chalk.green.bold("PASS")
      : chalk.red.bold("FAIL");

    console.log(`\n${status} ${passed}/${total} skills validated`);
  }

  const hasFailures = results.some((r) => !r.passed);
  if (hasFailures) {
    process.exit(1);
  }
}
