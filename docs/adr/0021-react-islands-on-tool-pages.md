# A React island on a tool page, and the tool page's own content security policy

A marketing site page may hold one React island when it is a tool page (CONTEXT.md, **Tool page**), and only then. The island is the tool. The heading, the privacy line, the prose and the rest of the page stay static HTML, so a crawler and a reader with no script get the whole page but the tool. Every other site page stays plain HTML under ADR 0012.

The tool page is the one site page whose content security policy differs from every other page's, and it differs by `blob:` in `img-src` alone. The tool shows a creator's own files through `URL.createObjectURL`, which yields `blob:` URLs, so nothing is uploaded and nothing leaves the browser tab. A `blob:` source admits only the object URLs the page itself made, from no other origin, so ADR 0007's claim holds on the tool page as on every other page. The visual system builds the tool page's policy from the base policy, so the two cannot drift.

One option was rejected. Adding `blob:` to every page's policy widens every page's policy for one page's need.
