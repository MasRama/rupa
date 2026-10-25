# Contributing to Rupa

Thanks for helping. This guide covers how to set up the project, what a good change looks like, and how releases happen.

## Setup

You need Node.js 22.12 or newer.

```bash
git clone https://github.com/MasRama/rupa.git
cd rupa
npm install
cp .env.example .env   # only needed to run the bot or deploy commands
npm run check          # typecheck, lint, format check, tests
```

Most work needs no Discord credentials. Tests run against in-memory SQLite and do not talk to Discord.

## Where things go

- `src/core/`: Rupa itself (routing, registry, database, config, deploy planning). It must stay business-neutral and must not import from `src/features/`.
- `src/features/<name>/`: the example features. One capability per folder; other code imports only its `index.ts`.
- `src/app/`: composition (`features.ts`) and the entrypoint.
- `src/cli/`: the `rupa` command.
- `docs/`: user-facing guides. Update them in the same pull request as the behavior they describe.

[AGENTS.md](./AGENTS.md) has the full set of conventions in one place.

## Making a change

1. For anything bigger than a small fix, open an issue first so we can agree on the approach.
2. Branch from `main`.
3. Write a failing test, then make it pass. Pure logic (routing, SQL, permission rules, formatting) is always tested. Handlers that only call Discord APIs may stay untested, as long as their logic lives in tested functions.
4. Run `npm run check` and `npm run build`.
5. Open a pull request and fill in the template.

## Commit messages

Rupa uses [Conventional Commits](https://www.conventionalcommits.org/). Releases and the changelog are generated from them, so the type matters:

| Type | Use for | Release effect (pre-1.0) |
| --- | --- | --- |
| `feat` | New user-facing capability | minor |
| `fix` | Bug fix | patch |
| `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `style` | Everything else | none on its own |

Add a scope when it helps (`feat(routing): ...`, `fix(moderation): ...`). Describe what changed and why in the body. Mark breaking changes with `!` (`feat(core)!: ...`) and a `BREAKING CHANGE:` footer.

## Code style

- TypeScript strict mode. Avoid `any`; if you need it, leave a comment explaining why.
- Prettier formats `src/` (`npm run format`). ESLint must pass.
- Ephemeral replies use `flags: MessageFlags.Ephemeral`.
- Component custom ids are routes defined with `button()`, `select()` or `modal()`. Build them with `.id()`, never by hand.
- SQL lives in a feature's repository module; tables are prefixed with the feature name.

## Releases

Maintainers do not tag releases by hand. On every push to `main`, [release-please](https://github.com/googleapis/release-please) opens or updates a release pull request with the next version and changelog. Merging that pull request creates the tag and GitHub release.

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By taking part you agree to uphold it.
