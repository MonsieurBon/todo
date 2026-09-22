# todo.ethy.ch

A One Minute To-Do List: three urgency zones, soft caps, a review sweep. Spring Boot 4 + Angular 22
in one jar, plus an MCP server.

## How we work

- Fabian is the PO, the agent is the Developer. *What* gets built is his call; *how* is yours.
- Owning the *how* means judging the approach, not just doing the ticket. When filing an item, when
  starting one, and while implementing one, ask whether it still fits the app's shape. The third
  change to the same mechanism is the signal that the mechanism is what's wrong — counting review
  rounds and PRs alike, since three rounds patching one thing says as much as three PRs. Raise it
  and we plan; closing a PR and starting over is a normal outcome, not a failure, including when
  the review asks for it: the raise is yours, the call to close is his.
- The backlog is in the todo app under the label `todo-app`, over the `todo` MCP server — not
  GitHub issues. No MCP server? Ask him; don't fall back to issues.
- One thing at a time, one PR at a time. Dependabot's PRs don't count, but should ideally be merged
  before starting the next item.
- TDD: failing test first. The test and the code that passes it land in the same commit.
- Every change goes through a PR that Claude reviews. The review is one comment; answer it point by
  point — fix it or say why not. Silence is not an answer. The review may reject the approach, not
  only the diff.
- Read your own diff before every push — the first one and every round of review fixes alike.
  Nothing reaches the remote that you haven't reviewed yourself.
- First round: implement, review your own diff, push, open the PR.
- Every round after: summarise the review's points and discuss them with Fabian *before* touching
  code — the fix is not yours to choose alone. Then implement, review your own diff, reply to the
  review, and push last; the push triggers the next review, which reads the existing comments.
- During review, a fix is its own commit (`git commit --fixup`). Rebase and squash once, at the end,
  then merge as soon as it's green — a no-op rebase doesn't trigger a fresh review.
- Commits are vertical slices: migration + service + controller + UI for one behaviour, never one
  layer alone.
- A commit message says *what*, not how. A PR body is a brief, not a report — why the change exists
  and what the reviewer can't derive, not the analysis that got you there.
- Don't defer on your own. Out-of-scope find? Raise it. Bug which was introduced by your changes?
  Fix it in the same PR.

## Running it locally

```bash
docker compose up -d                 # MySQL on 3307, Keycloak on 8081 (admin/admin)
./scripts/keycloak-dev-user.sh       # fabian@example.com / test
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev     # app on 8090
```

3306 and 8080 belong to the `recipes` stack on this machine.

`npm start` serves the frontend on 4200 with `/api` proxied to 8090 — but the service worker is only
built in production configuration, so offline behaviour must be tested against `spring-boot:run`
with `npm run build`.

## Layout

| | |
|---|---|
| `src/main/java/ch/ethy/todo/` | `domain`, `repository`, `service`, `web`, `mcp`, `security` |
| `src/main/webapp/` | Angular 22, standalone, signals, `OnPush` |
| `src/main/webapp/api/openapi.json` | the API contract, checked in |
| `src/main/resources/db/migration/` | Flyway; schema is hand-written |
| `keycloak/realm-todo.json` | the realm, declaratively |
| `e2e/` | Playwright, against the real stack |
| `scripts/verify-auth.sh`, `verify-mcp.sh` | end-to-end checks against a running stack |

## The things that are easy to get wrong

- **Lists are sharing boundaries; labels are topics.** Caps count across everything visible, not per
  list — per-list caps would be trivially defeated by making more lists.
- **Authorization is structural.** Every service method taking an id also takes the user and
  resolves both in one query (`findAccessible`, `findByIdAndOwner`). There is deliberately no
  load-by-id helper. Cross-user access answers **404**; a token for the wrong surface stays 403.
- **A token opens one surface, and that is the only scope check there is.** `todo:api` for
  `/api/**`, `todo:mcp` for `/mcp`, enforced once in `SecurityConfig`. There are no capability
  tiers.
- **The tool list in `TodoTools` is the whole bound on what an assistant may do**, now that no
  scope distinguishes one tool from another. Adding a tool widens the MCP surface; the operations
  deliberately absent are renaming, deleting and unsharing a list.
- **A public URL is built from `TODO_CANONICAL_URI`, never from the request.** TLS terminates at
  the proxy, so the request only knows the app's own address, and forwarded headers are not
  trusted.
- **Entities handed back by a service are detached** (`open-in-view` off, reads are
  `@Transactional(readOnly = true)`). Mutating one outside its service writes nothing and still
  answers 200 — so writes live in the service and every mutator resolves its own id privately.
- **Length limits belong on the entity**, because MCP tools hand arguments straight to the domain.
  The entity holds the constant and measures `codePointCount` (utf8mb4); the DTO's `@Size`
  constrains against that constant.
