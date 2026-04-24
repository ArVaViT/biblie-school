## Summary

<!-- 1-3 lines: what changed and why. Link related issues with "Closes #N". -->

## Type of change

<!-- Check the one that applies. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Refactor (code change that neither fixes a bug nor adds a feature)
- [ ] Documentation
- [ ] CI / tooling
- [ ] Breaking change (explain in the summary above)

## Checklist

- [ ] Follows [`docs/DESIGN.md`](../docs/DESIGN.md) — no raw palette classes,
      no `window.prompt/alert/confirm`, no `text-[Npx]`, no hand-rolled overlays.
- [ ] New async views have loading / empty / error states.
- [ ] Verified in dark mode and at 360x640 (if UI changes).
- [ ] `npm run lint` and `npm run test:run` pass locally.
- [ ] `ruff check .` and `mypy app/` pass locally (if backend changes).
- [ ] No new library without the four-check rule in DESIGN.md.
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## Screenshots / recordings

<!-- Optional: paste before/after screenshots for UI changes. -->
