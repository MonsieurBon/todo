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
piece of work gets captured into. The server comes from your own client configuration rather than
from this repo, so if you haven't got it, ask Fabian — don't fall back to GitHub issues. (A few
issues there predate this and are staying put for now; they'll be moved over later. Don't migrate
them unprompted.)

**One thing at a time, one PR at a time.** Don't open a second PR of your own while the first is in
flight, and don't bundle two changes into one. Two things this does not mean: Dependabot's PRs
don't count against it — several of those are open at any time, see below — and a fix or a piece of
housekeeping that the work at hand turned up is not a second change. That belongs in the PR that
found it.

**TDD.** Failing test first, always — that is the working order inside a commit, not a commit of its
own. The test and the code that makes it pass land together, so every commit is green.

**Every change the Developer writes goes through a PR, and Claude reviews it.** The review arrives
as a single PR comment, so the answer is one too: take it point by point and either fix the thing or
say why it isn't being fixed. Silence is not an answer.

**The reviewer is main's reviewer.** The workflow runs on `pull_request_target`, so the job, the
composite action, the agent definition and this file all come from the base branch, and only the
diff comes from the branch. That is what lets a pull request that changes the review — its own
definition, what it is judged against, or what decides whether it passed — still be reviewed, by
the version of itself that is already on main. It also means a change to any of those only takes
effect once merged, so the pull request that makes it is reviewed under the old rules.

That holds structurally for all of them but this file. The branch is checked out in full so the
review can read it, and Claude Code loads a `CLAUDE.md` from above whatever it opens — so the
branch's copy lands in the reviewer's context on its first read from the branch, unasked and framed
as project instructions. The branch's agent definition can reach the reviewer too, but it arrives
as a file the reviewer deliberately opened and knows is a subject; this one does not announce
itself. What keeps it from being authoritative is the review prompt, which spends a paragraph
saying it is the branch's proposal rather than a rule. A guarantee the layout enforces holds
whatever the model does; this one holds because the model is told. Anything that weakens that
paragraph weakens the separation.

Two kinds of PR still go green with no review behind them. Dependabot's, which the workflow skips
by design — that is what makes a green bump something the Developer can merge alone. And anything
from a fork, which is refused outright: `pull_request_target` runs with access to the repository's
secrets, so the job checks that the branch lives in this repository before it does anything. There
are no forks today; if one ever sends a pull request, it needs Fabian's eyes rather than a review.

**Reply first, then push.** Post the answer to a review round *before* pushing the commits that
address it. The push triggers the next review, and that reviewer reads the comments already on the
PR — so an answer that lands after the push arrives too late to inform it, and the same point comes
back.

**Rebase and squash before merging.** Shape the branch into the commits that make sense: several is
fine, but a commit that fixes something introduced earlier *in the same branch* belongs squashed
into the commit that introduced it, not kept as its own. **Do that once, at the end** — not on every
push. While the PR is under review a fix stays a commit of its own, so the next reviewer can see
what changed since the last round; `git commit --fixup` records where it will eventually land
without collapsing it now. A rebase that leaves the changeset identical does not trigger a fresh
review — so don't wait for one. Merge as soon as the builds are green.

**Commits are vertical slices, not layers.** Migration plus service plus controller plus UI for one
behaviour, in one commit. Never a commit that is only the database, or only the backend. Small
commits, each leaving the build green — small meaning one behaviour end to end, not one layer of
several.

**A commit message says *what* was implemented, not how.** The diff is the how, and it travels with
the message, so anyone who wants the detail reads it there. Spend the body on why the change exists
if that isn't obvious, and nothing on restating the changeset in prose.

**A pull request body is a brief, not a report.** It carries what the diff cannot say: why the
change exists and the decisions worth arguing about. Not the analysis that led there — the
measurements, the run ids, the account of what was tried. Keep it short enough that it cannot drift
away from the code, and do not rewrite it every round; it is not reviewed, and a body that has to
be maintained is already too long. The same brevity holds for an answer to a review: a line or two
per point saying what was done, or why it wasn't.

