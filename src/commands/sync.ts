import { resolve, relative, basename, dirname, join } from "path";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  cpSync,
} from "fs";
import chalk from "chalk";
import { findSkillFiles } from "../parser/skill.js";

export interface SyncOptions {
  target?: string;
  dryRun?: boolean;
  json?: boolean;
}

interface SyncAction {
  type: "create" | "update" | "unchanged";
  skill: string;
  source: string;
  target: string;
  reason?: string;
}

interface SyncReport {
  source: string;
  target: string;
  actions: SyncAction[];
  created: number;
  updated: number;
  unchanged: number;
}

function getSkillDirName(skillPath: string): string {
  // A skill lives in a directory named after the skill: <dir>/SKILL.md
  return basename(dirname(skillPath));
}

function fileContentsDiffer(pathA: string, pathB: string): boolean {
  if (!existsSync(pathA) || !existsSync(pathB)) return true;
  const a = readFileSync(pathA, "utf-8");
  const b = readFileSync(pathB, "utf-8");
  return a !== b;
}

function copySkillDir(sourceDir: string, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });

  const entries = readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(sourceDir, entry.name);
    const dstPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copySkillDir(srcPath, dstPath);
    } else {
      writeFileSync(dstPath, readFileSync(srcPath));
    }
  }
}

export async function syncCommand(
  sourcePath: string | undefined,
  options: SyncOptions
): Promise<void> {
  // Determine source directory
  const source = sourcePath
    ? resolve(process.cwd(), sourcePath)
    : findDefaultSource();

  if (!source) {
    console.log(chalk.red("\n  No skill source found."));
    console.log(chalk.dim("  Specify a source path or create one of:"));
    console.log(chalk.dim("    .skillmother/skills/"));
    console.log(chalk.dim("    .claude/skills/"));
    console.log(chalk.dim("    skills/"));
    process.exit(1);
  }

  if (!existsSync(source)) {
    console.log(chalk.red(`\n  Source not found: ${source}`));
    process.exit(1);
  }

  // Determine target directory
  const target = options.target
    ? resolve(process.cwd(), options.target)
    : getDefaultTarget();

  console.log(chalk.bold("\n  skillmother sync"));
  console.log(chalk.dim(`  Source: ${relative(process.cwd(), source) || source}`));
  console.log(chalk.dim(`  Target: ${relative(process.cwd(), target) || target}`));
  if (options.dryRun) {
    console.log(chalk.yellow("  (dry run — no changes will be made)"));
  }
  console.log();

  // Find skills in source
  const sourceSkills = findSkillFiles(source);
  if (sourceSkills.length === 0) {
    console.log(chalk.yellow("  No skills found in source directory."));
    process.exit(0);
  }

  const actions: SyncAction[] = [];

  for (const skillPath of sourceSkills) {
    const skillName = getSkillDirName(skillPath);
    const sourceDir = dirname(skillPath);
    const targetDir = resolve(target, skillName);
    const targetSkillPath = resolve(targetDir, "SKILL.md");

    if (!existsSync(targetSkillPath)) {
      actions.push({
        type: "create",
        skill: skillName,
        source: sourceDir,
        target: targetDir,
        reason: "New skill",
      });
    } else if (fileContentsDiffer(skillPath, targetSkillPath)) {
      actions.push({
        type: "update",
        skill: skillName,
        source: sourceDir,
        target: targetDir,
        reason: "Content changed",
      });
    } else {
      // Also check if any companion files (tests.json, etc.) differ
      let companionChanged = false;
      try {
        const sourceEntries = readdirSync(sourceDir);
        for (const entry of sourceEntries) {
          if (entry === "SKILL.md") continue;
          const srcFile = join(sourceDir, entry);
          const dstFile = join(targetDir, entry);
          if (statSync(srcFile).isFile() && fileContentsDiffer(srcFile, dstFile)) {
            companionChanged = true;
            break;
          }
        }
      } catch {
        // Ignore read errors
      }

      if (companionChanged) {
        actions.push({
          type: "update",
          skill: skillName,
          source: sourceDir,
          target: targetDir,
          reason: "Companion files changed",
        });
      } else {
        actions.push({
          type: "unchanged",
          skill: skillName,
          source: sourceDir,
          target: targetDir,
        });
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(actions, null, 2));
    return;
  }

  // Display actions
  for (const action of actions) {
    switch (action.type) {
      case "create":
        console.log(chalk.green(`  + ${action.skill}`) + chalk.dim(` (${action.reason})`));
        break;
      case "update":
        console.log(chalk.yellow(`  ~ ${action.skill}`) + chalk.dim(` (${action.reason})`));
        break;
      case "unchanged":
        console.log(chalk.dim(`  = ${action.skill} (up to date)`));
        break;
    }
  }

  // Execute actions (unless dry run)
  const toSync = actions.filter((a) => a.type !== "unchanged");

  if (toSync.length === 0) {
    console.log(chalk.green("\n  All skills are up to date."));
    return;
  }

  if (!options.dryRun) {
    console.log();
    for (const action of toSync) {
      copySkillDir(action.source, action.target);
      const icon = action.type === "create" ? chalk.green("  ✓") : chalk.yellow("  ✓");
      console.log(`${icon} Synced ${action.skill}`);
    }
  }

  // Summary
  const report: SyncReport = {
    source,
    target,
    actions,
    created: actions.filter((a) => a.type === "create").length,
    updated: actions.filter((a) => a.type === "update").length,
    unchanged: actions.filter((a) => a.type === "unchanged").length,
  };

  const parts: string[] = [];
  if (report.created > 0) parts.push(chalk.green(`${report.created} created`));
  if (report.updated > 0) parts.push(chalk.yellow(`${report.updated} updated`));
  if (report.unchanged > 0) parts.push(chalk.dim(`${report.unchanged} unchanged`));

  console.log(`\n  ${parts.join(", ")}`);

  if (options.dryRun && toSync.length > 0) {
    console.log(chalk.dim("\n  Run without --dry-run to apply changes."));
  }
}

function findDefaultSource(): string | null {
  const candidates = [
    resolve(process.cwd(), ".skillmother", "skills"),
    resolve(process.cwd(), "skills"),
    resolve(process.cwd(), ".claude", "skills"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  return null;
}

function getDefaultTarget(): string {
  // Default target: user's Claude Code skills directory
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return resolve(home, ".claude", "skills");
}
