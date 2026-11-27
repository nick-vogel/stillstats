# Security policy

Stillstats reads creators' YouTube data, so a security hole can expose other people's data. Please
report one privately.

## Reporting a vulnerability

Report it through GitHub's private vulnerability reporting:
[open a draft security advisory](https://github.com/nick-vogel/stillstats/security/advisories/new).
Only the maintainer sees the report.

Please do not open a public issue, a pull request or a discussion about it, and do not post it
anywhere else until a fix is released.

A useful report holds:

- what an attacker can do, and to whose data;
- the steps that show it, against your own account and your own channel only;
- the version (the web app's account menu shows it, and the browser shows the extension's) or the commit.

## What is in scope

- The web app and the API at `stillstats.com`.
- The browser extension.
- The code in this repository, including its GitHub Actions workflows.

Do not test against another person's account or channel, do not run load or denial-of-service
tests, and do not read, change or keep data that is not yours.

## Supported versions

Only the newest release runs in production, and fixes go into the next release. The extension's
newest version on the Chrome Web Store and Firefox Add-ons is the supported one.
