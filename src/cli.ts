#!/usr/bin/env node

import { Command } from "commander";
import { lintCommand } from "./commands/lint.js";
import { testCommand } from "./commands/test.js";
import { createCommand } from "./commands/create.js";
import { driftCommand } from "./commands/drift.js";
import { syncCommand } from "./commands/sync.js";
import { validateCommand } from "./commands/validate.js";

const program = new Command();

program
  .name("skillmother")
  .description(
    "The CI/CD pipeline for AI coding skills. Lint, test, and govern SKILL.md files."
  )
  .version("0.2.0");

program
  .command("lint")
  .description("Lint SKILL.md files for common issues and anti-patterns")
  .argument("[paths...]", "Paths to SKILL.md files or directories containing them")
  .option("--project-root <dir>", "Project root for resolving file references")
  .option("--json", "Output results as JSON")
  .action(async (paths: string[], options) => {
    await lintCommand(paths, {
      projectRoot: options.projectRoot,
      json: options.json,
    });
  });

program
  .command("test")
  .description("Run behavioral tests against skills using Claude")
  .argument(
    "[paths...]",
    "Paths to SKILL.md files, test files, or directories"
  )
  .option(
    "--model <model>",
    "Claude model to use for testing",
    "claude-haiku-4-5-20250501"
  )
  .option("--verbose", "Show full Claude responses")
  .option("--json", "Output results as JSON")
  .action(async (paths: string[], options) => {
    await testCommand(paths, {
      model: options.model,
      verbose: options.verbose,
      json: options.json,
    });
  });

program
  .command("create")
  .description("Create a new skill through guided knowledge extraction")
  .option(
    "--output <dir>",
    "Output directory (default: .claude/skills/)"
  )
  .action(async (options) => {
    await createCommand({
      output: options.output,
    });
  });

program
  .command("drift")
  .description("Detect stale file references in skills that no longer match the codebase")
  .argument("[paths...]", "Paths to SKILL.md files or directories containing them")
  .option("--project-root <dir>", "Project root to resolve file references against")
  .option("--json", "Output results as JSON")
  .action(async (paths: string[], options) => {
    await driftCommand(paths, {
      projectRoot: options.projectRoot,
      json: options.json,
    });
  });

program
  .command("sync")
  .description("Sync skills from a shared source to your local Claude Code setup")
  .argument("[source]", "Source directory containing skills to sync from")
  .option(
    "--target <dir>",
    "Target directory (default: ~/.claude/skills/)"
  )
  .option("--dry-run", "Show what would be synced without making changes")
  .option("--json", "Output results as JSON")
  .action(async (source: string | undefined, options) => {
    await syncCommand(source, {
      target: options.target,
      dryRun: options.dryRun,
      json: options.json,
    });
  });

program
  .command("validate")
  .description("Run lint + drift as a CI gate (combines both checks)")
  .argument("[paths...]", "Paths to SKILL.md files or directories containing them")
  .option("--project-root <dir>", "Project root for resolving references")
  .option("--ci", "Minimal output for CI pipelines")
  .option("--json", "Output results as JSON")
  .action(async (paths: string[], options) => {
    await validateCommand(paths, {
      projectRoot: options.projectRoot,
      ci: options.ci,
      json: options.json,
    });
  });

program.parse();
