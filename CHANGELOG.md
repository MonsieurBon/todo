## [2.3.1](https://github.com/MonsieurBon/todo/compare/v2.3.0...v2.3.1) (2026-09-22)


### Bug Fixes

* recover from an IdP outage at startup without a reload ([4745419](https://github.com/MonsieurBon/todo/commit/47454194b0a697d391902d2b0499f71539c01b53))

# [2.3.0](https://github.com/MonsieurBon/todo/compare/v2.2.0...v2.3.0) (2026-09-21)


### Features

* read task notes as markdown ([5d0862b](https://github.com/MonsieurBon/todo/commit/5d0862bb78971aa7bc7820aa86c727b9373fa050))

# [2.2.0](https://github.com/MonsieurBon/todo/compare/v2.1.6...v2.2.0) (2026-09-21)


### Features

* open a task in full from the board ([fa10268](https://github.com/MonsieurBon/todo/commit/fa1026859f463eb8266206b8811cf3cc8195088c))

## [2.1.6](https://github.com/MonsieurBon/todo/compare/v2.1.5...v2.1.6) (2026-09-21)


### Bug Fixes

* let the board editor clear a due date ([ba7710b](https://github.com/MonsieurBon/todo/commit/ba7710b9d088cfb19f7b13aabc577df74a8459d8))

## [2.1.5](https://github.com/MonsieurBon/todo/compare/v2.1.4...v2.1.5) (2026-09-21)


### Bug Fixes

* say when a write on the board failed ([92bbde6](https://github.com/MonsieurBon/todo/commit/92bbde66ec325b6e32a1d71517446c1eb7d6a10f))

## [2.1.4](https://github.com/MonsieurBon/todo/compare/v2.1.3...v2.1.4) (2026-09-21)


### Bug Fixes

* sign out throws away what the outbox still holds ([8dd6f77](https://github.com/MonsieurBon/todo/commit/8dd6f77be03397ad6ede6847e35e5a168eca1ca2))

## [2.1.3](https://github.com/MonsieurBon/todo/compare/v2.1.2...v2.1.3) (2026-09-21)


### Bug Fixes

* a session the IdP refuses signs in fresh instead of dead-ending ([3baccb5](https://github.com/MonsieurBon/todo/commit/3baccb548a1d17fdb43e312ec3cfed983e5500ea))

## [2.1.2](https://github.com/MonsieurBon/todo/compare/v2.1.1...v2.1.2) (2026-09-20)


### Bug Fixes

* a completed task is read-only until it is reopened ([c785ac1](https://github.com/MonsieurBon/todo/commit/c785ac1bd7516da57578781c269be63a370295d9))

## [2.1.1](https://github.com/MonsieurBon/todo/compare/v2.1.0...v2.1.1) (2026-09-19)


### Bug Fixes

* completing a task clears its deferral ([8afae72](https://github.com/MonsieurBon/todo/commit/8afae721c89ee0d37af992cefe06915c609f6fc7))

# [2.1.0](https://github.com/MonsieurBon/todo/compare/v2.0.2...v2.1.0) (2026-09-19)


### Bug Fixes

* **mcp:** flag every tool that is not purely additive as destructive ([8f4fda5](https://github.com/MonsieurBon/todo/commit/8f4fda5d3b53f226afa29a496355282cc2f7a5ab))


### Features

* **mcp:** create_task takes notes and a due date ([b4fd061](https://github.com/MonsieurBon/todo/commit/b4fd0617079cf5b4c6ccd03916f28198c0741df4))
* **mcp:** reopen_task undoes a completion ([e7bf54d](https://github.com/MonsieurBon/todo/commit/e7bf54d6df8ab02e7ac5f0ef8d8236ea982fa2cd))
* **mcp:** update_task edits a task's title, notes and due date ([e5c7d5b](https://github.com/MonsieurBon/todo/commit/e5c7d5be2ea1ffc17f8ff2d1c4ae78ad1e3f1f4f))

## [2.0.2](https://github.com/MonsieurBon/todo/compare/v2.0.1...v2.0.2) (2026-09-19)


### Bug Fixes

* point the MCP refusal at discovery on the canonical URI, not the request's origin ([fed6beb](https://github.com/MonsieurBon/todo/commit/fed6bebc4a8020c7e485f08162c69fdbc772d674))

## [2.0.1](https://github.com/MonsieurBon/todo/compare/v2.0.0...v2.0.1) (2026-09-18)


### Bug Fixes

* bring back the original app icon ([3a64057](https://github.com/MonsieurBon/todo/commit/3a64057d4b27a3a585fca13bc778dc7e2a1a98d8))

# [2.0.0](https://github.com/MonsieurBon/todo/compare/v1.0.2...v2.0.0) (2026-09-18)


### Features

* bind a token to one surface rather than a capability tier ([ee636bd](https://github.com/MonsieurBon/todo/commit/ee636bdf4bfe06923d1efa9130d9aff078993c1b))


### BREAKING CHANGES

* the todo:read, todo:write, todo:admin and todo:capture
scopes are gone and the capture-only client with them. An existing IdP must
be re-granted by hand; the README has the steps.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

## [1.0.2](https://github.com/MonsieurBon/todo/compare/v1.0.1...v1.0.2) (2026-09-15)


### Bug Fixes

* answer input the database would reject with a 400, not its statement ([ea91b41](https://github.com/MonsieurBon/todo/commit/ea91b413852609b1de499b5e7ef21cd4db2e4e1b))

## [1.0.1](https://github.com/MonsieurBon/todo/compare/v1.0.0...v1.0.1) (2026-09-06)


### Bug Fixes

* persist task edits instead of dropping them ([842acef](https://github.com/MonsieurBon/todo/commit/842acef149dcc9ead66ecbe25ab360c12f903396))

# 1.0.0 (2026-09-04)


### Bug Fixes

* generate the API types after every install, not only in build ([597b325](https://github.com/MonsieurBon/todo/commit/597b32521b7e5b9b2382334d122ccff7f96559f4))
* make the Keycloak healthcheck actually work ([46fed76](https://github.com/MonsieurBon/todo/commit/46fed765ff24e7dead7f3ccb76231d40acbb0594))
* show the inbox once, and refuse to delete it ([294eb9a](https://github.com/MonsieurBon/todo/commit/294eb9a9ff88c5ec778a2aebef06a5ee66ef67f8))
* stop dropping the notes and due date on a new task ([f1df17c](https://github.com/MonsieurBon/todo/commit/f1df17c15784e1fea2e3b74e19da58e048cf44d3))


### chore

* remove the legacy Symfony 4 / Angular 6 application ([565533d](https://github.com/MonsieurBon/todo/commit/565533dc0c363657cfe315ba384b8990acb67ce9))


### Features

* add labels and a board that spans every list ([39fc94f](https://github.com/MonsieurBon/todo/commit/39fc94f74b00db3282b952c5cbbe5afee00de7e6))
* add local development stack with MySQL and Keycloak ([bdf3809](https://github.com/MonsieurBon/todo/commit/bdf3809f05b864a7c0c86daaab2df98022817ff5))
* add the One Minute To-Do List domain model ([3121577](https://github.com/MonsieurBon/todo/commit/3121577f94b1d55b87dd17e4e638e6c5a17f2e0a))
* add the REST API for lists and tasks ([3813d3c](https://github.com/MonsieurBon/todo/commit/3813d3c821cc76e7b3cb28cacfe93f9db273a9b3))
* add the web app as an installable PWA ([994c5b2](https://github.com/MonsieurBon/todo/commit/994c5b2d71c532696d1bf2ae4759c4f0a1d1dd08))
* define the Keycloak realm declaratively ([58b87a0](https://github.com/MonsieurBon/todo/commit/58b87a0c12683ed0f3a41f1ea398d79cb2bfc6ef))
* expose the to-do list as MCP tools ([a3f569d](https://github.com/MonsieurBon/todo/commit/a3f569d36c20dae019868b6af6130b9545a450fa))
* make creating a task safe to replay ([da57999](https://github.com/MonsieurBon/todo/commit/da57999d2fd0b200beb4fdb631b1e910b59bc379))
* package the app as a container image ([d637654](https://github.com/MonsieurBon/todo/commit/d63765484e98c764f4a79128633238f36a322ebc))
* persist lists and tasks with Flyway and JPA ([0afd2d2](https://github.com/MonsieurBon/todo/commit/0afd2d2800114bc4fd042e8f7b4fa8bc298f7b97))
* report an unreachable identity provider as 503, not 500 ([a565487](https://github.com/MonsieurBon/todo/commit/a565487accd4c92ab5054e09905cdbf0c2c4d466))
* review the whole board, not one list at a time ([caa5b29](https://github.com/MonsieurBon/todo/commit/caa5b29b76390ec7736eef703740ce56555efb83))
* scaffold Spring Boot 4 app as an OAuth2 resource server with MCP ([8607c00](https://github.com/MonsieurBon/todo/commit/8607c00250b2c6aadd96b81ac770b136d32a7887))


### Performance Improvements

* stop paying 140 seconds of npm audit on every build ([167f6b5](https://github.com/MonsieurBon/todo/commit/167f6b5abc681a83e980bb2dca264bb5590d1fca))


### BREAKING CHANGES

* nothing from 0.x is preserved. The GraphQL endpoint is
replaced by a REST API and an MCP server, authentication moves to an
external OpenID Connect provider, and no data is migrated: existing tasks
and accounts do not carry over, and the old database is never read.
Deploying this over a 0.x installation requires an empty schema.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
