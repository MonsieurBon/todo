# todo.ethy.ch

A One Minute To-Do List (Michael Linenberger's method): three urgency zones, soft caps, and a
review sweep. Spring Boot 4 + Angular 22 in one jar, with an MCP server so an assistant can work
the list by conversation.

## How we work

**Fabian is the PO, the agent is the Developer.** *What* gets built is his decision — discuss
priorities and ordering with him freely, that discussion is welcome, but the call is his. *How* it
gets built is the Developer's responsibility, exercised within the rules below.

**The backlog lives in the todo app, under the label `todo-app`** — reachable over the `todo` MCP
server, not in GitHub issues. That is the list to read before asking what's next, and the list a new
piece of work gets captured into. (A few GitHub issues predate this and are staying where they are
for now; they'll be moved over later. Don't migrate them unprompted.)

**One thing at a time, one PR at a time.** Don't open a second PR of your own while the first is in
flight, and don't bundle two changes into one. Two things this does not mean: Dependabot's PRs
don't count against it — several of those are open at any time, see below — and a fix or a piece of
housekeeping that the work at hand turned up is not a second change. That belongs in the PR that
found it.

**TDD.** Failing test first, always.

**Every change the Developer writes goes through a PR, and Claude reviews it.** The review arrives
as a single PR comment, so the answer is one too: take it point by point and either fix the thing or
say why it isn't being fixed. Silence is not an answer. Dependabot's PRs are the exception —
`claude-code-review.yml` skips that author deliberately, which is what makes a green bump something
the Developer can merge alone.

**Reply first, then push.** Post the answer to a review round *before* pushing the commits that
address it. The push triggers the next review, and that reviewer reads the comments already on the
PR — so an answer that lands after the push arrives too late to inform it, and the same point comes
back.

**Rebase and squash before merging.** Shape the branch into the commits that make sense: several is
fine, but a commit that fixes something introduced earlier *in the same branch* belongs squashed
into the commit that introduced it, not kept as its own. A rebase that leaves the changeset
identical does not trigger a fresh review — so don't wait for one. Merge as soon as the builds are
green.

**Commits are vertical slices, not layers.** Migration plus service plus controller plus UI for one
behaviour, in one commit. Never a commit that is only the database, or only the backend.

**Dependabot PRs are the Developer's job.** They update pins that deliberately don't move on their
own (`.github/dependabot.yml` explains why), and getting them merged is not Fabian's errand — sweep
them before starting the next backlog item, so an update never sits behind a feature branch. A green
bump merges. A red one is information: usually the update found something real and the fix belongs
in our code — but closing it is a legitimate outcome when the problem is the release and not us, and
a withdrawn or compromised upstream version is not something to bend the build around. Note what is
downstream of that judgement: a merge to `main` publishes an image, so the gate is the only one
there is. Automating the merge is allowed; what it gets scoped to is worth settling with Fabian when
it's set up.

**Don't defer on your own.** If something out of scope turns up and the instinct is to leave it for
later, raise it with Fabian first. If it's a bug, the default is to fix it right there in the same
PR.

## Running it locally

```bash
docker compose up -d                 # MySQL on 3307, Keycloak on 8081
./scripts/keycloak-dev-user.sh       # fabian@example.com / test
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev     # app on 8090
```

The ports are deliberate: 3306 and 8080 belong to the `recipes` stack on this machine.

`npm start` serves the frontend on 4200 with `/api` proxied to 8090, which is faster to iterate
against — but **the service worker is only built in production configuration**, so anything about
offline behaviour has to be tested against `mvn spring-boot:run` with `npm run build`.

Keycloak admin: `admin` / `admin` at http://localhost:8081.

## Layout

| | |
|---|---|
| `src/main/java/ch/ethy/todo/` | `domain`, `repository`, `service`, `web`, `mcp`, `security` |
| `src/main/webapp/` | Angular 22, standalone, signals, `OnPush` |
| `src/main/webapp/api/openapi.json` | the API contract, checked in — see below |
| `src/main/resources/db/migration/` | Flyway; the schema is hand-written |
| `keycloak/realm-todo.json` | the realm, declaratively; also what the K8s operator's `KeycloakRealmImport` eats |
| `e2e/` | Playwright, against the real stack |
| `scripts/verify-auth.sh`, `verify-mcp.sh` | end-to-end checks against a running stack |

## The things that are easy to get wrong

**Lists are sharing boundaries; labels are topics.** The zone caps are counted across everything
visible, not per list. A cap counted per list would be enforced once per list, so eight
topic-shaped lists would hold forty Critical Now tasks with every list reporting itself healthy —
which removes the only thing the cap is for. If you find yourself wanting a list per project, you
want a label.

**Authorization is structural.** Every service method taking an id also takes the user and
resolves both in one scoped query (`findAccessible`, `findByIdAndOwner`). There is deliberately no
load-by-id helper: the previous version of this app had one, checked access afterwards, and leaked
data on the failure path. Cross-user access answers **404**, not 403 — a 403 would confirm the id
exists. Insufficient scope stays 403, because the caller can act on that.

**An entity a service hands back is detached.** `open-in-view` is off and the read path is
`@Transactional(readOnly = true)`, so mutating an entity outside the service that loaded it writes
nothing — and still answers 200. That is why every mutator resolves its own id through a private
lookup rather than the public read one, and why a write belongs in the service, never in a
controller. `PATCH /api/tasks/{id}` silently discarded every edit for exactly this reason.

**Test the deny path.** Not just that the allowed thing works — that the refused thing returns no
payload.

**The API contract is checked in, and generated from.** `OpenApiContractIT` keeps
`src/main/webapp/api/openapi.json` equal to the document the server serves; `npm run api:types`
turns that into the TypeScript the web app compiles against. Change a DTO and the test rewrites the
file and fails once — review the diff and commit it. That loop is the only thing stopping the Java
and TypeScript copies of every DTO from drifting.

**Method names are operation ids.** springdoc derives them from the controller method, so `delete`
in two controllers publishes as `delete` and `delete_1`. Name them for what they operate on.

**What works offline, and what does not.** Read, create and complete — exactly the operations that
are safe to replay blind. Move, defer and edit need a connection: replayed against a list someone
else has touched, each is a silent overwrite. Full offline was considered and declined; it would
mean reimplementing the caps, ordering and deferral rules in TypeScript, so the domain logic would
exist twice in two languages.

**`navigator.onLine` is not a connection.** It is true on a captive portal and true when the server
is down — and once the service worker serves the board from cache, a 200 proves nothing either.
Reachability is probed against a URL the service worker deliberately does not cache.

## Tests

```bash
./mvnw test                       # Java unit tests, plus lint/format/vitest for the frontend
./mvnw -Pintegration-tests verify # + Testcontainers integration tests (~70s)
npm run e2e                       # Playwright, needs the stack up and `npm run build` run
```

**The frontend build is wired into the Maven lifecycle**, so every Maven goal — `spring-boot:run`
included — runs `npm ci` and `ng build` first. That is what makes `mvn package` produce a complete
jar, but it is dead weight when only Java changed:

```bash
./mvnw test -Dskip.npm=true -Dskip.installnodenpm=true
```

(`.npmrc` turns off npm's automatic audit and funding lookups. They were costing about 140 seconds
per install here against 1.4 without them, paid on every single build. `npm audit` still works when
run deliberately.)

Integration tests share one container and one application context via `IntegrationTest`, so none of
them may assume an empty database — each invents its own user instead. Playwright is a local gate;
CI has neither a browser nor an IdP.

## Conventions

- **Conventional commits** — see [Releasing](#releasing) for what each prefix ships.
- **A commit message says *what* was implemented, not how.** The diff is the how, and it travels
  with the message — anyone who wants the detail reads it there. Spend the body on why the change
  exists, if that isn't obvious, and nothing on restating the changeset in prose.
- **Small commits** that each leave the build green.
- Java formatted by Spotless (Google style); TS/HTML by Prettier (100 cols, single quotes); ESLint
  with the `app` prefix.
- Angular: standalone components, signals, `OnPush`, logic in services rather than components.

## Releasing

Pushes to `main` are released automatically by semantic-release. The version comes from the commit
messages, so **an unprefixed commit ships nothing** — it neither triggers a release nor appears in
the changelog.

| Prefix | Effect |
|---|---|
| `feat:` | minor |
| `fix:`, `perf:`, a revert | patch |
| `BREAKING CHANGE:` footer | major |
| `docs:`, `refactor:`, `test:`, `chore:`, `build:`, `ci:`, `style:` | correct to use; ships nothing |

When squashing a branch, the prefix must describe the squashed whole.

A breaking change is a **`BREAKING CHANGE:`** footer — with a space, in its own paragraph in the
commit body. Both halves were verified against the analyzer: `BREAKING-CHANGE:` is recognised by the
conventional-commits preset but **not** by the angular one used here and produces no release at all,
and the same words in the subject line are just words, yielding a minor. Any commit in the released
range carries it, a merge commit included, and its type does not matter — `chore:` with the footer
is still a major.

The release builds the jar, builds and pushes the image, attaches the jar to a GitHub release, and
commits the next `-SNAPSHOT` version back to `main`.
