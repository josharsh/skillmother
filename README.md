# skillmother

The CI/CD pipeline for AI coding skills. Lint, test, and govern SKILL.md files for your team.

```
npm install -g skillmother
```

## Why

AI coding skills (SKILL.md files) rot silently. Engineers write them once, then:

- Descriptions are too vague for Claude to activate reliably
- File references go stale as code gets refactored
- Instructions pile up past the ~150 that LLMs can follow
- No way to verify a skill actually works before deploying it
- Team knowledge stays trapped in one person's `.claude/skills/`

skillmother fixes this with lint rules, behavioral testing, drift detection, and team sync — all in one CLI.

## Quick Start

```bash
# Initialize in your project
skillmother init

# Create a new skill interactively
skillmother create

# Lint your skills
skillmother lint

# Run behavioral tests (requires ANTHROPIC_API_KEY)
skillmother test

# Check for stale references
skillmother drift

# Sync team skills to your local setup
skillmother sync ./team-skills/

# CI gate (lint + drift combined)
skillmother validate --ci
```

## Commands

### `skillmother init`

Bootstrap skillmother in your project. Creates `.skillmother/skills/` with an example skill and a GitHub Actions workflow for CI validation.

```bash
skillmother init
skillmother init --no-ci          # skip GitHub Actions setup
skillmother init --skip-example   # skip example skill
```

### `skillmother create`

Guided 8-step wizard that extracts domain knowledge into a well-formed SKILL.md + tests.json. Asks about: name, description, domain context, key files, instructions, patterns, anti-patterns, and invocation options. Output passes all lint rules by construction.

```bash
skillmother create
skillmother create --output ./custom/path/
```

### `skillmother lint [paths...]`

Static analysis with 12 rules across 4 categories:

| Category | Rules |
|----------|-------|
| **Frontmatter** | `description-required`, `name-format`, `name-length`, `name-consecutive-hyphens`, `name-dir-mismatch`, `description-length`, `description-too-short` |
| **Length** | `too-long` (>500 lines), `word-count` (>5000), `instruction-overload` (>150), `empty-body` |
| **References** | `file-not-found` (checks paths with `/` against disk) |
| **Activation** | `weak-description`, `description-too-brief`, `no-action-verb` |

```bash
skillmother lint                              # auto-discover skills
skillmother lint .claude/skills/              # lint a directory
skillmother lint path/to/SKILL.md             # lint a specific file
skillmother lint --project-root /my/project   # resolve refs against project
skillmother lint --json                       # JSON output
```

### `skillmother test [paths...]`

Behavioral testing — sends prompts to Claude with your skill as system instructions, then asserts on the response. Requires `ANTHROPIC_API_KEY`.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
skillmother test
skillmother test --model claude-sonnet-4-5-20250929  # use a different model
skillmother test --verbose                           # show full responses
skillmother test --json                              # JSON output
```

#### Test Format

Place a `tests.json` alongside your `SKILL.md`:

```json
{
  "skill": "my-skill",
  "model": "claude-haiku-4-5-20250501",
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
| `pattern` | Response matches a regex pattern |
| `mentions-file` | Response mentions a specific file path |
| `uses-pattern` | Response uses a coding pattern (case-insensitive) |

### `skillmother drift [paths...]`

Detects file references in your skills that no longer exist in the codebase. Suggests possible renames when it finds similar files.

```bash
skillmother drift
skillmother drift --project-root /my/project
skillmother drift --json
```

### `skillmother sync [source]`

Distributes skills from a shared source to each engineer's local Claude Code setup.

```bash
skillmother sync                          # auto-discover source
skillmother sync ./team-skills/           # explicit source
skillmother sync --target ~/.claude/skills/  # explicit target
skillmother sync --dry-run                # preview changes
```

### `skillmother validate [paths...]`

Combined lint + drift check designed for CI pipelines. Exits with code 1 on any error.

```bash
skillmother validate --ci                 # minimal output for CI
skillmother validate --json               # JSON output
skillmother validate --project-root .     # resolve refs against project
```

## CI Setup

`skillmother init` generates a GitHub Actions workflow automatically. You can also set it up manually:

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

## Project Structure

```
.skillmother/
  config.json              # project settings
  skills/
    coding-standards/
      SKILL.md             # the skill
      tests.json           # behavioral tests
    error-handling/
      SKILL.md
      tests.json
```

## License

MIT
