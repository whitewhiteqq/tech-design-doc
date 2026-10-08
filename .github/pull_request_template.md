## Summary

- Describe the change clearly.
- Link any issue, task, or discussion if relevant.
- Use a PR title in conventional format, for example `feat(kit): add timeline figure`.
- State the problem, the approach, and any important tradeoffs.

## PR Target

- [ ] This PR targets `develop`

## History Hygiene

- [ ] My branch is rebased on the latest target branch
- [ ] This PR is intended for `Rebase and merge` or `Squash and merge`
- [ ] I did not add merge commits to this branch unless a maintainer explicitly requested it

## Validation

- [ ] Python and JavaScript syntax checks pass
- [ ] `check_diagrams.py` on `examples/deployment/*.md` prints 0 FAIL
- [ ] `check_pages.py` on `examples/relay-design.html` prints 0 failures
- [ ] `claude plugin validate .` passes
- [ ] The two `marketplace.json` files are identical
- [ ] Examples regenerated if a script, the kit or a template changed

## Risk Review

- [ ] No secrets, credentials, or private data were added
- [ ] No icon zip, `.index.json` or `kit/icons.js` is in the diff
- [ ] Every vendor mark keeps its product name and credit line, unmodified
- [ ] Documentation was updated if behavior or workflow changed

## Notes For Reviewers

- Call out any areas that need special attention.
- Attach before and after screenshots for any diagram or kit change.
- Note any follow-up work that is intentionally out of scope.
