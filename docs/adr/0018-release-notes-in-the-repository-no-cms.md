# Release notes live in the repository, and the site still takes no CMS

This ADR amends ADR 0012, which said to revisit the static site, and to weigh a CMS, when the site got a blog or a changelog. The release pages (#572) are that changelog. ADR 0012 stays as written, so the original decision and the reason it changed both stay readable.

The site takes the trigger and keeps no CMS. A release note is a markdown file in `packages/releases/notes/`, and a highlight is one in `packages/releases/highlights/`. The site build reads them with the release content package and writes `/releases/` and one page per release through the same partials and plugins as every other page. Three things make that enough:

1. I am the only author, and I write in the repository.
2. A release is cheap and on demand, so a page that needs to change goes out with the next release, the same day if it has to.
3. Every published page sits in a tested commit. ADR 0012 asked that the site test run on every publish, not only on every commit, before a CMS could earn its place. With the notes in the repository, a publish is a commit, so the site test runs before each one: the em-dash rule, the title and description, the preview and the sitemap cover a release page as they cover the homepage. The site test builds fixture notes, not the committed ones, so the build holds the rules that a real note could break: the release content package refuses an em-dash, an inline style (which an aligned table writes) and an image the site does not serve in a note or a highlight, and a page with no title or description fails the build.

The markdown parser, markdown-it, runs at build time only, approved on 2026-11-09 under ADR 0014. It writes no raw HTML from a note, and no parser code reaches the browser, which the site and web app tests check on every build.

## The "What's new" banner and ADR 0011

The web app shows a banner when the newest app release with a highlight is newer than the creator's "What's new" marker and newer than their account (#580). ADR 0011 refuses attention tricks, and the banner keeps clear of them on purpose, so a later change cannot grow it into one:

1. It is one plain notice: one line, a link to "What's new" and a close button, in the line token's box with no fill.
2. It holds no number. It never counts the highlights or the releases the creator has not seen.
3. It says nothing urgent. No colour alarm, no badge, no dot on the sidebar's link, and no transition or animation.
4. One press takes it away. Its close, its link, or opening "What's new" by any other path saves the marker, and it stays gone until a newer release with a highlight ships.

A banner that counts, nags, comes back on a timer or animates for attention is a breach of ADR 0011, not a change to this section.

Reopen this when a second person writes for the site, or when blog posts (#570) must go live without a release. Either one puts a publish outside the release, and then the gate ADR 0012 asked for has to come from somewhere else.
