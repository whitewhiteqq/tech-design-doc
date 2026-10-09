# Contributing to tech-design-doc

## Development Setup

```bash
# Clone
git clone https://github.com/whitewhiteqq/tech-design-doc.git
cd tech-design-doc

# Load the plugin from this checkout for one Claude Code session
claude --plugin-dir .

# Validate the plugin manifests
claude plugin validate .

# Validate for Tencent CodeBuddy (no login needed)
npx -y @tencent-ai/codebuddy-code plugin validate .
npx -y @tencent-ai/codebuddy-code plugin validate .claude-plugin/plugin.json
```

The two `marketplace.json` files must stay identical: `.claude-plugin/` is
read by Claude Code, `.codebuddy-plugin/` by CodeBuddy. CodeBuddy reads
`plugin.json` from `.claude-plugin/`, so there is only one `plugin.json`.

The scripts use the Python standard library only. The diagram check needs
Chrome, Chromium or Edge (set `CHROME=<path>` if the scripts cannot find it).
The HTML kit needs Node.js.

To work on cloud diagrams, download the icon packs into
`skills/tech-design-doc/vendor-icons/` as its `README.md` says. Git ignores
them. **Never commit an icon zip, `.index.json` or `kit/icons.js`**: the vendor
terms do not permit redistribution of the icon files.

## Local Checks

Run these from the repository root before every commit:

```bash
# Syntax: every Python and JavaScript file
for f in $(git ls-files '*.py'); do python -m py_compile "$f" || echo "FAIL $f"; done
for f in $(git ls-files '*.js' '*.mjs' | grep -v mermaid.min.js); do node --check "$f"; done

# Diagram check on the shipped examples (needs Chrome); must print 0 FAIL
python skills/tech-design-doc/scripts/check_diagrams.py skills/tech-design-doc/examples/deployment/*.md

# Page check on the shipped HTML example; must print 0 failures
python skills/tech-design-doc/kit/tools/check_pages.py skills/tech-design-doc/examples/relay-design.html

# The two marketplace.json files are identical
cmp .claude-plugin/marketplace.json .codebuddy-plugin/marketplace.json && echo ok

# No vendor pack and no generated icon file in the index
git ls-files | grep -E '\.zip$|\.index\.json$|kit/icons\.js$' && echo "REMOVE THESE" || echo "ok"
```

When you change a figure template, the kit or the shell, rebuild the example
page (needs `aws-icons.zip`) and commit the result:

```bash
cd skills/tech-design-doc/kit
python tools/make_icons.py --packs ../vendor-icons --map icons.relay.json --out icons.js
python build.py doc.json
```

When you change `cloud_diagram.py`, regenerate each example in
`examples/deployment/` from its `.spec.json` and commit the outputs.

## Project Structure

```
tech-design-doc/
├── CLAUDE.md                        # Agent instructions (Claude Code / Copilot)
├── .claude-plugin/                  # plugin.json and marketplace.json
├── .codebuddy-plugin/               # marketplace.json for CodeBuddy (identical copy)
└── skills/tech-design-doc/
    ├── SKILL.md                     # The skill entry point
    ├── reference/                   # Loaded on demand by the agent
    ├── scripts/                     # icons.py, cloud_diagram.py, check_diagrams.py
    ├── kit/                         # HTML kit: shells, figures, build.py, tools/
    ├── examples/                    # Finished outputs, checked
    ├── vendor-icons/                # README.md only in git; zips stay local
    └── vendor-js/                   # Mermaid bundle (MIT) and its licence
```

## Changing the Guide (GitHub Pages)

`docs/` is the public guide, served from `main` at
<https://whitewhiteqq.github.io/tech-design-doc/>.

- `docs/index.html`: doc skeletons. Each diagram badge is a link
  `diagram-types.html#<id>` with `data-card="<id>"`; a small inline script opens
  that card in a preview dialog.
- `docs/diagram-types.html`: one card per diagram type. Each card has an `id`
  (`a1` … `f5`, `matrix`). A new badge needs a card with that id.
