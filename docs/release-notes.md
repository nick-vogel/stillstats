# Drafting an app release note

The `/release` skill (`~/.claude/skills/release/SKILL.md`) owns the order of an app release: the note, its highlights and any claim fixes are drafted on one branch, Nick approves them word for word from a local preview before a pull request exists, one pull request carries them, and the GitHub release is written as a draft and published after Nick's yes. This page owns the note itself: the range, the version, the frontmatter, the body, and the checks before and after the merge.

A Studio extension release note is still written by hand.

## 1. List what the release ships

Start a branch from a fresh `main`:

```sh
git fetch origin
git switch -c release-<version> origin/main
```

Then list the range:

```sh
pnpm --silent --filter @creator-analytics/releases merged-since-release
```

The range starts at the last app release tag merged into `HEAD`. A tag is the bare version, such as `2026.11.9`; extension tags (`extension-1.0.0`) and any other tag are ignored. Before the first app release there is no tag, and the command refuses until it is given a commit to start from:

```sh
pnpm --silent --filter @creator-analytics/releases merged-since-release --since <commit>
```

`--to <ref>` ends the range somewhere other than `HEAD`. Pass the options with no `--` before them; pnpm hands a `--` on to the command, which refuses it.

The command prints JSON:

- `base`: where the range starts, `{ "tag": "<version>" }` or `{ "commit": "<commit>" }`.
- `pullRequests`: each pull request merged in the range, oldest first, with its `number`, `title`, `branch`, the `issues` its branch and title name, and its merge `commit`.
- `commits`: each commit on `main` that no GitHub pull request merge message names, oldest first, with its `commit` and `subject`. That is a direct commit, a squash merge, or a pull request merged with an edited merge message. Read these too; any of them can change what a creator sees.
- `highlights`: the names of the highlight files in `packages/releases/highlights/` that the range added.

## 2. Read what changed

Read each pull request with `gh pr view <number> --repo nick-vogel/creator-analytics`, and its issues with `gh issue view <number>` when the pull request alone does not say what a creator gets. For an entry in `commits`, read `git show --first-parent <commit>`, which for a merge shows everything it brought to `main`.

Keep what a creator can notice: a new screen, chart, number or setting, a change to one, a fix to something they could see go wrong, something that got faster, something that went away. Drop what they cannot: refactors, tests, CI, docs, dependency bumps and internal tooling.

When nothing in the range changes anything for a creator, stop and say so instead of drafting a note.

## 3. Name the note

The version is the release day in CalVer, `YYYY.M.D` with no leading zero, such as `2026.11.9`. When a note for that day already exists in `packages/releases/notes/`, the version takes the next number after it: `2026.11.9.1`, then `2026.11.9.2`.

```sh
ls packages/releases/notes/
```

The note is `packages/releases/notes/<version>.md`.

## 4. Write the frontmatter

The worked example in step 5 shows every field.

- `product`: `app`.
- `date`: the release day, `YYYY-MM-DD`, the same day as the version (`2026-11-09` for `2026.11.9` and `2026.11.9.1`).
- `summary`: one line that says what the release brings. It is the release page's description, so it is read on its own in search results and link previews.
- `highlights`: the names from the command's `highlights` list, as a list, or `[]` when it is empty. Each name is a file in `packages/releases/highlights/`, without `.md`. A highlight the range added belongs in this note, since the "What's new" screen shows it only once a note lists it.
- `removes`: `true` when a change in the range removed something, otherwise `false`. A rollback ([deploy.md](deploy.md#rollback)) refuses to go back past a release marked `true`, so mark it whenever older code would break against what this release leaves behind. Look for:
  - a migration in the range that drops a column or a table: `git diff --name-only <base> HEAD -- packages/database/drizzle/`, where `<base>` is the tag or commit the command printed as `base`, then read each new migration for `DROP`;
  - a removed route, screen or setting.

  When it is `true`, the body says what went.

## 5. Write the body

The body is the note a creator reads on the release page, and the GitHub release body is a copy of it. Write it for a creator who uses Stillstats, not for whoever built it.

- Plain words. Say what changed for the creator and what they can do now, such as "The sidebar has a channel picker, so you can switch channels from any screen."
- No issue numbers, pull request numbers, branch names, ticket language or internal names (no "#268", no "the gateway", no "ADR 0017").
- No em-dash. Restructure with a period, a comma or parentheses.
- Lists and headings are fine. A table must leave its columns unaligned (no `:---` or `---:`), because an aligned column writes an inline style the page's policy blocks.
- No image from another site. The page's policy blocks it.
- When `removes` is `true`, one sentence says what went, such as "The numbers table under the retention charts is gone; the charts show the same values."

A worked example, `packages/releases/notes/2026.11.9.md`:

```markdown
---
product: app
date: 2026-11-09
summary: A channel picker in the sidebar, and audience cards that load faster.
highlights:
  - channel-picker
removes: false
---

## What changed

- The sidebar has a channel picker, so you can switch channels from any screen.
- The audience cards load in about half the time.
```

## 6. Check it

```sh
pnpm --filter @creator-analytics/site build
```

The build fails on a malformed note: a version that is not CalVer, a date that is no real day, a summary that is not one line, a highlight with no file, an em-dash, an aligned table or an image from another site. Fix the note until the build passes.

## 7. Open the pull request

Commit the note, its highlights and the claim fixes Nick approved in the preview together, push the branch, and open one pull request that adds them. Its title names the version, such as "Release note for 2026.11.9". The merge puts the release page on staging, where it confirms what Nick already approved.

## 8. Check the range again before publishing

A pull request can merge to `main` while the note's pull request is open. It ships in this release, but it is in no note, and the next release's range starts after it, so a highlight it added would never show. So before the release is published, list the range again up to the note's merge commit (with the same `--since <commit>` before the first app release):

```sh
pnpm --silent --filter @creator-analytics/releases merged-since-release --to <merge commit>
```

When the list has a pull request, a commit or a highlight that the note does not cover (other than the note's own pull request), Nick decides each one: amend the note in a new pull request and run this check again on that pull request's merge commit, or leave it out because a creator cannot notice it. The GitHub release is then written as a draft from the merge commit the check passed on, tagged and titled with the bare version (`2026.11.9`, no `v`), and published after Nick's yes. Publishing runs the release workflow, which checks the tag against the note, replaces the release body with the note's text and deploys production; [deploy.md](deploy.md#release) has its steps.
