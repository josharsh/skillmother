import { resolve } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { createInterface } from "readline";
import chalk from "chalk";

export interface SkillAnswers {
  name: string;
  description: string;
  domain: string;
  keyFiles: string[];
  patterns: string[];
  antiPatterns: string[];
  instructions: string[];
  outputFormat: string;
  userInvocable: boolean;
  allowedTools: string;
  argumentHint: string;
}

export interface CreateOptions {
  output?: string;
}

function createReadline() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl: ReturnType<typeof createReadline>, question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
    rl.once("close", () => reject(new Error("cancelled")));
  });
}

function askYesNo(rl: ReturnType<typeof createReadline>, question: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    rl.question(`${question} (y/n): `, (answer) => {
      resolve(answer.trim().toLowerCase().startsWith("y"));
    });
    rl.once("close", () => reject(new Error("cancelled")));
  });
}

function askMultiLine(
  rl: ReturnType<typeof createReadline>,
  prompt: string,
  hint: string
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    console.log(chalk.cyan(prompt));
    console.log(chalk.dim(hint));

    const lines: string[] = [];
    const lineHandler = (line: string) => {
      const trimmed = line.trim();
      if (trimmed === "") {
        rl.removeListener("line", lineHandler);
        resolve(lines);
      } else {
        lines.push(trimmed);
      }
    };
    rl.on("line", lineHandler);
    rl.once("close", () => {
      rl.removeListener("line", lineHandler);
      if (lines.length > 0) {
        resolve(lines);
      } else {
        reject(new Error("cancelled"));
      }
    });
  });
}

// Normalize name to spec format: lowercase alphanumeric + hyphens
export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

// Ensure description has an action verb and is well-formed
export function validateDescription(desc: string): string[] {
  const issues: string[] = [];
  const words = desc.split(/\s+/);
  if (words.length < 5) {
    issues.push("Description is too short (minimum 5 words for good activation)");
  }

  const actionVerbs = [
    "create", "build", "generate", "review", "test", "deploy",
    "analyze", "lint", "format", "validate", "check", "scan",
    "implement", "design", "optimize", "refactor", "debug",
    "document", "configure", "setup", "manage", "monitor",
    "write", "enforce", "ensure", "guide", "help", "assist",
  ];
  const hasVerb = actionVerbs.some((v) => desc.toLowerCase().includes(v));
  if (!hasVerb) {
    issues.push("Description should include an action verb (e.g., 'create', 'review', 'enforce')");
  }

  const weakStarts = ["a skill", "this skill", "skill that", "helper", "utility"];
  if (weakStarts.some((s) => desc.toLowerCase().startsWith(s))) {
    issues.push("Avoid starting with generic phrases like 'A skill that...' — be specific about what it does");
  }

  return issues;
}

export function generateSkillMd(answers: SkillAnswers): string {
  const lines: string[] = [];

  // Frontmatter
  lines.push("---");
  lines.push(`description: ${answers.description}`);
  if (answers.userInvocable) {
    lines.push("user-invocable: true");
  }
  if (answers.allowedTools) {
    lines.push(`allowed-tools: ${answers.allowedTools}`);
  }
  if (answers.argumentHint) {
    lines.push(`argument-hint: ${answers.argumentHint}`);
  }
  lines.push("---");
  lines.push("");

  // Title
  const title = answers.name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  lines.push(`# ${title}`);
  lines.push("");

  // Domain context
  if (answers.domain) {
    lines.push(answers.domain);
    lines.push("");
  }

  // Key files
  if (answers.keyFiles.length > 0) {
    lines.push("## Key Files");
    lines.push("");
    for (const file of answers.keyFiles) {
      lines.push(`- \`${file}\``);
    }
    lines.push("");
  }

  // Instructions
  if (answers.instructions.length > 0) {
    lines.push("## Instructions");
    lines.push("");
    for (const instruction of answers.instructions) {
      lines.push(`- ${instruction}`);
    }
    lines.push("");
  }

  // Patterns to follow
  if (answers.patterns.length > 0) {
    lines.push("## Patterns");
    lines.push("");
    for (const pattern of answers.patterns) {
      lines.push(`- ${pattern}`);
    }
    lines.push("");
  }

  // Anti-patterns
  if (answers.antiPatterns.length > 0) {
    lines.push("## Anti-Patterns");
    lines.push("");
    for (const antiPattern of answers.antiPatterns) {
      lines.push(`- ${antiPattern}`);
    }
    lines.push("");
  }

  // Output format
  if (answers.outputFormat) {
    lines.push("## Output Format");
    lines.push("");
    lines.push(answers.outputFormat);
    lines.push("");
  }

  // Arguments placeholder for user-invocable skills
  if (answers.userInvocable) {
    lines.push("$ARGUMENTS");
    lines.push("");
  }

  return lines.join("\n");
}

