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
  Releases go out from `master` (not `main`). **The first release of the rewrite needs a
  `BREAKING CHANGE:` footer** — the old `0.x` tags are still reachable, so without one the version
  computes to `0.4.0`. See the README.
- **Small commits** that each leave the build green.
- Java formatted by Spotless (Google style); TS/HTML by Prettier (100 cols, single quotes); ESLint
  with the `app` prefix.
- Angular: standalone components, signals, `OnPush`, logic in services rather than components.
