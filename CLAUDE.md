# CLAUDE.md — Agent Instructions for tech-design-doc

This file is read by Claude Code before any operation in this repository.

## Commands

```bash
# Syntax: every Python and JavaScript file
for f in $(git ls-files '*.py'); do python -m py_compile "$f" || echo "FAIL $f"; done
for f in $(git ls-files '*.js' '*.mjs' | grep -v mermaid.min.js); do node --check "$f"; done

# Diagram check on the examples (needs Chrome); must print 0 FAIL
python skills/tech-design-doc/scripts/check_diagrams.py skills/tech-design-doc/examples/deployment/*.md

# Page check on the HTML example; must print 0 failures
python skills/tech-design-doc/kit/tools/check_pages.py skills/tech-design-doc/examples/relay-design.html

# Plugin manifests
claude plugin validate .
```

## Change Workflow

Every change, regardless of size, follows this sequence:

1. **Branch**: `git checkout -b feat/<name>` or `fix/<name>` from `develop`
2. **Implement**: make the change
3. **Regenerate**: if a script, the kit or a template changed, rebuild the affected examples (see CONTRIBUTING.md)
4. **Docs review**: does this change affect README.md, CONTRIBUTING.md, CLAUDE.md or SKILL.md?
5. **Version bump**: see Version Policy in CONTRIBUTING.md
6. **Local checks**: all commands above must pass
7. **Commit**: conventional commit with full body for non-trivial changes
8. **PR -> develop -> main**: follow Branch Strategy in CONTRIBUTING.md

## Vendor Icons: Hard Rules

- Never commit an icon zip, `vendor-icons/.index.json` or `kit/icons.js`. `.gitignore` covers them; never force-add them.
- Never recolour, crop, flip, rotate or redraw a vendor mark. Never draw a vendor icon by hand.
- Every diagram that uses a mark keeps the product name near it and the credit line.
- The exact terms of each pack are in `skills/tech-design-doc/vendor-icons/README.md`.

## Branch Strategy

```
feature/fix branch  ->  develop  ->  main  ->  annotated tag  ->  GitHub Release  ->  skill zip
```

- **Never push directly to `main` or `develop`.**
- Open a pull request targeting `develop`.
- Release promotion: maintainer runs `git merge --ff-only develop` from `main` locally, then pushes.
- Publishing a GitHub Release starts `.github/workflows/release.yml`, which builds, attests and attaches `tech-design-doc-<tag>.zip`.

## Commit Message Style

Use Conventional Commits. For non-trivial changes include the full body:

```
type(scope): short imperative summary

INTENTION:
WHAT CHANGED:
WHY:
ALTERNATIVES CONSIDERED:
REFS:
VERIFIED:
```

See `CONTRIBUTING.md` for the full template and examples.

## Safety

- Never commit secrets, internal hostnames, account IDs or real customer names in examples. Use invented names (the examples use "Relay").
- The scripts make no network calls. Keep it that way: a built page that fetches anything fails `build.py`.