- **A completed task is read-only**, for the same reason: every public mutator on `Task` starts
  with `mustBeOpen()`, `complete` and `reopen` excepted. No test enumerates them, so a new one has to
  remember. `TaskCompletedException` answers 409 — reuse it for the next state refusal rather than
  inventing a 400.
- **Test the deny path** — that the refused thing returns no payload.
- **The API contract is checked in and generated from.** `OpenApiContractIT` rewrites
  `openapi.json` and fails once when a DTO changes; review the diff and commit it. `npm run
  api:types` turns it into the TypeScript the app compiles against.
- **Method names are operation ids** (springdoc), so `delete` in two controllers becomes `delete`
  and `delete_1`. Name them for what they operate on.
- **Offline covers read, create and complete only.** Move, defer and edit need a connection —
  replayed blind they're silent overwrites.
- **A write returns `done`, `settled` or `refused`; it does not throw.** Everything goes through
  `Writes.attempt`, which keeps the reason in the one banner the shell renders. `settled` means the
  server has moved past the thing being changed, so a caller holding its own copy of it — a review
  card — must drop that copy; a caller that ignores the result is back to a click that looks like
  it did nothing. Staleness is the 404, and the 409 that names a completed task: the 409 answers
  any state refusal, so the code in the body is what distinguishes them.
- **A queued write the server refuses on its merits is discarded, not retried or shown**; only a
  refused token keeps it queued. So any server-side limit on a field
  the capture form can send must also be enforced in the form — hence the limits in `model.ts`,
  pinned by `model.spec.ts` against the contract, measured in UTF-16 code units like `@Size`.
- **`navigator.onLine` is not a connection.** Reachability is probed against a URL the service
  worker deliberately does not cache.
- **Only the IdP can end a session.** A token-endpoint answer of 400 or 401 *naming an OAuth error*
  is a refusal: the tokens go and the device signs in again. Every other failure is a connection
  problem and must leave the session, the cached board and the outbox alone — offline everything
  fails, and a wrong guess deletes the offline board and then strands the device at an IdP it
  cannot reach. Guessing the other way only restores the dead end, so lean that way.
- **A recovered session may not be the same person.** Signing in again hands the device to whoever
  answers the login form, so anything queued under the old session is dropped unless the subject
  that comes back matches the one that left. The answer waits for a session to actually resolve:
  abandoning the login form is ordinary, and deciding before anyone has claimed the device would
  destroy the user's own unsynced writes. Nothing can leak while it waits, because flushing needs
  a board and the board needs a session.

## Tests

```bash
./mvnw test                       # Java unit tests + lint/format/vitest for the frontend
./mvnw -Pintegration-tests verify # Testcontainers integration tests; skips the Java unit tests
npm run e2e                       # Playwright; needs the stack up and `npm run build` run
./mvnw test -Dskip.npm=true -Dskip.installnodenpm=true   # Java only
npm run test:ci                   # frontend only
```

The frontend build is wired into the Maven lifecycle, so every goal runs `npm ci` and `ng build`
first unless skipped. Integration tests share one container and context, so none may assume an empty
database — each invents its own user. Locally that container can outlive the run: with
`testcontainers.reuse.enable=true` in `~/.testcontainers.properties` MySQL's startup is skipped, and
the schema is still rebuilt from the migrations every time. Playwright is a local gate; CI has
neither a browser nor an IdP.

Prefer a unit test. An integration test earns its container only when what it checks exists nowhere
but in a real schema or the running application — a query, a migration, structural authorization,
the security and web wiring. Before writing one, ask whether it tests our code and configuration or
only the framework's.

## Conventions

- Conventional commits (see below). Java formatted by Spotless (Google style); TS/HTML by Prettier
  (100 cols, single quotes); ESLint with the `app` prefix.
- Angular: standalone components, signals, `OnPush`, logic in services rather than components.
- Comments are a last resort. Write one only for what the code cannot say — why, or a constraint
  that isn't visible from here. Never pin a fact the next PR will move (a version, a list, a PR
  number); prefer the durable rule and how to re-derive it.

## Releasing

Pushes to `main` are released by semantic-release, from the commit messages — an unprefixed commit
ships nothing.

| Prefix | Effect |
|---|---|
| `feat:` | minor |
| `fix:`, `perf:`, a revert | patch |
| `BREAKING CHANGE:` footer | major |
| `docs:`, `refactor:`, `test:`, `chore:`, `build:`, `ci:`, `style:` | ships nothing |

A breaking change is a `BREAKING CHANGE:` footer — with a space, its own paragraph in the body.
`BREAKING-CHANGE:` and a subject-line mention both fail to produce a major here. One commit in the
range carrying it is enough, whatever its type. Squash merge is off, so when squashing locally the
prefix must describe the whole.
