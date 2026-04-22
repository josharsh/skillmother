import { resolve, relative } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import chalk from "chalk";

export interface InitOptions {
  ci?: boolean;
  skipExample?: boolean;
}

const EXAMPLE_SKILL = `---
description: Enforce project coding standards and review pull requests for consistency
---

# Coding Standards

Review code changes for adherence to project coding standards.

## Instructions

- Use TypeScript strict mode for all new files
- Prefer const over let; never use var
- Use async/await over .then() chains
- All public functions must have JSDoc comments
- Error messages must be user-friendly, not stack traces

## Patterns

- Use early returns to reduce nesting
- Prefer named exports over default exports
- Group imports: external deps, then internal, then types

## Anti-Patterns

- Never commit console.log statements (use a proper logger)
- Never catch errors silently (always log or rethrow)
- Never use any type without a justifying comment
`;

const EXAMPLE_TESTS = `{
  "skill": "coding-standards",
  "model": "claude-haiku-4-5-20250501",
  "tests": [
    {
      "name": "enforces strict mode",
      "prompt": "Create a new utility file for string helpers",
      "assert": [
        {
          "type": "pattern",
          "value": "(const|let)",
          "description": "Should use const/let, not var"
        }
      ]
    },
    {
      "name": "avoids console.log",
      "prompt": "Add logging to this function to debug an issue",
      "assert": [
        {
          "type": "not-contains",
          "value": "console.log",
          "description": "Should use a proper logger instead of console.log"
        }
      ]
    },
    {
      "name": "uses async/await",
      "prompt": "Write a function that fetches data from an API",
      "assert": [
        {
          "type": "pattern",
          "value": "async.*await",
          "description": "Should use async/await pattern"
        }
      ]
    }
  ]
}
`;

const GITHUB_ACTION = `name: Validate Skills
on:
  pull_request:
    paths:
      - '.claude/skills/**'
      - '.skillmother/skills/**'
      - 'skills/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install skillmother
        run: npm install -g skillmother

      - name: Validate skills
        run: skillmother validate --ci
`;

export async function initCommand(options: InitOptions): Promise<void> {
  const projectRoot = process.cwd();

  console.log(chalk.bold("\n  skillmother init\n"));

  // Check if already initialized
  const skillmotherDir = resolve(projectRoot, ".skillmother");
  const skillsDir = resolve(skillmotherDir, "skills");

  if (existsSync(skillmotherDir)) {
    console.log(chalk.yellow("  Already initialized: .skillmother/ exists"));
    console.log(chalk.dim("  Use 'skillmother create' to add new skills.\n"));
    return;
  }

  // Create directory structure
  mkdirSync(skillsDir, { recursive: true });
  console.log(chalk.green("  ✓ Created .skillmother/skills/"));

  // Create example skill
  if (!options.skipExample) {
    const exampleDir = resolve(skillsDir, "coding-standards");
    mkdirSync(exampleDir, { recursive: true });
    writeFileSync(resolve(exampleDir, "SKILL.md"), EXAMPLE_SKILL, "utf-8");
    writeFileSync(resolve(exampleDir, "tests.json"), EXAMPLE_TESTS, "utf-8");
    console.log(chalk.green("  ✓ Created example skill: coding-standards/"));
  }

  // Create GitHub Action
  if (options.ci !== false) {
    const workflowDir = resolve(projectRoot, ".github", "workflows");
    const workflowPath = resolve(workflowDir, "validate-skills.yml");

    if (!existsSync(workflowPath)) {
      mkdirSync(workflowDir, { recursive: true });
      writeFileSync(workflowPath, GITHUB_ACTION, "utf-8");
      console.log(chalk.green("  ✓ Created .github/workflows/validate-skills.yml"));
    } else {
      console.log(chalk.dim("  = GitHub workflow already exists, skipping"));
    }
  }

  // Create .skillmother config
  const configContent = JSON.stringify(
    {
      version: 1,
      skills: ".skillmother/skills",
      sync: {
        target: ".claude/skills",
      },
    },
    null,
    2
  ) + "\n";

  writeFileSync(resolve(skillmotherDir, "config.json"), configContent, "utf-8");
  console.log(chalk.green("  ✓ Created .skillmother/config.json"));

  // Print getting started guide
  console.log(chalk.bold("\n  Getting started:\n"));
  console.log(chalk.white("  1. Create a skill:"));
  console.log(chalk.cyan("     skillmother create\n"));
  console.log(chalk.white("  2. Lint your skills:"));
  console.log(chalk.cyan("     skillmother lint\n"));
  console.log(chalk.white("  3. Test skill behavior (requires ANTHROPIC_API_KEY):"));
  console.log(chalk.cyan("     skillmother test\n"));
  console.log(chalk.white("  4. Sync to your Claude Code setup:"));
  console.log(chalk.cyan("     skillmother sync\n"));
  console.log(chalk.white("  5. Run in CI:"));
  console.log(chalk.cyan("     skillmother validate --ci\n"));

  console.log(
    chalk.dim(
      "  Skills live in .skillmother/skills/<skill-name>/SKILL.md\n" +
      "  Each skill can have a tests.json alongside it for behavioral testing.\n"
    )
  );
}