**Dependabot PRs are the Developer's job.** They update pins that deliberately don't move on their
own (`.github/dependabot.yml` explains why), and getting them merged is not Fabian's errand — sweep
them before starting the next backlog item, so an update never sits behind a feature branch. A green
bump merges — but green is the build's opinion, not a statement about the release, so a withdrawn or
retagged version is not something to take just because CI passed, and closing such a PR is a
legitimate outcome. A red one is usually the opposite case: the update found something real, and the
fix belongs in our code.

**Some npm updates are blocked on purpose, and nothing will remind you.** A peer range from one
package can hold another below its next minor or major; `.github/dependabot.yml` lists those and
says how the list is re-derived. An ignored update produces no pull request and no signal at all, so
the blocked bumps are owed work that is invisible until someone goes looking. Two things follow. The
Angular major upgrade carries a mandatory extra step — once the widened ranges land, bump the
ignored packages by hand in that same pull request. And the rule above inverts for that pull
request: it arrives red because of the ignore list, not because the update found something in our
code, so read the ERESOLVE before believing it.

TypeScript is the one that will not wait for the major. Angular's supported window is a single
minor wide and moves at Angular's own minors, so whenever the `angular-toolchain` group bumps
`@angular/build`, read its `typescript` peer range in the updated lockfile — if it moved, take the
TypeScript minor by hand in that same pull request. That is a cheap check on a path someone already
walks, and nothing else will raise it.

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

**A length limit belongs on the entity.** The MCP tools hand their arguments straight to the
domain, so a bound that lives only on a `Requests` record is not enforced for an assistant — the
value reaches the driver instead and comes back as a truncation error quoting the insert statement.
The entity holds the constant and the DTO's `@Size` constrains against it rather than against its
own copy of the number. The entity measures characters (`codePointCount`), not `String.length()` —
the columns are utf8mb4 and count an emoji as one where Java counts two. `@Size` cannot: it counts
UTF-16 code units, which is stricter than the column and so safe, but it means the entity is the
only layer actually measuring characters, and the entity is the one the MCP path reaches.

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

**A queued write's 4xx is discarded, not retried and not shown.** The outbox treats anything that
is not a connection failure as the server's settled answer and drops the entry — which is right
for the 404 of a task deleted meanwhile, and ruinous for a 400. So any limit the server enforces
on a field the capture form can send has to be enforced in the form as well, or the user is told
the task was saved and never sees it again. That is why the limits exist a third time in
`model.ts` and why `model.spec.ts` pins them against the checked-in contract. The form measures in
UTF-16 code units, because `@Size` does and `@Size` is what decides the 400.

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
- Java formatted by Spotless (Google style); TS/HTML by Prettier (100 cols, single quotes); ESLint
  with the `app` prefix.
- Angular: standalone components, signals, `OnPush`, logic in services rather than components.

**Comments are a last resort, and short when they are needed at all.** Needing prose to explain
what code does is a smell — the fix is almost always the code, not a paragraph above it. Write one
only for what the code genuinely cannot say: why a choice was made, or a constraint that isn't
visible from here.

Be most suspicious of the comment that pins a fact the next pull request will move — a version, a
range, a PR number, a hand-maintained list. It goes stale silently, nobody updates it, and from
then on it misleads. Prefer the durable rule and how to re-derive it over a snapshot of today's
answer; leave the evidence in the pull request, where it is dated and stays true.

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

When squashing a branch locally — the repository has squash merge turned off, so that is the only
kind there is — the prefix must describe the squashed whole.

A breaking change is a **`BREAKING CHANGE:`** footer — with a space, in its own paragraph in the
commit body. Both halves were verified against the analyzer: `BREAKING-CHANGE:` is recognised by the
conventional-commits preset but **not** by the angular one used here and produces no release at all,
and the same words in the subject line are just words, yielding a minor. It is enough that **one**
commit in the released range carries it — a merge commit included — and its type does not matter:
`chore:` with the footer is still a major.

The release builds the jar, builds and pushes the image, attaches the jar to a GitHub release, and
commits the next `-SNAPSHOT` version back to `main`.
