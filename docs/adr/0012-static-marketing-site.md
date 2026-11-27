# A static marketing site, with no framework and no CMS

Amended by ADR 0018 (release notes in the repository, no CMS).
Amended by ADR 0021 (a React island on a tool page).

The marketing site (`apps/site`) is plain HTML pages, one stylesheet and one small script, built by Vite in multi-page mode and served by the API. The pages and their copy live in git, so the site test, which builds the real site and fetches it through the API, gates every copy change: a page that loses the privacy policy link or the link to a user data policy, or that gains an em-dash, fails the build. OAuth verification depends on the first two. The gate holds no wording (`CODING_STANDARDS.md`, standard 2): the Limited Use statements and the rest of the copy are held by Nick's approval on their issues. A CMS would publish copy outside that gate. Vite was already in the lockfile from the web app, so the site added no dependency while #21 owned dependencies. With four pages, no data and one editor who works in the repo, a framework such as Astro or TanStack Start has nothing to do.

This is the proof-of-concept choice, and migrating off it is cheap because the pages are plain HTML. Revisit it when someone other than Nick edits the copy, or when the site gets a blog or a changelog. A CMS earns its place then, and the site test must run on every publish, not only on every commit.
