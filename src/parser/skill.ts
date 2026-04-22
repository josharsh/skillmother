import { readFileSync, existsSync, statSync, readdirSync } from "fs";
import { resolve, basename, dirname } from "path";
import matter from "gray-matter";

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  "allowed-tools"?: string;
  "argument-hint"?: string;
  "disable-model-invocation"?: boolean;
  "user-invocable"?: boolean;
  [key: string]: unknown;
}

export interface ParsedSkill {
  path: string;
  dirName: string;
  frontmatter: SkillFrontmatter;
  body: string;
  raw: string;
  lineCount: number;
  wordCount: number;
}

export function parseSkillFile(skillPath: string): ParsedSkill {
  const resolvedPath = resolve(skillPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`SKILL.md not found: ${resolvedPath}`);
  }

  const raw = readFileSync(resolvedPath, "utf-8");
  const { data, content } = matter(raw);

  const dirName = basename(dirname(resolvedPath));
  const lines = content.trim().split("\n");

  return {
    path: resolvedPath,
    dirName,
    frontmatter: data as SkillFrontmatter,
    body: content,
    raw,
    lineCount: lines.length,
    wordCount: content.split(/\s+/).filter(Boolean).length,
  };
}

export function findSkillFiles(dir: string): string[] {
  const skillPaths: string[] = [];
  const resolvedDir = resolve(dir);

  // Check if dir itself contains SKILL.md
  const directSkill = resolve(resolvedDir, "SKILL.md");
  if (existsSync(directSkill) && statSync(directSkill).isFile()) {
    skillPaths.push(directSkill);
    return skillPaths;
  }

  // Check subdirectories for SKILL.md files
  try {
    const entries = readdirSync(resolvedDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFile = resolve(resolvedDir, entry.name, "SKILL.md");
        if (existsSync(skillFile)) {
          skillPaths.push(skillFile);
        }
      }
    }
  } catch {
    // Directory doesn't exist or isn't readable
  }

  return skillPaths;
}