- `docs/diagram-types.md`: the short Markdown version. Keep its counts and
  names in step with the HTML.
- `docs/.nojekyll`: keeps GitHub Pages from turning the `.md` into a second
  `diagram-types.html`.

Keep both pages self-contained: no web font, no CDN, no external request.
Use invented, generic examples only; never a real project, client or employer.
Check a change by opening `docs/index.html` over HTTP
(`python -m http.server -d docs`) and clicking a badge.

## Changing the Skill

- `SKILL.md` stays short. Put detail in `reference/` and point to it.
- Keep the frontmatter fields: `name` (must match the directory name),
  `license`, `metadata.author`, `metadata.version`, and `description`
  (max 1024 characters; it decides when the skill triggers).
- A new rule for diagrams goes into `reference/fixing-diagrams.md` with the
  check that finds the problem.
- A new vendor icon pack goes into `vendor-icons/README.md` (download URL,
  release, SHA-256, exact usage terms) and into `PARSERS` in `scripts/icons.py`.

## Skill YAML Frontmatter

```yaml
---
name: tech-design-doc
license: Apache-2.0
metadata:
  author: whitewhiteqq
  version: "0.1.0"
description: This skill should be used when ...
---
```

## Git as Engineering Memory

This project treats git history as a **persistent knowledge base** for both
human contributors and AI agents, not just a code transport mechanism.
Every commit message, PR description, and release tag is a record that
future readers will use to reconstruct *why* the skill looks the way it
does, without opening a browser.

Design every commit message as if it will be read with zero prior context.
The goal: anyone should be able to run `git log --oneline`, pick a commit,
read its body, and fully understand the decision.

Principles:

- **Preserve the reasoning chain.** Record what changed, why, what
  alternatives were considered, and what evidence supported the choice.
- **Prefer granular commits over squashed blobs.** Default to `Rebase and
  merge`; reserve `Squash and merge` for branches whose intermediate commits
  are unsalvageable noise.
- **Keep context in git, not only on GitHub.** PR discussions and review
  feedback must be distilled into commit bodies, because `git log` works
  offline and survives forks.
- **Make history searchable.** Use consistent Conventional Commit types,
  scopes, and keywords so `git log --grep` returns focused results.
- **Tag decision boundaries.** Annotated release tags summarize what shipped
  and why.

## Branch Strategy

- `main` is the release branch and should always be releasable.
- `develop` is the integration branch for reviewed work that is not yet released.
- Contributors open short-lived feature or fix branches from `develop`.
- Do not push directly to `main` or `develop` except for urgent maintainer-only repository administration.
- Default to `Rebase and merge` for pull requests into `develop`. Use `Squash and merge` only when the branch contains exploratory or fixup commits; the single commit must then capture all essential context.
- Avoid GitHub merge commits for routine pull requests.
- Promote releases from `develop` to `main` with a maintainer-run fast-forward: `git push origin develop:main`. Never squash or rebase `develop` into `main` with a GitHub button: both create commits that `develop` lacks, and the next release PR then conflicts.
- Tag every release on `main` with an annotated tag (`git tag -a v0.1.0 -m "..."`), then create a GitHub Release targeting that tag. Releases follow one path only: feature branch -> `develop` -> `main` -> version tag -> GitHub Release -> skill zip. Publishing the Release starts `.github/workflows/release.yml`: it checks that the tag is on `main` and matches every version field, builds `tech-design-doc-<tag>.zip` from `skills/tech-design-doc/`, smoke-tests it, attests its provenance and attaches it to the Release.

## Commit Message Style

Use Conventional Commits for public history. The preferred format is:

```text
type(scope): short imperative summary
```

For non-trivial changes, include the full body template:

```text
type(scope): short imperative summary

INTENTION:
Why this change exists and what engineering principle it serves.

WHAT CHANGED:
- Concise bullet list of specific changes
- Group by file or area when helpful

WHY:
What was wrong or missing before, and how this moves the project forward.

ALTERNATIVES CONSIDERED:
- Option A: description — rejected because <reason>
(Omit when no meaningful alternatives exist.)

REFS:
- Closes #<issue>
- Related: <short-sha> (<one-line summary>)
(Omit when no related items apply.)

VERIFIED:
- What was tested or checked before committing
- Which checks were intentionally skipped and why
```

