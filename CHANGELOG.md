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
