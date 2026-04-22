import { resolve, dirname } from "path";
import { existsSync, readFileSync } from "fs";
import chalk from "chalk";
import { runTests, loadTestConfig } from "../tester/runner.js";
import type { TestConfig, TestCase } from "../tester/runner.js";
import { formatTestReport } from "../utils/format.js";
import { parseSkillFile, findSkillFiles } from "../parser/skill.js";

export interface TestOptions {
  model?: string;
  verbose?: boolean;
  json?: boolean;
}

function findTestFile(skillPath: string): string | null {
  const skillDir = dirname(skillPath);
  const candidates = [
    resolve(skillDir, "tests.json"),
    resolve(skillDir, "tests.yaml"),
    resolve(skillDir, "tests.yml"),
    resolve(skillDir, "test.json"),
    resolve(skillDir, "test.yaml"),
    resolve(skillDir, "test.yml"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function testCommand(
  paths: string[],
  options: TestOptions
): Promise<void> {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      chalk.red(
        "ANTHROPIC_API_KEY not set. Skill testing requires an API key to invoke Claude."
      )
    );
    console.log(
      chalk.dim(
        "Set it with: export ANTHROPIC_API_KEY=sk-ant-..."
      )
    );
    process.exit(1);
  }

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
      } else if (resolved.endsWith(".json") || resolved.endsWith(".yaml") || resolved.endsWith(".yml")) {
        // Direct test file provided
        const config = loadTestConfig(resolved);
        // Find the skill file relative to the test file
        const skillDir = dirname(resolved);
        const skillFile = resolve(skillDir, "SKILL.md");
        if (!existsSync(skillFile)) {
          console.log(chalk.red(`SKILL.md not found in ${skillDir}`));
          process.exit(1);
        }
        const report = await runTests(skillFile, config, options);
        console.log(formatTestReport(report));
        process.exit(report.failed > 0 ? 1 : 0);
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

  let totalPassed = 0;
  let totalFailed = 0;
  let hasFailures = false;

  for (const skillPath of uniquePaths) {
    const testFile = findTestFile(skillPath);
    if (!testFile) {
      const skill = parseSkillFile(skillPath);
      const name = skill.frontmatter.name ?? skill.dirName;
      console.log(chalk.dim(`  Skipping ${name}: no test file found`));
      continue;
    }

    try {
      const config = loadTestConfig(testFile);
      console.log(chalk.dim(`  Running tests for ${config.skill}...`));

      const report = await runTests(skillPath, config, options);

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatTestReport(report));
      }

      totalPassed += report.passed;
      totalFailed += report.failed;
      if (report.failed > 0) hasFailures = true;
    } catch (err) {
      console.log(
        chalk.red(
          `  ✗ Test error for ${skillPath}: ${err instanceof Error ? err.message : String(err)}`
        )
      );
      hasFailures = true;
    }
  }

  if (totalPassed + totalFailed > 0) {
    console.log(
      chalk.bold(
        `\n${totalPassed}/${totalPassed + totalFailed} total test cases passed`
      )
    );
  }

  if (hasFailures) {
    process.exit(1);
  }
}