export function generateTestsJson(answers: SkillAnswers): string {
  const tests: Array<{
    name: string;
    prompt: string;
    assert: Array<{ type: string; value: string; description: string }>;
  }> = [];

  // Always add a basic instruction-following test
  tests.push({
    name: "follows primary instruction",
    prompt: `Help me with a task related to: ${answers.domain || answers.description}`,
    assert: [
      {
        type: "pattern",
        value: ".",
        description: "Should produce a non-empty response",
      },
    ],
  });

  // Add anti-pattern tests
  for (const antiPattern of answers.antiPatterns.slice(0, 3)) {
    const keyword = antiPattern
      .replace(/^(don't|never|avoid|do not)\s+/i, "")
      .split(/\s+/)
      .slice(0, 3)
      .join(" ");
    tests.push({
      name: `avoids: ${antiPattern.slice(0, 50)}`,
      prompt: `Help me with ${answers.domain || "this task"}`,
      assert: [
        {
          type: "not-contains",
          value: keyword,
          description: `Should not ${antiPattern.slice(0, 80)}`,
        },
      ],
    });
  }

  // Add file reference tests
  if (answers.keyFiles.length > 0) {
    const fileToTest = answers.keyFiles[0];
    tests.push({
      name: "references key files when relevant",
      prompt: `Where should I make changes for ${answers.domain || "this feature"}?`,
      assert: [
        {
          type: "mentions-file",
          value: fileToTest,
          description: `Should reference ${fileToTest}`,
        },
      ],
    });
  }

  // Add pattern usage test
  if (answers.patterns.length > 0) {
    const patternKeyword = answers.patterns[0]
      .split(/\s+/)
      .slice(0, 3)
      .join(" ")
      .toLowerCase();
    tests.push({
      name: "uses expected patterns",
      prompt: `Show me an example of how to implement something for ${answers.domain || "this project"}`,
      assert: [
        {
          type: "contains",
          value: patternKeyword,
          description: `Should follow the pattern: ${answers.patterns[0].slice(0, 60)}`,
        },
      ],
    });
  }

  const config = {
    skill: answers.name,
    model: "claude-haiku-4-5-20250501",
    tests,
  };

  return JSON.stringify(config, null, 2) + "\n";
}

export async function createCommand(options: CreateOptions): Promise<void> {
  // Check for TTY — create requires interactive input
  if (!process.stdin.isTTY) {
    console.error(
      chalk.red("Error: 'skillmother create' requires an interactive terminal.")
    );
    console.error(chalk.dim("It cannot be run in a pipe or CI environment."));
    process.exit(1);
  }

  const rl = createReadline();

  // Handle Ctrl+C gracefully
  rl.on("SIGINT", () => {
    console.log(chalk.dim("\n\n  Cancelled."));
    rl.close();
    process.exit(0);
  });

  console.log(chalk.bold("\n  skillmother create"));
  console.log(chalk.dim("  Guided skill creation — we'll ask questions, you share knowledge.\n"));

  try {
    // Step 1: Name
    console.log(chalk.bold.cyan("  1/8 — Skill Name"));
    console.log(chalk.dim("  Lowercase, hyphens ok. This becomes the directory name."));
    const rawName = await ask(rl, chalk.white("  Name: "));
    if (!rawName) {
      console.log(chalk.red("  Name is required."));
      rl.close();
      return;
    }
    const name = normalizeName(rawName);
    if (name !== rawName) {
      console.log(chalk.dim(`  Normalized to: ${name}`));
    }

    // Step 2: Description
    console.log(chalk.bold.cyan("\n  2/8 — Description"));
    console.log(chalk.dim("  A clear, specific description of what this skill does."));
    console.log(chalk.dim("  Good: \"Enforce error handling patterns and retry logic for API calls\""));
    console.log(chalk.dim("  Bad:  \"A skill that helps with errors\""));
    let description = await ask(rl, chalk.white("  Description: "));
    if (!description) {
      console.log(chalk.red("  Description is required."));
      rl.close();
      return;
    }

    // Validate and offer feedback
    const descIssues = validateDescription(description);
    if (descIssues.length > 0) {
      console.log(chalk.yellow("\n  Description feedback:"));
      for (const issue of descIssues) {
        console.log(chalk.yellow(`    ⚠ ${issue}`));
      }
      const revise = await askYesNo(rl, chalk.white("  Would you like to revise?"));
      if (revise) {
        description = await ask(rl, chalk.white("  Revised description: "));
      }
    }

    // Step 3: Domain context
    console.log(chalk.bold.cyan("\n  3/8 — Domain Context"));
    console.log(chalk.dim("  Describe the domain this skill operates in. 1-3 sentences."));
    console.log(chalk.dim("  Example: \"This project uses Express.js with PostgreSQL. All API"));
    console.log(chalk.dim("  endpoints follow REST conventions and use Zod for validation.\""));
    const domain = await ask(rl, chalk.white("  Context: "));

    // Step 4: Key files
    console.log(chalk.bold.cyan("\n  4/8 — Key Files"));
    const keyFiles = await askMultiLine(
      rl,
      "  List the important files Claude should know about.",
      "  One per line (e.g., src/routes/index.ts). Empty line when done."
    );

    // Step 5: Instructions
    console.log(chalk.bold.cyan("\n  5/8 — Instructions"));
    const instructions = await askMultiLine(
      rl,
      "  What should Claude always do when this skill is active?",
      "  One instruction per line. Empty line when done."
    );

    // Warn if too many instructions
    if (instructions.length > 30) {
      console.log(
        chalk.yellow(
          `\n  ⚠ ${instructions.length} instructions is a lot. LLMs reliably follow ~20-30 max.`
        )
      );
      console.log(chalk.yellow("  Consider keeping only the most critical ones."));
    }

    // Step 6: Patterns
    console.log(chalk.bold.cyan("\n  6/8 — Patterns to Follow"));
    const patterns = await askMultiLine(
      rl,
      "  What coding patterns should Claude use?",
      "  One per line (e.g., \"Use async/await over .then() chains\"). Empty line when done."
    );

    // Step 7: Anti-patterns
    console.log(chalk.bold.cyan("\n  7/8 — Anti-Patterns to Avoid"));
    const antiPatterns = await askMultiLine(
      rl,
      "  What should Claude never do?",
      "  One per line (e.g., \"Never use var, always use const/let\"). Empty line when done."
    );

    // Step 8: Output format & options
    console.log(chalk.bold.cyan("\n  8/8 — Options"));
    const outputFormat = await ask(
      rl,
      chalk.white("  Output format (how should Claude structure its response, or skip): ")
    );
    const userInvocable = await askYesNo(
      rl,
      chalk.white("  User-invocable (triggered with /command)?")
    );

    let allowedTools = "";
    let argumentHint = "";
    if (userInvocable) {
      allowedTools = await ask(
        rl,
        chalk.white("  Allowed tools (e.g., Bash, Read, Edit — or skip): ")
      );
      argumentHint = await ask(
        rl,
        chalk.white("  Argument hint (shown to user, e.g., \"<file-path>\" — or skip): ")
      );
    }

    rl.close();

    const answers: SkillAnswers = {
      name,
      description,
      domain,
      keyFiles,
      patterns,
      antiPatterns,
      instructions,
      outputFormat: outputFormat === "skip" ? "" : outputFormat,
      userInvocable,
      allowedTools: allowedTools === "skip" ? "" : allowedTools,
      argumentHint: argumentHint === "skip" ? "" : argumentHint,
    };

    // Determine output directory
    const outputBase = options.output
      ? resolve(process.cwd(), options.output)
      : resolve(process.cwd(), ".claude", "skills");

    const skillDir = resolve(outputBase, name);

    // Check if directory already exists
    if (existsSync(skillDir)) {
      console.log(chalk.red(`\n  Directory already exists: ${skillDir}`));
      console.log(chalk.dim("  Remove it first or choose a different name."));
      process.exit(1);
    }

    // Generate files
    const skillContent = generateSkillMd(answers);
    const testsContent = generateTestsJson(answers);

    // Write files
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(resolve(skillDir, "SKILL.md"), skillContent, "utf-8");
    writeFileSync(resolve(skillDir, "tests.json"), testsContent, "utf-8");

    // Summary
    const lineCount = skillContent.split("\n").length;
    const wordCount = skillContent.split(/\s+/).filter(Boolean).length;
    const testCount = JSON.parse(testsContent).tests.length;

    console.log(chalk.bold.green("\n  Skill created successfully!\n"));
    console.log(chalk.white(`  ${skillDir}/`));
    console.log(chalk.dim(`    SKILL.md    ${lineCount} lines, ${wordCount} words`));
    console.log(chalk.dim(`    tests.json  ${testCount} test cases`));

    console.log(chalk.dim("\n  Next steps:"));
    console.log(chalk.dim(`    skillmother lint ${skillDir}/SKILL.md`));
    console.log(chalk.dim(`    skillmother test ${skillDir}/`));
    console.log(chalk.dim(`    Edit SKILL.md to refine instructions`));
  } catch (err) {
    rl.close();
    if (err instanceof Error && err.message === "cancelled") {
      console.log(chalk.dim("\n  Cancelled."));
      return;
    }
    throw err;
  }
}
