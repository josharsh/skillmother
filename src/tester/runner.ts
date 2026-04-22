import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import Anthropic from "@anthropic-ai/sdk";
import matter from "gray-matter";

export interface TestCase {
  name: string;
  prompt: string;
  assert: TestAssertion[];
}

export interface TestAssertion {
  type: "contains" | "not-contains" | "pattern" | "mentions-file" | "uses-pattern";
  value: string;
  description?: string;
}

export interface TestCaseResult {
  name: string;
  passed: boolean;
  reason?: string;
  duration?: number;
  response?: string;
}

export interface TestReport {
  skill: string;
  testCases: number;
  passed: number;
  failed: number;
  results: TestCaseResult[];
  totalDuration: number;
}

export interface TestConfig {
  skill: string;
  model?: string;
  tests: TestCase[];
}

export function loadTestConfig(testPath: string): TestConfig {
  const raw = readFileSync(testPath, "utf-8");

  // Parse YAML-like test config
  // For now, support JSON format. YAML support can be added later.
  if (testPath.endsWith(".json")) {
    return JSON.parse(raw) as TestConfig;
  }

  // Simple YAML-like parsing for .yaml/.yml files
  // We'll use a minimal approach since we don't want a heavy YAML dep
  // Actually, gray-matter can handle this
  const { data } = matter(`---\n${raw}\n---`);
  return data as TestConfig;
}

function evaluateAssertion(
  response: string,
  assertion: TestAssertion
): { passed: boolean; reason?: string } {
  const lower = response.toLowerCase();
  const valueLower = assertion.value.toLowerCase();

  switch (assertion.type) {
    case "contains":
      if (!lower.includes(valueLower)) {
        return {
          passed: false,
          reason: `Expected response to contain '${assertion.value}'`,
        };
      }
      return { passed: true };

    case "not-contains":
      if (lower.includes(valueLower)) {
        return {
          passed: false,
          reason: `Expected response NOT to contain '${assertion.value}'`,
        };
      }
      return { passed: true };

    case "pattern": {
      const regex = new RegExp(assertion.value, "i");
      if (!regex.test(response)) {
        return {
          passed: false,
          reason: `Expected response to match pattern /${assertion.value}/i`,
        };
      }
      return { passed: true };
    }

    case "mentions-file":
      if (!response.includes(assertion.value)) {
        return {
          passed: false,
          reason: `Expected response to mention file '${assertion.value}'`,
        };
      }
      return { passed: true };

    case "uses-pattern":
      if (!lower.includes(valueLower)) {
        return {
          passed: false,
          reason: `Expected response to use pattern '${assertion.value}'`,
        };
      }
      return { passed: true };

    default:
      return { passed: false, reason: `Unknown assertion type: ${assertion.type}` };
  }
}

export async function runTests(
  skillPath: string,
  testConfig: TestConfig,
  options?: { model?: string; verbose?: boolean }
): Promise<TestReport> {
  const model = options?.model ?? testConfig.model ?? "claude-haiku-4-5-20250501";
  const client = new Anthropic();

  // Read the skill content
  const skillRaw = readFileSync(skillPath, "utf-8");
  const { content: skillInstructions } = matter(skillRaw);

  const systemPrompt = `You are an AI coding assistant with the following skill loaded. Follow its instructions precisely when responding.

<skill>
${skillInstructions}
</skill>

Respond to the user's request following the skill instructions above.`;

  const results: TestCaseResult[] = [];
  const startTime = Date.now();

  for (const testCase of testConfig.tests) {
    const caseStart = Date.now();

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: testCase.prompt }],
      });

      const responseText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      // Evaluate all assertions
      let allPassed = true;
      let failReason: string | undefined;

      for (const assertion of testCase.assert) {
        const result = evaluateAssertion(responseText, assertion);
        if (!result.passed) {
          allPassed = false;
          failReason = result.reason;
          break;
        }
      }

      results.push({
        name: testCase.name,
        passed: allPassed,
        reason: failReason,
        duration: Date.now() - caseStart,
        response: options?.verbose ? responseText : undefined,
      });
    } catch (err) {
      results.push({
        name: testCase.name,
        passed: false,
        reason: `API error: ${err instanceof Error ? err.message : String(err)}`,
        duration: Date.now() - caseStart,
      });
    }
  }

  const passed = results.filter((r) => r.passed).length;

  return {
    skill: testConfig.skill,
    testCases: testConfig.tests.length,
    passed,
    failed: testConfig.tests.length - passed,
    results,
    totalDuration: Date.now() - startTime,
  };
}
