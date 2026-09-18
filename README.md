# todo

A [One Minute To-Do List](https://www.michaellinenberger.com/1MTD.html): three urgency zones, soft
caps, and a review sweep. One container — REST API, MCP server and the web app in a single jar.

This README is the **operator contract**. Deploying this should not require reading the source; if
something here is missing, that is a bug in this file.

For working on the code, see [CLAUDE.md](CLAUDE.md).

---

## The image

```
ghcr.io/monsieurbon/todo:<version>
ghcr.io/monsieurbon/todo:latest
```

`<version>` is a semver tag — `1.4.0`, not `v1.4.0`.
**Pin a version.** `latest` moves on every push to `main`, which makes "what is actually running"
unanswerable and a rollback guesswork.

## Shape of the service

| | |
|---|---|
| **Ports** | one, HTTP, `8080` by default. Nothing else needs publishing. |
| **Volumes** | **none.** The app writes no files; everything durable is in MySQL. It runs as uid/gid `1001` and does not need to own anything. |
| **Health** | `GET /actuator/health` → `200 {"status":"UP"}`, or `503` with `"DOWN"`. Unauthenticated, because a healthcheck carries no credentials — and for that reason it reports **no detail** about what is wrong. |
| **Healthcheck** | the image ships one (`/opt/app/healthcheck.sh`, 15s interval, 60s start period). Override it only if you need different timings. |
| **Stop** | responds to `SIGTERM`. Java is PID 1, so a plain `docker stop` shuts down cleanly. |
| **Scaling** | one instance. Nothing prevents more, but nothing has been tested with more. |

### Configuration

Every variable the app reads. There are no others.

| Variable | Default | Required | Notes |
|---|---|---|---|
| `DB_HOST` | `localhost` | **yes** | |
| `DB_PORT` | `3306` | no | |
| `DB_NAME` | `todo` | no | |
| `DB_USER` | `todo` | **yes** | |
| `DB_PASSWORD` | `todo` | **yes** | The default is a development password. Set it. |
| `OIDC_ISSUER_URI` | `http://localhost:8081/realms/todo` | **yes** | The identity provider's **public** realm URL. Both halves of that matter — see below. |
| `TODO_CANONICAL_URI` | `http://localhost:8080` | **yes** | **The public origin of this app, and the audience it demands.** See below. |
| `SERVER_PORT` | `8080` | no | The healthcheck follows it. |
| `LOG_LEVEL_SECURITY` | `INFO` | no | `DEBUG` to see why a token was rejected. |
| `JAVA_OPTS` | `-XX:MaxRAMPercentage=75.0` | no | Replaces the default entirely, so repeat the heap setting if you add to it. |

> ⚠️ **`TODO_CANONICAL_URI` is the single most likely thing to get wrong.** It is not decorative:
> the app rejects any token whose `aud` is not this exact string. It must equal the audience the
> identity provider mints (see below) **and** the public URL people reach the app on. A mismatch
> fails as `401` on every request with nothing in the response explaining why —
> `LOG_LEVEL_SECURITY=DEBUG` is what tells you.
>
> Write it as a bare origin — `https://todo.example.com`, **no trailing slash and no path** — here
> and in the IdP's audience alike. The app is served from the root of its host, and it appends paths
> to this value as written.

### `OIDC_ISSUER_URI` has to satisfy two things at once

This is the setting that costs an evening, because the two obvious choices each fail, and they fail
differently. Both failures below were reproduced against a real container.

The URL must be **both**:

1. **Byte-for-byte what the identity provider puts in the token's `iss` claim** — which, unless the
   IdP is pinned to a hostname, is derived from whatever address the *browser* used to log in.
2. **Reachable from inside this container**, because the app fetches signing keys from it.

| What you set | What happens | How it looks |
|---|---|---|
| The internal name (`http://keycloak:8081/realms/todo`) | Reachable, but every token says `iss: http://localhost:8081/...` | **`401` on every request**, with a valid token and a correct audience. Nothing in the response says why. |
| The public URL, not resolvable inside the container | `iss` matches, but the signing keys cannot be fetched | **`503`** with `identity_provider_unavailable`. |

**The fix is to stop letting the IdP derive its own issuer.** Pin Keycloak to one public hostname
(`KC_HOSTNAME`), so `iss` is that URL no matter how the realm was reached — and make that hostname
resolve inside the app's container, with a DNS entry the container network can see or an
`extra_hosts` entry. One URL, used by the browser, written in the token, and configured here.

`LOG_LEVEL_SECURITY=DEBUG` names the mismatch in the log; nothing in the HTTP response does.

## Database

MySQL **8.4**, `utf8mb4` (`utf8mb4_0900_ai_ci`). The app needs `SELECT, INSERT, UPDATE, DELETE` plus
`CREATE, ALTER, INDEX, REFERENCES, DROP` on its own schema — Flyway owns the schema and migrates it.

**Flyway runs on startup.** Two consequences worth planning around:

- **Rolling back to an older image against a migrated schema is not safe.** There are no down
  migrations. Roll back the database too, or don't roll back.
- Two instances starting simultaneously against an empty schema will race. Flyway locks, so this is
  survivable, but there is no reason to do it.

Nothing is cached outside the database, so restoring it restores everything.

## Identity provider

The app is a **pure OAuth 2.1 resource server**: it validates tokens and issues none. It stores no
passwords and has no login form. Something must issue tokens for it.

What it requires of that issuer, independent of which product you use:

- Two scopes, one per surface: `todo:api` opens the REST API, `todo:mcp` opens the MCP server.
  Neither is a permission tier — past the gate a token may do everything its surface offers, to
  its own data. A client is granted one of them and cannot obtain the other.
- **Each must be a _default_ client scope of its client, not an optional one**, because no client
  names it in its request: the web app must not, so that a bundle cached in a browser never pins a
  scope name, and an assistant cannot be relied upon to, since nothing obliges a third-party MCP
  client to read the metadata that advertises it. Configure either as optional and that surface
  answers `403` to everyone.
- Tokens whose **`aud` contains `TODO_CANONICAL_URI`**. This is the security boundary the MCP
  specification requires, and it is not optional.
- Standard OIDC discovery at `${OIDC_ISSUER_URI}/.well-known/openid-configuration`.
- A public client `todo-web` (authorization code + PKCE) whose redirect URI is the app's origin,
  with `todo:api` among its default scopes and `offline_access` optional — without `offline_access`
  the web app asks for a password every time a phone reclaims the process.
- A public client `todo-mcp` (authorization code + PKCE) for AI assistants, with `todo:mcp` among
  its default scopes.
- Confidential clients are not used anywhere; there are no client secrets to manage.

**A working implementation is provided**: [`keycloak/realm-todo.json`](keycloak/realm-todo.json),
importable with `--import-realm`. It also defines clients for AI assistants over MCP.

> ⚠️ **Rewrite it before importing.** The audience mapper and `todo-web`'s redirect URIs are
> literal `http://localhost:8090`. Keycloak does **not** substitute `${env.VAR}` during realm
> import — a placeholder is stored verbatim, becomes the expected audience, and rejects every token
> ever issued. Substitute the real origin as part of whatever applies the file.

### Upgrading a deployment that still has the four capability scopes

Until the surface scopes replaced them, clients were granted `todo:read`, `todo:write`, `todo:admin`
and `todo:capture`. `--import-realm` will not update a realm that already exists, so an existing
IdP has to be changed by hand. Add before removing and no client is ever locked out:

1. Create the client scopes `todo:api` and `todo:mcp`, both with `include.in.token.scope` on.
2. Give `todo-web` `todo:api` and `todo-mcp` `todo:mcp`, both as **default** client scopes, so that
   neither client has to name one. Leave the old scopes assigned: a token then carries both sets,
   which the old and the new app each accept, and that overlap is the window to deploy in.
3. Deploy the app.
4. Unassign the four old scopes and delete them, along with the capture-only client — without
   `todo:capture` it can no longer obtain a scope that opens anything. **Only once nothing asks for
   them any more**: a browser still running the pre-deploy bundle names `todo:read` in its
   authorization request, and Keycloak refuses that request outright, so the user cannot sign in at
   all — not even to recover. A hard reload is the way out for a client that missed the window.

Do it in the other order and every client is refused until the IdP catches up. Tokens minted before
step 2 carry no `todo:api` and are answered `403`; whether a refresh repairs that depends on how
your Keycloak applies default scopes on refresh, so expect users to sign in again.

There is no waiting period that makes step 4 provably safe — a device that has not opened the app
since before the deploy still holds the old bundle. It is a one-off: the current bundle names no
`todo:` scope, relying on the default grant instead, so nothing cached can pin a name again.

The realm file also renames the full-access MCP client from `todo-claude-code` to `todo-mcp`, since
the MCP server is not Claude Code's. Renaming an existing one is optional — keeping the old client
id spares you re-pointing every assistant.

**Ordering: none required.** Measured, not assumed:

| | |
|---|---|
| App starts while the IdP is unreachable | yes — issuer metadata is fetched lazily |
| Web app and static content while it is down | served |
| Authenticated requests while it has never been reached | `503` with `Retry-After` |
| Once it comes back | recover automatically, **no restart** |
| If it goes down after tokens have been validated | keep working from cached keys |

So no `depends_on`, and restarting the IdP does not require restarting this. Health deliberately
ignores the IdP: failing the probe on an IdP blip would restart a container that was working.

## Reverse proxy

The app serves its own static files and does its own routing.

- **Client-routed paths must reach the app.** `/capture`, `/review`, `/lists` are handled by the
  browser app; a proxy that 404s unknown paths breaks a hard reload and the Android share target.
  Forward everything.
- **`/mcp` needs streaming.** Do not buffer responses on that path.
- The app sets no security headers; the proxy should. The previous deployment set none —
  at minimum `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, and a
  `Referrer-Policy`.
- TLS terminates at the proxy. The app speaks plain HTTP and expects to.

## Backups

Two databases hold everything:

1. **The app's MySQL schema** — tasks, lists, and which IdP subject owns them.
2. **The identity provider's own storage** — the accounts. Losing it does not just cost logins:
   task ownership is keyed on the IdP's user id, so accounts recreated from scratch do not get
   their tasks back.

Back up both, and restore both together at least once before believing either.

## An example service block

Illustrative — **translate it, do not copy it.** This is one service among many on a real host, and
the values are examples.

```yaml
todo:
  image: ghcr.io/monsieurbon/todo:1.0.0
  restart: unless-stopped
  environment:
    DB_HOST: todo-db
    DB_USER: todo
    DB_PASSWORD: ${TODO_DB_PASSWORD}
    OIDC_ISSUER_URI: https://auth.example.com/realms/todo
    TODO_CANONICAL_URI: https://todo.example.com
  expose:
    - "8080"
```

No `volumes`, no `depends_on`, no `healthcheck` — all three are deliberate, for the reasons above.

## Versions

**Only the newest version is maintained.** There are no maintenance branches and nothing is
back-ported — a fix, security fixes included, is released as the next version and only as the next
version. Staying on an old tag means keeping its bugs. To get a fix, update.

Found a security problem? **Please don't report it in a public issue** — [SECURITY.md](SECURITY.md)
explains how to report it privately, and what falls outside that.
