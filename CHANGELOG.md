# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Tests

* **tutorials:** cover the read-only UteamupTutorialList and UteamupTutorialGet tools, including JSON-RPC, authentication, service-unavailable, empty-result, and semantic-ID contracts

## [2.1.0-beta.9](https://github.com/UteamUP/uteamup-mcp/compare/2.0.0-beta.9...2.1.0-beta.9) (2026-07-03)


### Features

* **meter-reading-schedule:** add UteamupMeterscheduleCreateWorkorder tool with tests for work order creation ([29ea2ad](https://github.com/UteamUP/uteamup-mcp/commit/29ea2ad431b92f2299a87ce2ff547479d7d2e598))


### Bug Fixes

* **.gitignore:** refine temporary files pattern to match any name containing "tmp" ([94e4977](https://github.com/UteamUP/uteamup-mcp/commit/94e4977805065884f534512931178b6b57a61dcd))


### Miscellaneous

* **gitignore:** add exclusion for session log files ([82f6a2c](https://github.com/UteamUP/uteamup-mcp/commit/82f6a2ca84a5e4a3cc5bcabd0159b2bf5605b1e5))
* **session-log:** remove outdated session log for notification-pref MCP tests ([6686585](https://github.com/UteamUP/uteamup-mcp/commit/66865851c4da7d466556375bdf6834c9d3dec846))


### Documentation

* create session log for ChatGPT mobile MCP review findings ([c7d9ac6](https://github.com/UteamUP/uteamup-mcp/commit/c7d9ac6667c7315d9c3ce9bef87d89a7798b2cd0))


### Tests

* add reseller MCP tool tests ([8028cce](https://github.com/UteamUP/uteamup-mcp/commit/8028cce6df91c836c464b5cf053cb8d552ed6259))
* **asset-aggregated-documents:** add tests for UteamupAssetGetAggregatedDocuments tool ([3e3155c](https://github.com/UteamUP/uteamup-mcp/commit/3e3155c0462b85876120f8e31ecd9d47f68cacfa))
* **asset-duplicate:** add profile image field to asset read responses ([c7d9ac6](https://github.com/UteamUP/uteamup-mcp/commit/c7d9ac6667c7315d9c3ce9bef87d89a7798b2cd0))
* **asset-duplicate:** add tests for UteamupAssetDuplicate MCP tool ([f5de991](https://github.com/UteamUP/uteamup-mcp/commit/f5de9915ca0d0556f22a79618cc4e2780c6bc67d))
* **asset-edit-code-assignment:** add tests for UteamupAssetEditCodeAssignment MCP tool ([37b5ca2](https://github.com/UteamUP/uteamup-mcp/commit/37b5ca25245ab53572681191c61f09b1aee893a9))
* **billing:** cover the AI-credit packages MCP tool ([fe8d5f5](https://github.com/UteamUP/uteamup-mcp/commit/fe8d5f5c7e20e9f6ed7b5ce1d165e5a30ef6ed28))
* **bugs:** add Jest coverage for Bugs & Features WaitList status transitions ([5bd60ac](https://github.com/UteamUP/uteamup-mcp/commit/5bd60acfa35cc4f7cdfc0d3f08d1fadd4186be3d))
* **bugs:** add MCP coverage for the bug reporter conversation read tool ([0fd58d5](https://github.com/UteamUP/uteamup-mcp/commit/0fd58d57e2ef1f08fac0a1617edb2f8899a80e43))
* **bugs:** add tests for UteamupBugsAndFeaturesMine to verify caller's own reports ([dfbeebf](https://github.com/UteamUP/uteamup-mcp/commit/dfbeebf1ffb1f7a586dd879a7e1746a71ea0dcfc))
* **code-catalog:** add tests for UteamupCodingsystemMoveEntryByGuid MCP tool ([3d98d10](https://github.com/UteamUP/uteamup-mcp/commit/3d98d10c4f343df422e0c475dd2428601d7622f9))
* **codecatalog-move-entry:** include profile image fields in code-catalog read responses ([c7d9ac6](https://github.com/UteamUP/uteamup-mcp/commit/c7d9ac6667c7315d9c3ce9bef87d89a7798b2cd0))
* **knowledge-ai:** add tests for UteamupKnowledgeAiTranslate and UteamupKnowledgeAiGenerateFromText tools ([c5827d1](https://github.com/UteamUP/uteamup-mcp/commit/c5827d1dc2b52c1cb41a6e062632f70cba0d4ba8))
* **knowledge-entity-links:** add Jest tests for UteamupKnowledgeArticleGetLinked, LinkEntity, and UnlinkEntity tools ([14cc12b](https://github.com/UteamUP/uteamup-mcp/commit/14cc12b43689e1277fd29ea3bb02fcd2e3c2bfd9))
* **mcp:** cover UteamupNotificationPreferenceGet/Set tools ([185972a](https://github.com/UteamUP/uteamup-mcp/commit/185972a573671f6f9ff7c7eea09f1718d5d50a59))
* **mcp:** document findings and proof of production MCP functionality ([942f445](https://github.com/UteamUP/uteamup-mcp/commit/942f445b670da7bf0665f3bf8bf00729622a843a))
* **meter-reading-schedule:** add tests for UteamupMeterscheduleGetOpenWorkorders tool ([dc247c2](https://github.com/UteamUP/uteamup-mcp/commit/dc247c2c69ba1a721c010ee765d11ff25e367f7c))
* **meter-reading-schedule:** add tests for weekly and yearly schedule creation ([4af7e65](https://github.com/UteamUP/uteamup-mcp/commit/4af7e65dd444d62c5604a19b518c3e882a6192e0))
* **notification-pref:** add Jest tests for UteamupNotificationPreferenceGet/Set tools ([780049c](https://github.com/UteamUP/uteamup-mcp/commit/780049c808da97088bdd46f806da3cfb8a3d010a))
* **notification-pref:** add session log for Jest tests on new MCP tools ([14e7c8a](https://github.com/UteamUP/uteamup-mcp/commit/14e7c8a9c35fd4d23d2925fd7093ec2ca37477c9))
* **plans:** cover the 5 new plan-management MCP tools ([8c2cf79](https://github.com/UteamUP/uteamup-mcp/commit/8c2cf79e9f8a64678e0aef8a1194d5bc3497c747))
* **project:** cover UPMate estimate + apply MCP tools ([f4c5284](https://github.com/UteamUP/uteamup-mcp/commit/f4c5284c957cea4e1c7e1937bbdbdf2a6f45dfa7))
* **reseller:** add tests for new reseller tools in MCP ([e1df9e6](https://github.com/UteamUP/uteamup-mcp/commit/e1df9e6b0506166fca6b1a42c25f4806f4b43514))
* **reseller:** cover the application-meetings read tool ([2a9b633](https://github.com/UteamUP/uteamup-mcp/commit/2a9b633eb71b36767775b667eb9dce888139cf92))
* **reseller:** MCP Jest coverage for program-defaults read tool ([70d2736](https://github.com/UteamUP/uteamup-mcp/commit/70d2736e3d5f8c597057a5b22310cebe38d9cbfa))
* **responsible-owners:** add tests for UteamupAssetSetResponsibleOwners and UteamupCodecatalogSetResponsibleOwners tools ([30a47f6](https://github.com/UteamUP/uteamup-mcp/commit/30a47f6c4f87f9f75c52a2dde3184e0f814c9fca))
* **session-log:** remove outdated session log for ChatGPT mobile MCP review ([c00e704](https://github.com/UteamUP/uteamup-mcp/commit/c00e70407ef16304452b58566d5f79768d54bc26))
* **stock-enterprise-tools:** add tests for Stock enterprise MCP tools ([7c0ef24](https://github.com/UteamUP/uteamup-mcp/commit/7c0ef24e7b5b5da538c1da4ed7133d53c5e50262))
* **stock:** add MCP count-from-photo tool Jest test ([52d1285](https://github.com/UteamUP/uteamup-mcp/commit/52d12851f3101d1d93f91cd65f60b83935e6bddf))
* **wholesaler-tools:** add Jest tests for UteamupWholesaler tools including listing, retrieval, applications, and catalog ([087487d](https://github.com/UteamUP/uteamup-mcp/commit/087487de10d73874eb29c0dcc722ec6760be8b80))

## [2.0.0-beta.9](https://github.com/UteamUP/uteamup-mcp/compare/1.0.0-beta.9...2.0.0-beta.9) (2026-05-27)


### ⚠ BREAKING CHANGES

* **deps:** bump zod 3 -> 4 (mcp)
* **deps:** bump eslint 8 -> 10 (mcp)
* **deps:** bump jest 29 -> 30 (mcp)
* **deps:** bump pino 9 -> 10 + pino-pretty 12 -> 13 (mcp)
* **deps:** bump @types/node 20 -> 25 (mcp)

### Features

* add external GUIDs to mock data for MyProjects MCP tool tests ([476364d](https://github.com/UteamUP/uteamup-mcp/commit/476364de7956df3966aa4be3a6d5e5536866bc88))
* add full test coverage for Schedule and WorkforcePlanning MCP tools ([918cd1e](https://github.com/UteamUP/uteamup-mcp/commit/918cd1e350dd853bd46368fa310096bfe4894633))
* Add integration tests for schedule assignment MCP tools, covering week schedule, assignment creation, update, deletion, auto-assignment, and availability. ([21b8063](https://github.com/UteamUP/uteamup-mcp/commit/21b80632f1940e351450f58139f49248f635e8b1))
* add MCP tests for extension system and Customer Viewer tools ([8dce914](https://github.com/UteamUP/uteamup-mcp/commit/8dce914a6d0bc844fefeae5ab49f8f2bc7e20aae))
* add tests for Document metadata and timeline MCP tools ([6e66e74](https://github.com/UteamUP/uteamup-mcp/commit/6e66e745ff841c5d9fbb1b8381fc1e6d7f4afa8e))
* add tests for new Schedule AI / Workforce Planning MCP tools. ([7236780](https://github.com/UteamUP/uteamup-mcp/commit/723678005f324af0d50b5d31f520c932197cf758))
* add tests for UteamupAssetGetAssignedStock MCP tool ([fb0b7ac](https://github.com/UteamUP/uteamup-mcp/commit/fb0b7ac4fe1d7b9a62e633652bc5a26e6411a431))
* **dedicated-instance-integration:** add dedicated instance integration details and tool definitions ([f055003](https://github.com/UteamUP/uteamup-mcp/commit/f05500367ab24467cf2d5ea4b5a1a36cd0ffb425))
* **deps:** bump @types/node 20 -&gt; 25 (mcp) ([84ed199](https://github.com/UteamUP/uteamup-mcp/commit/84ed1990667a1ad35684f81af79a94b87a27a76d))
* **deps:** bump eslint 8 -&gt; 10 (mcp) ([aeb02c5](https://github.com/UteamUP/uteamup-mcp/commit/aeb02c570e731185b8da7fdcfbf0386eb429f7ee))
* **deps:** bump jest 29 -&gt; 30 (mcp) ([930a9e7](https://github.com/UteamUP/uteamup-mcp/commit/930a9e7bcf91bee40901e5517bac69d35ed97b70))
* **deps:** bump pino 9 -&gt; 10 + pino-pretty 12 -&gt; 13 (mcp) ([5628151](https://github.com/UteamUP/uteamup-mcp/commit/5628151c8ee75bc7c8e00635b392f731fbc44432))
* **deps:** bump zod 3 -&gt; 4 (mcp) ([cb88055](https://github.com/UteamUP/uteamup-mcp/commit/cb88055d6655a36fb6a465ecab0a93738f770ee7))
* implement OAuth 2.0 + PKCE and package structure for npm publishing ([d2224d4](https://github.com/UteamUP/uteamup-mcp/commit/d2224d47aab502e6b1868fce601efc6105123eff))
* Implement retry logic with exponential backoff and fixed delay ([b5452ae](https://github.com/UteamUP/uteamup-mcp/commit/b5452ae2826cc83177160862854ecde9f41758f7))
* **journal-code-linking:** Add MCP tests for journal-code linking tools ([6d33be6](https://github.com/UteamUP/uteamup-mcp/commit/6d33be66a408a24b7f4a370c76e4e1585d0e4063))
* **test:** add shared MCP test helper and error factory modules ([e77fd3c](https://github.com/UteamUP/uteamup-mcp/commit/e77fd3c1db45e0f1938636aa45bba86451aad23a))


### Bug Fixes

* **ci:** correct release-please-action SHA to v4.4.0 ([8004f04](https://github.com/UteamUP/uteamup-mcp/commit/8004f0414f6c4710bbee2648a70b15305df4450a))
* lint non-blocking, unit tests only ([db4d093](https://github.com/UteamUP/uteamup-mcp/commit/db4d093b94618e5e2a6e37a838485dd7c7acc4b0))
* make lint non-blocking ([90fbb74](https://github.com/UteamUP/uteamup-mcp/commit/90fbb745630559ff9b2651d11c7c0aeb43e8dde0))
* **security:** gate MCP TLS-verification bypass behind explicit opt-in (UTEAMUP-SEC-2026-05-02-008) ([43e3027](https://github.com/UteamUP/uteamup-mcp/commit/43e30276b9bf636ff7fe40cf7e73a6b314d42642))


### Miscellaneous

* add rules to ignore stale local backup files ([2adbe8c](https://github.com/UteamUP/uteamup-mcp/commit/2adbe8c2291fc0f1e222340fc3522c6fd14603c0))
* commit pending changes ([706e890](https://github.com/UteamUP/uteamup-mcp/commit/706e89022260959407349f795c326b499dd14cdc))
* **deps:** bump nock 13.5.6 -&gt; 14.0.15, jest 30.4.1 -&gt; 30.4.2, @types/node 25.6.2 -&gt; 25.7.0 ([da2a2b0](https://github.com/UteamUP/uteamup-mcp/commit/da2a2b09097ae405892e2d315564b3805084fc21))
* **deps:** update prettier to version 3.8.3 in devDependencies ([a876a10](https://github.com/UteamUP/uteamup-mcp/commit/a876a10a4372fd77bd7c7ffd337cb9820eb3242f))
* **release:** bump version to 1.0.0-beta.8 and include lib directory in package files ([b4871ea](https://github.com/UteamUP/uteamup-mcp/commit/b4871eae46777f13dbe48eb79e2d0facd5b304d0))
* **release:** bump version to 1.0.0-beta.9 and update logging configuration ([e3680e4](https://github.com/UteamUP/uteamup-mcp/commit/e3680e4efe2608fb8b388723f0732c96163ecb78))
* **release:** update to version 1.0.0-beta.6 with SSE response parsing and improved notification handling ([d8e1297](https://github.com/UteamUP/uteamup-mcp/commit/d8e1297e225c30be812be4a3119ed5416f0c2b74))
* remove backup index.js file ([d81c64e](https://github.com/UteamUP/uteamup-mcp/commit/d81c64ea69af2fd5b41c7e69ab1a499868d91377))


### Code Refactoring

* **test:** extract shared helpers from schedule test files ([12eb76a](https://github.com/UteamUP/uteamup-mcp/commit/12eb76a6f2d49591b7258eb3f178ac90f2dbfdfd))
* **test:** extract shared helpers from shift test files ([b65acfc](https://github.com/UteamUP/uteamup-mcp/commit/b65acfcf34cda550f7f1b128e9f66bb5eddb8ac2))
* **test:** extract shared helpers from workforce/tenant/labour test files ([e93ce79](https://github.com/UteamUP/uteamup-mcp/commit/e93ce791921cc2004aaca1b4b3f17fc0f5c593f1))


### Documentation

* add comprehensive README with installation, configuration, and troubleshooting ([24286e2](https://github.com/UteamUP/uteamup-mcp/commit/24286e2670d8384a9448e7cd49e3739d2c551d44))
* add links section with npm package, documentation, issues, and support information ([adce428](https://github.com/UteamUP/uteamup-mcp/commit/adce4282d79e5cd4a918017c2cdb08b0fcc3bdb9))
* add test deduplication design and implementation plan ([9ac6f25](https://github.com/UteamUP/uteamup-mcp/commit/9ac6f2581abc7310a653c8df312c8cab7f755814))
* note new tenant invite-defaults tools route via generic proxy ([c883417](https://github.com/UteamUP/uteamup-mcp/commit/c883417b1cc1e0208ffbddc88e45c2cd68bab3a5))
* update CHANGELOG with group members and assignment proxy tests ([440b70f](https://github.com/UteamUP/uteamup-mcp/commit/440b70f2c8f9b5bc7472c5c6f41e7c7d848d27e8))
* update CHANGELOG with labour rate MCP test coverage ([f96f9e6](https://github.com/UteamUP/uteamup-mcp/commit/f96f9e611873fb78fe61c5b516abeae6fedee748))
* update CHANGELOG with test deduplication work ([e7fe256](https://github.com/UteamUP/uteamup-mcp/commit/e7fe25641b297c6e8b5ea891a8abc94a2f666588))


### Tests

* add 36 MCP tool tests for maintenance analytics suite ([54cf92b](https://github.com/UteamUP/uteamup-mcp/commit/54cf92b3d48a44a9194d18ab8454dc3ee70b3f34))
* Add configuration validation tests ([b5452ae](https://github.com/UteamUP/uteamup-mcp/commit/b5452ae2826cc83177160862854ecde9f41758f7))
* add Jest suite for UserUiState MCP tools ([da1ce8f](https://github.com/UteamUP/uteamup-mcp/commit/da1ce8f94fd58018a1d5a3d7e569769bea725d1d))
* Add logger tests for sensitive data redaction ([b5452ae](https://github.com/UteamUP/uteamup-mcp/commit/b5452ae2826cc83177160862854ecde9f41758f7))
* add MCP proxy tests for group members and work order assignment tools ([b553b8d](https://github.com/UteamUP/uteamup-mcp/commit/b553b8da0a8a5d588652a5127e6db64409610b46))
* add MCP tests for labour rate modifier and effective-rate tools ([110cf40](https://github.com/UteamUP/uteamup-mcp/commit/110cf4007c3574993c9f6bfc6996ed2abf4bdcf5))
* add MCP tests for workforce group IconName field ([b521459](https://github.com/UteamUP/uteamup-mcp/commit/b521459645de1f0ad37339feba73329a7e6f5a84))
* Add retry logic tests ([b5452ae](https://github.com/UteamUP/uteamup-mcp/commit/b5452ae2826cc83177160862854ecde9f41758f7))
* add WorkorderWatcher MCP tool tests for JSON-RPC compliance and error handling ([92a37f3](https://github.com/UteamUP/uteamup-mcp/commit/92a37f36e747c22bc5e6d8816b9fbd854e7c30c0))
* **billing-gateway-switcher:** add tests for per-tenant billing-gateway switcher MCP tools ([4822e75](https://github.com/UteamUP/uteamup-mcp/commit/4822e7597f438f7891c7b8097cade59425b763bb))
* **billing-gateway-switcher:** fix 401/503 helper wiring ([68a8877](https://github.com/UteamUP/uteamup-mcp/commit/68a887714ac59ce48d01e264638f214b2f11bfca))
* **bugs-and-features:** add test for PerformanceAuto source filter in UteamupBugsAndFeaturesList tool ([ee10fa5](https://github.com/UteamUP/uteamup-mcp/commit/ee10fa530baff33d94190d94364d5aee5436f363))
* **bugsandfeatures:** add Jest tests for the 4 new MCP tools ([1ede0ef](https://github.com/UteamUP/uteamup-mcp/commit/1ede0efb972b179b91869670ad3641974cd48c52))
* **bugsandfeatures:** add test for UteamupBugsAndFeaturesDelete tool ([ba2daea](https://github.com/UteamUP/uteamup-mcp/commit/ba2daea0e4c5a6abb702866b13a8c11dc2a2403d))
* **changelog:** add tests for UteamupWorkorderQuickClose MCP tool ([e1def96](https://github.com/UteamUP/uteamup-mcp/commit/e1def9668f86aff4a7c6349467c9263103cd36ba))
* Create integration tests for OAuth flow and MCP request forwarding ([b5452ae](https://github.com/UteamUP/uteamup-mcp/commit/b5452ae2826cc83177160862854ecde9f41758f7))
* Create metrics tracking tests ([b5452ae](https://github.com/UteamUP/uteamup-mcp/commit/b5452ae2826cc83177160862854ecde9f41758f7))
* Create SSE parser tests ([b5452ae](https://github.com/UteamUP/uteamup-mcp/commit/b5452ae2826cc83177160862854ecde9f41758f7))
* **mcp:** add project_my_projects tool test and MCPGuidelines.md ([18484b2](https://github.com/UteamUP/uteamup-mcp/commit/18484b2b00d66e633816ea7e94faa269f9dc14a3))
* **mcp:** cover 5 new image/document import tools with 11 Jest tests ([16b475e](https://github.com/UteamUP/uteamup-mcp/commit/16b475ebd4685e97a5d2b79d1bd80edc88447bad))
* **meter-reading-schedule:** add comprehensive tests for Meter Reading Schedule MCP tools ([a3cdf88](https://github.com/UteamUP/uteamup-mcp/commit/a3cdf88b726e6e3f21f70177695b58dc069a6d84))
* **quick-close:** add tests for UteamupWorkorderQuickClose tool ([1329e9e](https://github.com/UteamUP/uteamup-mcp/commit/1329e9e7d4fab46fb909a92b90063d4a1df3bad2))
* **vendor:** add 113 MCP tool tests for vendor portal ([a2d7b86](https://github.com/UteamUP/uteamup-mcp/commit/a2d7b8693f4f3b1e702f0d007ece55aff1764130))
* **workorder-template:** jest spec for UteamupWorkorderTemplateRunScheduleNow ([5537a6e](https://github.com/UteamUP/uteamup-mcp/commit/5537a6e4225552ff4f2d5c1941cf39d29f57db4e))


### CI/CD

* add CI/CD ([2e34349](https://github.com/UteamUP/uteamup-mcp/commit/2e3434950f5a0e8ace3648be07a9377d112e7142))
* add CODEOWNERS ([3f7e48a](https://github.com/UteamUP/uteamup-mcp/commit/3f7e48a9b488c544525238be08c04670c273e94f))
* add Dependabot ([7c455ff](https://github.com/UteamUP/uteamup-mcp/commit/7c455ffc3011ef3baa71c441aad1c597eda213ff))
* add Release Please automated versioning ([7399e96](https://github.com/UteamUP/uteamup-mcp/commit/7399e9672953846312ec1907b7dfb36843379f10))

## [Unreleased]

### Changed

- **Bumped `nock` 13.5.6 → 14.0.15, `jest` 30.4.1 → 30.4.2, `@types/node` 25.6.2 → 25.7.0.** nock 14 swaps its HTTP-interception engine to `@mswjs/interceptors`, which schedules `replyWithError` via `setImmediate`. The `'handles network timeout gracefully'` test in `test/workorder-watchlist.test.js` was racing with the next test (`describeJsonRpcCompliance` for `UteamupWorkorderWatchlistGet`) — the stale `setImmediate(ETIMEDOUT)` from the timeout test fired during the JSON-RPC compliance test as an unhandled error (2/3 failure rate). Added an explicit `await new Promise(resolve => setImmediate(resolve))` at the end of the timeout test to drain pending interceptor callbacks before the next test starts. Test suite is green 5/5 back-to-back runs after the fix.

### Added

- **`UteamupMeterscheduleCreateWorkorder` tool** — force-create a work order from a meter reading schedule (proxied to the backend `POST /api/meter-reading-schedules/{guid}/create-workorder`), optionally seeded from a workorder template (`useScheduleTemplate` / `workorderTemplateGuid` args). Backend Command + Handler + Tool method added; Jest coverage in `test/meter-reading-schedule.test.js` (no-template / explicit-template / unknown-schedule / permission-denied + JSON-RPC 2.0 / 401 / 503 compliance) — 30 passing.

- **Performance Auto-Monitoring (MCP).** Documented `PerformanceAuto` as a valid source filter for the `bugs.list` tool proxy. Added test coverage in `test/` to assert the proxied request payload handles the `PerformanceAuto` source correctly.

### Added

- **Two new MCP tools forwarded through the generic proxy: `uteamup_tenant_invite_defaults_get` and `uteamup_tenant_invite_defaults_set`.** Backend-declared via `TenantTools.UteamupTenantInviteDefaultsGet` / `UteamupTenantInviteDefaultsSet` with matching `GetTenantInviteDefaultsCommand` + `UpdateTenantInviteDefaultsCommand` handlers. No MCP server code changes needed — the proxy forwards tool calls generically. Dedicated Jest spec + `describeJsonRpcCompliance`/`401`/`503` harness tracked as a follow-up.

- **Tests for the new `UteamupWorkorderQuickClose` MCP tool.** New file `test/quick-close.test.js` exercises the Quick Close tool over JSON-RPC 2.0 (nock-mocked HTTPS, mirrors the `bugs-and-features.test.js` pattern). 10 passing tests: happy path returning a created-and-closed workorder (`quickClosedAt` populated), idempotent replay returning the same workorder, optional `industryCodeGuid` + `performedAt` forwarded correctly, 403 (license / permission) / 422 (validation) / 429 (rate limit) / 404 (template gone / not quick-close) surfaced as RPC errors, plus the shared JSON-RPC 2.0 / 401 / 503 harness. No code changes to the MCP proxy itself needed — the tool is declared backend-side and forwarded generically.
- **Tests for 4 new `UteamupBugsAndFeatures*` MCP tools.** New file `test/bugs-and-features.test.js` exercises `UteamupBugsAndFeaturesCreate`, `UteamupBugsAndFeaturesGet`, `UteamupBugsAndFeaturesList`, and `UteamupBugsAndFeaturesUpdateStatus` over JSON-RPC 2.0 tools/call (nock-mocked HTTPS, mirrors the labour-rate / project-my-projects pattern). Covers happy-path create returning `status=New`, get by `externalGuid`, paginated list with filters, empty-list response, status transition New → Validated, plus the shared JSON-RPC compliance / 401 / 503 suites. No server-side code needed — the MCP proxy is generic and forwards tool calls to backend MediatR handlers added in the backend repo under the same conventional commit.
- **Tests for the 5 new image/document import MCP tools.** New file `test/document-import-tools.test.js` exercises `UteamupDocumentImportGetBatch`, `UteamupLogbookImportGet`, `UteamupDocumentReviewQueue`, `UteamupDocumentReviewAcknowledge`, and `UteamupAIUsageSummary` over the JSON-RPC tools/call transport (nock-mocked HTTPS, mirrors the labour-rate / project-my-projects pattern). Eleven passing tests cover the happy path for each tool, the `aiQuotaExhausted=true` flag in batch payloads, the SkippedQuotaExhausted enum value (5) on items, optional `batchId` filter on the review queue, optional `comment` on acknowledge, default-window AI usage summary, and the JSON-RPC error shape for backend 503 / cross-tenant 404 surfaces.
- `test/project-my-projects.test.js` — Jest coverage for the new `UteamupProjectMyProjects` MCP tool (proxies backend `GET /api/project/my-projects`). Covers happy path, empty list, `myWorkorderCount` shape, JSON-RPC error pass-through, and a regression guard asserting the tool accepts NO arguments (user identity must come from the Bearer token). Wires in the shared `describeJsonRpcCompliance`, `describe401Unauthorized`, and `describe503ServiceUnavailable` suites. 8 tests, all passing.
- `MCPGuidelines.md` — New top-level guide documenting the generic-proxy architecture, configuration, tool-addition workflow (backend-first — NEVER edit `index.js` for a specific tool), test structure and required coverage per new tool, Release Please versioning, critical regression zones, and security rules.
- `test/helpers/mcp-test-helpers.js` — Shared `callMcpTool`, `sendRawRequest`, `successReply`, `errorReply` utilities for all MCP tool tests
- `test/helpers/mcp-error-tests.js` — Reusable test factories: `describeJsonRpcCompliance`, `describe401Unauthorized`, `describe503ServiceUnavailable`
- 58 new error-handling tests from normalization (503 tests added to 4 files that lacked them; all 3 sections added to `labour-rate.test.js`)
- 8 MCP proxy tests for `UteamupWorkforceGetGroupMembers` and `UteamupWorkforceAssignWorkOrder` tools in `workforce-planning.test.js`
- 7 IconName field tests in `workforce-categories.test.js`: create with icon, create without (backwards-compat), update, clear, list returns, get by id returns, create request params

### Changed

- Extracted duplicated `callMcpTool` helper (~40 lines each) and error-handling describe blocks from 12 MCP tool test files into shared modules, reducing ~1,800 lines of duplication
- All 12 MCP tool test files now use shared helpers and standardized error test factories
- Test count: 714 → 772 tests (18 suites, all passing)
- **test/labour-rate.test.js** — 20 tests covering all 6 `LabourRateTools`: `UteamupLabourRateGetMyEffectiveRate` (including at= param), `UteamupLabourRateGetRules`, `UteamupLabourRateGetModifiers`, `UteamupLabourRateCreateModifier`, `UteamupLabourRateUpdateModifier`, `UteamupLabourRateDeleteModifier`. Tests cover success paths, validation errors (missing name, zero rateValue, invalid id), permission denial (LaborCost.All), and 401 unauthorized.
- **test/schedule.test.js** — 33 new tests covering all 3 `ScheduleTools`: `UteamupScheduleGetMySchedule`, `UteamupScheduleGetTeamSchedule`, `UteamupScheduleGetAvailableTechnicians`. Tests include success responses, empty results, invalid input errors, parameter capture, JSON-RPC 2.0 compliance, 401/503 handling, and permission denial.
- **test/schedule-ai-tools.test.js** — Added tests for 3 previously uncovered `WorkforcePlanningTools`: `UteamupWorkforceSuggestAssignment`, `UteamupWorkforceGetCapacity`, `UteamupWorkforceGetAvailableTechnicians`. Updated JSON-RPC compliance and 401 unauthorized suites to cover all 7 workforce tools.

### Changed

- Total test count increased from 70+ to 161 across 9 test suites (100% tool coverage for Schedule and WorkforcePlanning domains).

## [1.0.0-beta.7] - 2026-02-11

### Added

- **Structured Logging:** Production-ready logging with Pino
  - Log levels: TRACE, DEBUG, INFO, WARN, ERROR (configurable via `UTEAMUP_LOG_LEVEL`)
  - JSON and text output formats (configurable via `UTEAMUP_LOG_FORMAT`)
  - Automatic sensitive data redaction (credentials, tokens, secrets)
  - Pretty-printed logs in development, JSON logs in production
- **Configuration Validation:** Runtime validation with Zod
  - Strict validation of all environment variables
  - Clear error messages with actionable guidance
  - Type-safe configuration with schema enforcement
- **Performance Monitoring:** Built-in metrics tracking
  - OAuth flow duration and success rate
  - Request latency and success rate
  - Token cache hit/miss ratio
  - Automatic metrics summary on shutdown
- **Retry Logic:** Exponential backoff with jitter
  - Configurable max retries (`UTEAMUP_MAX_RETRIES`, default: 3)
  - Smart retry detection (network errors, timeouts, 5xx, 429)
  - Exponential backoff with jitter to prevent thundering herd
  - Request timeout support (`UTEAMUP_REQUEST_TIMEOUT`)
- **Request Tracing:** Unique request IDs for correlation
  - X-Request-ID header in all MCP requests
  - Full request/response logging at TRACE level
  - Request timing information
- **CLI Utilities:** Developer-friendly command-line tools
  - `--help` / `-h`: Show usage information
  - `--version` / `-v`: Print version
  - `--validate-config`: Validate environment variables
  - `--test-auth`: Test OAuth authentication flow
- **Test Suite:** Comprehensive test coverage (70 tests)
  - Unit tests for configuration, logging, metrics, retry logic
  - Integration tests with mock HTTP server
  - SSE parser tests
  - Error handling tests

### Changed

- Refactored codebase into modular structure (`lib/` directory)
  - `lib/logger.js`: Structured logging module
  - `lib/config.js`: Configuration validation module
  - `lib/metrics.js`: Performance monitoring module
  - `lib/retry.js`: Retry logic module
- Enhanced error messages with more context and actionable guidance
- Improved token refresh logic with configurable margin (`UTEAMUP_TOKEN_REFRESH_MARGIN`)
- Better backward compatibility with legacy `UTEAMUP_DEBUG` flag

### Dependencies

- **Added:** `pino` (^9.6.0) - Structured logging
- **Added:** `pino-pretty` (^12.0.0) - Pretty-printed logs for development
- **Added:** `zod` (^3.25.0) - Runtime type validation
- **Added (dev):** `nock` (^13.5.0) - HTTP mocking for tests
- **Added (dev):** `@types/node` (^20.11.0) - Node.js type definitions

### Improved

- Production-readiness: Meets industry standards for observability and reliability
- Developer experience: Better debugging with structured logs and CLI utilities
- Error recovery: Automatic retry on transient failures
- Security: Enhanced sensitive data redaction in logs

## [1.0.0-beta.6] - 2026-02-10

### Fixed

- **Notification Handling:** Properly handle JSON-RPC notifications with empty responses
  - Backend returns HTTP 202 (Accepted) with empty body for notifications
  - Proxy now skips sending response for notifications (id: undefined)
  - Fixes "Received a response for an unknown message ID" error
  - Notifications are now properly acknowledged without generating errors

## [1.0.0-beta.5] - 2026-02-10

### Fixed

- **CRITICAL:** Added Server-Sent Events (SSE) response parsing
  - Backend returns responses in `text/event-stream` format (SSE)
  - Proxy now correctly parses SSE format: extracts JSON from `data:` field
  - Fixes "Unexpected token 'e'" parse error in Cursor/Claude Code
  - Falls back to plain JSON parsing if response is not SSE format

## [1.0.0-beta.4] - 2026-02-10

### Fixed

- **NPM Package:** Fixed bin field path from `index.js` to `./index.js` for proper npm installation
- **Debug Logging:** Added comprehensive MCP response logging to help diagnose JSON-RPC format issues
  - Now logs raw response body
  - Now logs parsed JSON response
  - Now logs parse errors if they occur

## [1.0.0-beta.3] - 2026-02-10

### Fixed

- **CRITICAL:** Added `Accept: application/json, text/event-stream` header to MCP requests
  - Backend requires both content types for HTTP transport compatibility
  - Fixes HTTP 406 "Not Acceptable" error
  - Enables proper MCP endpoint communication

## [1.0.0-beta.2] - 2026-02-10

### Fixed

- **CRITICAL:** Token response parsing now accepts both `accessToken` (camelCase) and `access_token` (snake_case) formats
  - Backend returns `accessToken` but code only checked for `access_token`
  - This caused authentication to fail despite successful OAuth flow
  - Discovered via MCP Inspector testing

## [1.0.0-beta.1] - 2026-02-10

### Added

- Initial beta release
- OAuth 2.0 Authorization Code + PKCE authentication flow
- Automatic token caching with 7-day expiration
- Stdio transport for Claude Desktop/Code compatibility
- Support for self-signed certificates (development mode)
- Debug logging via `UTEAMUP_DEBUG` environment variable
- Graceful shutdown handling (SIGINT/SIGTERM)
- Comprehensive error messages for common authentication issues
- Configuration validation with helpful error messages
- JSDoc documentation for all public functions

### Fixed

- Token response parsing to use OAuth 2.0 standard `access_token` field (was incorrectly expecting `accessToken`)
- JSON-RPC 2.0 response format to always include request IDs
- Error handling for 401/403 HTTP status codes with user-friendly messages

### Security

- Single-use authorization codes enforced
- PKCE S256 challenge method (SHA-256)
- Token-only authentication (credentials never logged)
- Memory-only token storage (not persisted to disk)

## [Unreleased]

### Planned

- Automatic token refresh on expiration
- Configurable token cache location
- Additional error recovery strategies
- Rate limiting support
