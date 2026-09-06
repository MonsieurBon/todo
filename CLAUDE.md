# todo.ethy.ch

A One Minute To-Do List (Michael Linenberger's method): three urgency zones, soft caps, and a
review sweep. Spring Boot 4 + Angular 22 in one jar, with an MCP server so an assistant can work
the list by conversation.

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

- **TDD** — failing test first.
- **Conventional commits.** `feat:` and `fix:` are what semantic-release ships; an unprefixed
  commit is invisible to the release. When squashing, the prefix describes the squashed whole.
  **The first release of the rewrite needs a
  `BREAKING CHANGE:` footer** — the old `0.x` tags are still reachable, so without one the version
  computes to `0.4.0`. See the README.
- **Small commits** that each leave the build green — while the branch is under review. What
  lands on `main` is one commit per pull request; see Working agreement below for when the squash
  happens and whose call it is.
- Java formatted by Spotless (Google style); TS/HTML by Prettier (100 cols, single quotes); ESLint
  with the `app` prefix.
- Angular: standalone components, signals, `OnPush`, logic in services rather than components.

## Working agreement

Fabian is the product owner; the assistant is the developer.

**What** to build next is decided together. Propose, argue for a priority, disagree with one —
that part is a conversation, not a queue to work through.

**How** to build it is the developer's call, and does not need asking: the implementation
approach, how many commits it takes, and what goes together in a pull request.

Two obligations come with that:

- **Keep pull requests small, and work them one at a time.** A small PR is easier to review,
  easier to address feedback on, and merges sooner. But small does not mean parallel: open one,
  drive it to merged, then start the next. Several open at once means switching branches between
  review rounds, and that is where the mistakes come from rather than from the thinking.

  Two real errors came from exactly that: a refactor applied on the wrong branch, where the
  method it was meant to fix did not exist, so the merge silently restored the old call while the
  commit message claimed otherwise; and #10 closed unrecoverably when merging its parent deleted
  the branch it was based on.

  If work does have to stack, retarget the child onto `main` *before* the parent merges — a PR
  whose base branch is gone can be neither reopened nor retargeted, only raised again.
- **Leave the history clean — at the end.** While a PR is in review, fix-ups stay as their own
  commits: the reviewer needs to see what actually changed in response to them. Squash only once
  the reviews are clean and the build is green, just before merging. Intermediate PRs that turned
  out to be one thing get folded together the same way. The history should record what changed,
  not the conversation that got it there.

  So the **Small commits** rule above governs a branch under review; what lands on `main` is one
  commit per pull request. And the squashed subject takes the prefix of the whole, per
  Conventions — a `feat:` folded under a `docs:` subject ships nothing at all, because
  semantic-release reads only what landed.

  **Check the review gate before squashing, not after.** The squash writes a new commit with a
  byte-identical diff, so the workflow's diff-hash cache skips the pass and posts nothing — and
  the newest review then necessarily predates `HEAD`, which the check below reads as stale. Verify
  while `HEAD` is still the commit the review was posted against, then squash and merge.

  GitHub squash merges are **disabled** on this repository, so the squash happens locally before
  merging and the PR goes in with *Rebase*. That is not a restriction to work around: it is what
  makes the subject line that reaches `main` one you wrote deliberately, rather than one GitHub
  assembled out of every commit on the branch.

Every PR is reviewed by the agents in `.github/workflows/claude-code-review.yml` — a code
reviewer and a security reviewer — and the review is addressed before it merges. That gate is
what backstops the autonomy above, so it is not optional; the developer may merge once every
finding from both reviewers is **addressed** and the build is green, without waiting to be told.
Addressed, not clean: a finding closed by a reasoned reply produces no push, so no re-review runs
and the last posted review still carries it. Waiting for a literally clean review would force a
no-op commit to clear a finding that was correctly argued. Fabian reviews when he wants to, which
is a different thing from the gate.

**A green check is not proof the review ran.** Three ways to reach green with no review:

- the security pass is `required: false`, so a crash posts a notice and keeps the job green;
- a PR editing the review workflow is declined by the action, which also posts a notice;
- a Dependabot PR skips the job outright on the `if:` at the top of the workflow — **no notice,
  nothing to read**.

The first is not hypothetical: the security pass fell over on #11 and reported nothing but a green
tick. The code pass fell over on the same run and went red — `required: true` is the whole
difference, which is what #17 is about.

Before merging, confirm a `## web-security-reviewer` comment exists *for the current diff* —
diff-identical counts, since the workflow caches on a diff hash and skips a pass whose diff it has
already reviewed, which is exactly what a squash before merging produces. A diff that *changed*
and has no new comment does not count. If there is none, read the notice rather than the check.

Check the comment's **author**, not just its heading, and check it through the API. This
repository is public, so anyone can post a comment that begins `## web-security-reviewer`, and on
a fork PR the workflow has no token to post a real one — so the forged review would be the only
one there. `gh pr view --comments` cannot tell them apart: it prints the bot's login as `claude`,
dropping the `[bot]` suffix, and gives it the same `association: none` an outside contributor
gets. The REST API keeps both:

```bash
gh api --paginate repos/MonsieurBon/todo/issues/<n>/comments \
  --jq '.[] | select(.user.login == "claude[bot]")
            | select(.body | startswith("## web-security-reviewer"))
            | .created_at' | tail -1
TZ=UTC0 git show -s --format=%cd --date=iso-strict-local HEAD   # UTC too, so the strings compare
```

Three things that command is careful about, each of which fails *open* if dropped:

- `--paginate`. Without it `gh api` fetches one page, and `/issues/{n}/comments` defaults to 30,
  oldest first. Past that the command stops returning the newest review and starts returning the
  earliest — a real, bot-authored review of an early diff, presented as proof for the current one.
- `.user.login == "claude[bot]"` rather than `.user.type == "Bot"`, which any app with
  `pull-requests: write` satisfies — which is what the review workflow itself is granted. Identity
  is the point.
- `created_at` against the head commit, in the same zone. Every matching comment on the PR looks
  alike otherwise, including one written several force-pushes ago. It must be
  `--date=iso-strict-local`: plain `iso-strict` keeps the commit's own offset and ignores `TZ`, so
  the two strings look hours apart when they are seconds apart.

What it deliberately does **not** prove is which workflow wrote the comment. `claude.yml` runs the
same app on `@claude` mentions, and nothing on an issue comment names the workflow behind it, so
someone with write access could make `claude[bot]` post a passing review — either deliberately, or
by invoking `@claude` on content they did not write, whose injected instructions steer the opening
line. That is accepted rather than solved: both routes need write access, and anyone holding it can
merge without the gate anyway, so checking harder buys nothing against the only actor who could
reach it. #17 is the fix for both. The check guards against a
stale or forged-by-an-outsider review, not against the maintainer. #17 removes the need for it
entirely if the security pass becomes `required: true`.

The third has no notice by construction, so the rule above has no answer there and a dependency
bump is reviewed by whoever merges it. That is the class where the diff *is* the security content
— a bumped transitive dependency, a changed lockfile resolution, a CVE arriving rather than
leaving — so read it rather than trusting the absence of a complaint. #17 tracks fixing this in
CI.

The gate is what makes an argued finding safe, so it has to actually close: a finding that
demonstrates a defect — security or correctness — and is in scope gets fixed before merge, not
answered. Opinions and design disagreements are what a reasoned reply is for; a cap counted per
list, an unsafe operation queued for offline replay, or a write that answers 200 and persists
nothing is not an opinion.

**Comment first, then push:** the push is what triggers the re-review, so a reply written
beforehand is context the re-reviewer actually sees — and a finding you argued rather than
changed does not simply come back.

Addressed does not mean obeyed. A finding can be answered with a reasoned reply instead of a
change, and something real but out of scope belongs in a tracked issue rather than smuggled into
the PR under review — cite that issue's number in the reply, or the next pass cannot tell deferred
from ignored and raises it again.
