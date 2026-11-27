# The repository is public

**Everything a commit carries is published: its files, its message, its author and committer, and the title and body of the pull request that merges it.** Stillstats reads a real creator's YouTube data, and the maintainer runs it next to other work on the same infrastructure. None of that private material may land here.

## What never lands

- **The name of any organization the maintainer works for or with, other than the LLC that operates Stillstats**, in any form: the name, its initials, its domain, its Cloudflare Access team domain, and an email address at its domain. Write `example.cloudflareaccess.com` for a team domain.
- **A real creator's data**: channel and video IDs, titles, descriptions, revenue and analytics figures, subscriptions and recommendations, from the maintainer's channel or anyone else's. A saved Studio or youtube.com page gets sample figures and sample IDs before it is committed (below).
- **Real network details**: the server's public IP address, a tailnet address, a host name that is not already in `docs/deploy.md`. Write documentation addresses from RFC 5737 (`192.0.2.x`, `198.51.100.x`).
- **Secrets and their near relatives**: a token, a key, a webhook URL, a database URL with a password, a Cloudflare Access AUD tag. GitHub secrets and the private secrets repo hold those.
- **A home folder**, in any path. Write `~/` or a made-up user such as `/Users/someone`.
- **An author or committer address other than a GitHub noreply address.**
- **Files whose license forbids a public repository**: the Fontshare fonts (Cabinet Grotesk and Switzer, ITF Free Font License), which `pnpm fonts` copies from the private `nick-vogel/stillstats-fonts`, and YouTube Studio's own stylesheet, `apps/extension/test/fixtures/studio/studio.css`, which `extract-studio-styles.ts` writes locally. `.gitignore` names both.

## Saved Google pages

A saved Studio or youtube.com page has its scripts and session data stripped, and every real figure, ID, title and description replaced with a sample in the same format, before it is committed. Keep the markup the parsers depend on. Record each swap in that fixture folder's README (`apps/extension/test/fixtures/studio/README.md`, `apps/extension/test/fixtures/youtube/README.md`), so the next save gets the same edits.

## The check

`pnpm check:private` fails when the tree holds a term from the maintainer's private list. With `--range origin/main..HEAD` it reads each line the commits add, their messages and their authors, since a term added and later removed is still in the public history. With `--stdin` it reads a pull request's title and body. The list lives outside the repository, at `PRIVATE_TERMS_FILE` or `~/.config/stillstats/private-terms.txt`, because it names what it guards: never commit it, and never quote one of its terms in a commit, a review doc or a pull request. Where no list exists, as in a contributor's clone, the check passes with a note, and this rule is the whole guard.

Run it before every push, and on every pull request before its merge. On the maintainer's Mac a local pre-push hook runs it on the pushed commits. A list term is a floor, not the rule: a new name that the list does not hold yet still never lands, and it goes on the list in the same session that finds it.

## The tracker

Issues filed before 2026-11-27 stay in the private `nick-vogel/creator-analytics`, since they hold the material above, and a commit subject refers to one as `creator-analytics#<n>`. When work on one of its epics starts, the epic is filed again here, and new commits refer to the issue in this repository.
