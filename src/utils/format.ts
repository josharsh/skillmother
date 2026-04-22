import chalk from "chalk";
import type { LintReport } from "../linter/index.js";
import type { TestReport } from "../tester/runner.js";

export function formatLintReport(report: LintReport): string {
  const lines: string[] = [];
  const name = report.skill;

  if (report.results.length === 0) {
    lines.push(chalk.green(`  ${name}: All checks passed`));
    return lines.join("\n");
  }

  lines.push(chalk.bold(`  ${name} (${report.path})`));

  for (const result of report.results) {
    const icon =
      result.severity === "error"
        ? chalk.red("  ✗")
        : result.severity === "warning"
          ? chalk.yellow("  ⚠")
          : chalk.blue("  ℹ");

    const rule = chalk.dim(`[${result.rule}]`);
    lines.push(`${icon} ${result.message} ${rule}`);
  }

  return lines.join("\n");
}

export function formatLintSummary(reports: LintReport[]): string {
  const totalErrors = reports.reduce((s, r) => s + r.errors, 0);
  const totalWarnings = reports.reduce((s, r) => s + r.warnings, 0);
  const totalInfos = reports.reduce((s, r) => s + r.infos, 0);
  const totalSkills = reports.length;
  const passed = reports.filter((r) => r.errors === 0).length;

  const parts: string[] = [];
  if (totalErrors > 0) parts.push(chalk.red(`${totalErrors} errors`));
  if (totalWarnings > 0) parts.push(chalk.yellow(`${totalWarnings} warnings`));
  if (totalInfos > 0) parts.push(chalk.blue(`${totalInfos} infos`));

  const status =
    totalErrors > 0
      ? chalk.red.bold("FAIL")
      : totalWarnings > 0
        ? chalk.yellow.bold("WARN")
        : chalk.green.bold("PASS");

  return `\n${status} ${passed}/${totalSkills} skills passed | ${parts.join(", ") || "no issues"}`;
}

export function formatTestReport(report: TestReport): string {
  const lines: string[] = [];

  lines.push(chalk.bold(`\n  Testing: ${report.skill}`));
  lines.push(chalk.dim(`  ${report.testCases} test cases\n`));

  for (const result of report.results) {
    const icon = result.passed
      ? chalk.green("  ✓")
      : chalk.red("  ✗");

    lines.push(`${icon} ${result.name}`);
    if (!result.passed && result.reason) {
      lines.push(chalk.dim(`    → ${result.reason}`));
    }
    if (result.duration) {
      lines.push(chalk.dim(`    (${result.duration}ms)`));
    }
  }

  const passRate = report.passed / report.testCases;
  const color = passRate === 1 ? chalk.green : passRate >= 0.5 ? chalk.yellow : chalk.red;
  lines.push(
    `\n  ${color(`${report.passed}/${report.testCases} passed`)} | ${report.totalDuration}ms total`
  );

  return lines.join("\n");
}
