import { existsSync } from "fs";
import { resolve, dirname } from "path";
import type { ParsedSkill } from "../../parser/skill.js";
import type { LintResult } from "../index.js";

const FILE_PATH_REGEX =
  /(?:^|\s|`)((?:\.\/|\.\.\/|src\/|lib\/|app\/|packages\/|tests?\/|docs?\/|config\/)?[\w\-./]+\.\w{1,10})(?:\s|`|$|,|;|\))/gm;

const IGNORED_EXTENSIONS = new Set([
  "com", "org", "io", "dev", "net", "ai", "md", // could be URLs
]);

const KNOWN_FILE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "py", "go", "rs", "java", "kt", "swift",
  "rb", "php", "c", "cpp", "h", "hpp", "cs", "vue", "svelte",
  "json", "yaml", "yml", "toml", "xml", "html", "css", "scss",
  "sql", "sh", "bash", "zsh", "dockerfile",
]);

export function extractFileReferences(body: string): string[] {
  const refs: string[] = [];
  let match;

  while ((match = FILE_PATH_REGEX.exec(body)) !== null) {
    const ref = match[1].trim();
    // Filter out things that look like URLs or domains
    if (ref.includes("://") || ref.startsWith("http")) continue;
    // Check the extension is a known file type
    const ext = ref.split(".").pop()?.toLowerCase() ?? "";
    if (IGNORED_EXTENSIONS.has(ext)) continue;
    if (!KNOWN_FILE_EXTENSIONS.has(ext) && !ref.includes("/")) continue;
    refs.push(ref);
  }

  return [...new Set(refs)];
}

export function validateReferences(
  skill: ParsedSkill,
  projectRoot?: string
): LintResult[] {
  const results: LintResult[] = [];
  const root = projectRoot ?? dirname(dirname(skill.path));
  const skillDir = dirname(skill.path);
  const refs = extractFileReferences(skill.body);

  for (const ref of refs) {
    // Only check references that look like real project paths (contain a directory separator)
    // Standalone filenames like "example.tsx" are likely examples in code blocks
    if (!ref.includes("/") && !ref.startsWith("./") && !ref.startsWith("../")) {
      continue;
    }

    // Try resolving from project root first, then from skill directory
    const fromRoot = resolve(root, ref);
    const fromSkill = resolve(skillDir, ref);
    if (!existsSync(fromRoot) && !existsSync(fromSkill)) {
      results.push({
        rule: "references/file-not-found",
        severity: "warning",
        message: `Referenced path not found: '${ref}'`,
        file: skill.path,
      });
    }
  }

  return results;
}