Examples:

```text
feat(skills): add state diagram skeleton
fix(cloud-diagram): keep group labels inside the VPC box
docs(readme): add icon pack setup steps
ci: add diagram check job
refactor(kit): share arrow routing between figures
chore: bump version to 0.1.1
```

Guidelines:

- Use one of: `feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `chore`, `build`, `perf`.
- Use a scope when it helps reviewers, for example `skills`, `kit`, `cloud-diagram`, `icons`, `examples`, `plugin`, `readme`, or `ci`.
- Write the summary in imperative mood: `add`, `fix`, `update`, not `added` or `fixed`.
- Keep the subject line under 72 characters. Do not end it with a period.
- If the change is breaking, use `!` after the type or scope and explain it in the body.
- For trivial changes (typo fixes, formatting), the subject line alone is sufficient.
- For anything that changes behaviour, adds a feature, or fixes a bug, include at least INTENTION and WHAT CHANGED.
- Include ALTERNATIVES CONSIDERED whenever a design choice was made between two or more viable options.
- When a commit is generated or substantially assisted by an AI agent, add a `Co-authored-by: <agent-name>` trailer or note `AI-assisted: <tool>` in the body.

## Pull Request Style

- Keep each pull request focused on one concern.
- Use a PR title in the same Conventional Commit style as the final commit.
- In the description, explain the problem, the approach, the risk level, and alternatives that were considered.
- List the checks you ran and any checks you intentionally did not run.
- For a change to a diagram or the kit, attach a before and after screenshot.
- Call out follow-up work instead of mixing it into the same PR.
- **Before merging**, make sure the commit message(s) entering `develop` contain all essential reasoning from the PR discussion.

## Submitting Changes

1. Fork the repo
2. Create a feature branch from `develop`: `git checkout -b feat/new-figure origin/develop`
3. Make your changes
4. Rebase your branch on the latest `origin/develop`
5. Run the local checks above
6. Submit a pull request to `develop` using `.github/pull_request_template.md`
7. Merge with `Rebase and merge` (preferred) or `Squash and merge`; do not use merge commits
8. Release `develop` to `main` with a maintainer-run fast-forward: `git fetch origin && git push origin origin/develop:main`
9. Create and push an annotated version tag from `main`, then create a GitHub Release targeting that tag; the Release starts the workflow that attaches the skill zip
10. Review responsibility is assigned through `.github/CODEOWNERS`

## Version Policy

Bump `metadata.version` in `SKILL.md`, `version` in `.claude-plugin/plugin.json`,
and the plugin `version` in both `marketplace.json` files together, following [Semantic Versioning](https://semver.org/):

- **patch** (0.1.x): a fix to a script, a template or a rule
- **minor** (0.x.0): a new figure type, diagram type, vendor pack or output
- **major** (x.0.0): a change that breaks an existing spec file or `doc.json`

Docs-only and CI-only changes need no bump.

## Maintainer Notes

- Protect `main` and `develop` against direct pushes.
- Enable `Rebase and merge` (preferred) and `Squash and merge` (fallback). Disable `Create a merge commit`.
- Configure `develop` to require linear history and the CI checks `Syntax`, `Vendor files`, and `Secrets`.
- Configure `main` so only maintainers can update it, with no force pushes or deletions.
- Never publish a Release for a tag that is not on `main`, or whose version differs from `SKILL.md`, `plugin.json` or either `marketplace.json`: the release workflow fails and attaches nothing.
- After each fast-forward of `main`, tag and release:
  ```bash
  git tag -a v<VERSION> -m "v<VERSION>: <one-line theme>

  WHAT SHIPPED:
  - Key changes since the prior release

  KEY DECISIONS:
  - Significant design choices made in this release cycle

  KNOWN LIMITATIONS:
  - Open issues or deferred work"
  git push origin v<VERSION>
  ```
