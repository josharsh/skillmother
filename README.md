# skillmother

The CI/CD pipeline for AI coding skills.

```
npm install -g skillmother
```

## Why I Built This

I write a lot of SKILL.md files. At some point I had a dozen of them across projects and they were all quietly rotting.

Descriptions were too vague for Claude to even activate. File references pointed to code that got renamed three sprints ago. One skill had 200+ instructions -- way past what any LLM can actually follow. And I had no way to know if a skill worked until I ran it and watched it do something dumb.

The final straw was trying to share skills with my team. Everyone had their own `.claude/skills/` with different versions of the same skill. No quality checks. No sync. No tests.

So I built skillmother. One CLI that lints, tests, detects drift, and syncs skills -- the same way you'd lint and test your actual code.

## Quick Start

```bash
skillmother init                    # set up in your project
skillmother create                  # guided skill creation wizard
skillmother lint                    # check for issues
skillmother test                    # behavioral tests via Claude API
skillmother drift                   # find stale file references
skillmother sync ./team-skills/     # distribute skills to your team
skillmother validate --ci           # CI gate (lint + drift)
```

## Commands

### `skillmother init`

Sets up `.skillmother/skills/` with an example skill and a GitHub Actions workflow.

```bash
skillmother init
skillmother init --no-ci          # skip GitHub Actions
skillmother init --skip-example   # skip example skill
```

### `skillmother create`

8-step wizard that walks you through writing a skill. Asks about name, description, domain context, key files, instructions, patterns, anti-patterns, and invocation. The output passes all lint rules by construction.

```bash
skillmother create
skillmother create --output ./custom/path/
```

### `skillmother lint [paths...]`

12 rules across 4 categories:

| Category | Rules |
|----------|-------|
| **Frontmatter** | `description-required`, `name-format`, `name-length`, `name-consecutive-hyphens`, `name-dir-mismatch`, `description-length`, `description-too-short` |
| **Length** | `too-long` (>500 lines), `word-count` (>5000), `instruction-overload` (>150), `empty-body` |
| **References** | `file-not-found` (checks paths with `/` against disk) |
| **Activation** | `weak-description`, `description-too-brief`, `no-action-verb` |

```bash
skillmother lint                              # auto-discover skills
skillmother lint .claude/skills/              # lint a directory
skillmother lint path/to/SKILL.md             # lint one file
skillmother lint --project-root /my/project   # resolve refs against project root
skillmother lint --json                       # JSON output for CI
```

### `skillmother test [paths...]`

This is the one nobody else has. Sends prompts to Claude with your skill loaded as system instructions, then asserts on the response. You're testing whether the skill actually makes Claude do the right thing.

Requires `ANTHROPIC_API_KEY`. Costs about $0.01 per test case with Haiku.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
skillmother test
skillmother test --model claude-sonnet-4-5-20250929  # different model
skillmother test --verbose                           # show full responses
skillmother test --json
```

#### Test Format

Place a `tests.json` alongside your `SKILL.md`:

```json
{
  "skill": "my-skill",
  "model": "claude-haiku-4-5-20251001",
  "tests": [
    {
      "name": "uses async patterns",
      "prompt": "Write a function that fetches data from an API",
      "assert": [
        {
          "type": "pattern",
          "value": "(async|await)",
          "description": "Should use async/await"
        }
      ]
    }
  ]
}
```

**Assertion types:**

| Type | Description |
|------|-------------|
| `contains` | Response includes the value (case-insensitive) |
| `not-contains` | Response does NOT include the value |
| `pattern` | Response matches a regex (case-insensitive) |
| `mentions-file` | Response mentions a file path or filename |
| `uses-pattern` | Response matches a coding pattern regex (falls back to substring) |

### `skillmother drift [paths...]`

Finds file references in your skills that no longer exist in the codebase. Suggests renames when it finds similar files.

```bash
skillmother drift
skillmother drift --project-root /my/project
skillmother drift --json
```

### `skillmother sync [source]`

Copies skills from a shared source to each dev's local Claude Code setup.

```bash
skillmother sync                             # auto-discover source
skillmother sync ./team-skills/              # explicit source
skillmother sync --target ~/.claude/skills/  # explicit target
skillmother sync --dry-run                   # preview changes
```

### `skillmother validate [paths...]`

Lint + drift combined. Designed for CI. Exits with code 1 on any error.

```bash
skillmother validate --ci             # minimal output
skillmother validate --json
skillmother validate --project-root .
```

## CI Setup

`skillmother init` generates this automatically, or set it up yourself:

```yaml
# .github/workflows/validate-skills.yml
name: Validate Skills
on:
  pull_request:
    paths:
      - '.claude/skills/**'
      - '.skillmother/skills/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g skillmother
      - run: skillmother validate --ci
```

## Skills Built with Skillmother

I use skillmother to lint and test all of my own skills:

- [active-listening](https://github.com/josharsh/active-listening) -- detects preference statements and persists them across sessions
- [stay-focused](https://github.com/josharsh/stay-focused) -- flags out-of-scope edits before they happen
- [unstuck](https://github.com/josharsh/unstuck) -- catches fix-break loops and forces structured diagnosis
- [prove-it](https://github.com/josharsh/prove-it) -- challenges tests to make sure they actually catch bugs
- [talk-slow](https://github.com/josharsh/talk-slow) -- progressive disclosure to save tokens and reduce cognitive overload
- [setup-my-claude-code](https://github.com/josharsh/setup-my-claude-code) -- interactive setup wizard that configures your Claude Code environment

## Project Structure

```
.skillmother/
  config.json
  skills/
    coding-standards/
      SKILL.md
      tests.json
    error-handling/
      SKILL.md
      tests.json
```

## License

MIT
