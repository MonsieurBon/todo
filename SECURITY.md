# Security

## Supported versions

**Only the newest release is maintained.** There are no maintenance branches and nothing is
back-ported — a fix, security fixes included, ships as the next version and only as the next
version. If you are running an older tag, updating is the fix.

## Reporting a vulnerability

**Please don't open a public issue.** There are no maintenance branches, so there is no patched
version for anyone to move to until the next release exists — a public report arms whoever reads it
first and leaves every running instance with nowhere to go.

Use GitHub's [private vulnerability
reporting](https://github.com/MonsieurBon/todo/security/advisories/new) — it is enabled on this
repository and goes only to the maintainer.

Useful things to include, as far as you have them:

- the version or image tag you reproduced it against
- what an attacker gains, not only what misbehaves
- the request, payload or sequence that triggers it

What to expect: an acknowledgement, a fix released as the next version, a GitHub Security Advisory
naming the affected versions when that release ships, and credit in it unless you would rather not
be named. The advisory is what reaches people who are pinned to an older tag and would otherwise
never learn there was something to update for.

There is one maintainer here and no on-call rota, so I won't promise a response time I might miss.
What I will promise is a threshold: **if you have heard nothing after two weeks, the report did not
reach me.** Send it again, or open a public issue saying only that you have a report you cannot
deliver privately — that tells me to look without telling anyone else what you found.

## What is in scope

This repository — the Spring Boot API, the MCP server, the Angular web app, and the deployment
material (`Dockerfile`, `keycloak/realm-todo.json`, the workflows). The realm export is ours even
though Keycloak is not: a client scope granted too freely, or a redirect URI in that file that
accepts more than it should, is a finding here.

Out of scope, because they are not ours to fix: the identity provider you point it at, whatever
reverse proxy terminates TLS, and any deployment where `TODO_CANONICAL_URI` or `OIDC_ISSUER_URI` is
misconfigured — [the README](README.md) explains what those have to be.

Also out of scope, because it is deliberate: the local development stack. `compose.yaml` boots
Keycloak with `admin`/`admin` and MySQL with `root`/`root`, `scripts/keycloak-dev-user.sh` creates a
user with a fixed password, and the `localhost` audience and redirect URIs in the realm export are
there so the thing runs on your machine. None of that is how a deployment is meant to be configured.

**If you are not sure which side of one of these lines your finding falls on, report it privately
anyway.** It is easy to move a report out into a public issue afterwards, and impossible to move one
back.
