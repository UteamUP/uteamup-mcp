# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.1-beta.9](https://github.com/UteamUP/uteamup-mcp/compare/2.2.0-beta.9...2.2.1-beta.9) (2026-09-30)


### Tests

* add asset rental lifecycle MCP transport tests ([8ecce95](https://github.com/UteamUP/uteamup-mcp/commit/8ecce950df21eb31e5ba5202483c3243bc5de719))
* add coverage for private requirement draft editing in MCP tools ([865686c](https://github.com/UteamUP/uteamup-mcp/commit/865686c86ecb9e3a201f0957f88aa0e7e140149a))
* add coverage for publishing reviewed revision conflict in requirement draft ([c8d9589](https://github.com/UteamUP/uteamup-mcp/commit/c8d9589b34039120a218a9609a3b7b3fd23baf6e))
* add Teams integration MCP tools tests ([8d129b8](https://github.com/UteamUP/uteamup-mcp/commit/8d129b8b27568b09e546ba25683eacbf493b0665))
* align effective labour rate fixtures with nullable pricing contract ([3e110f8](https://github.com/UteamUP/uteamup-mcp/commit/3e110f874b151c164694ed0c86b313e78b8346c2))
* align marketplace request proxy pagination contracts ([7c328ec](https://github.com/UteamUP/uteamup-mcp/commit/7c328ec26d01be67a62a6636dcd149643a1bfc8e))
* **asset-dependency:** add test for forwarding independent AND/OR conditions without reshaping asset GUIDs ([fda8e97](https://github.com/UteamUP/uteamup-mcp/commit/fda8e97e493ff5d444d870fa10b010594eff066b))
* **asset-failure:** cover the incident evidence pack MCP read ([383239e](https://github.com/UteamUP/uteamup-mcp/commit/383239e73e096664027f636303f239b1988716ed))
* **asset-group:** cover document draft tools ([6946de7](https://github.com/UteamUP/uteamup-mcp/commit/6946de79134ca618055153aba3c5758dab2eb215))
* **asset-state:** cover the asset state tools ([f80c792](https://github.com/UteamUP/uteamup-mcp/commit/f80c792c1f8cc31433df1e3f5917335981029105))
* **asset-update:** add tests for UteamupAssetUpdate MCP tool functionality ([d91bb57](https://github.com/UteamUP/uteamup-mcp/commit/d91bb57e9eb2d7ef258cb079737eecb3ad6436ad))
* **asset:** mirror the SDK's tool-error shape for coded asset refusals ([40ea632](https://github.com/UteamUP/uteamup-mcp/commit/40ea63241cebb39aa3a63d2c9303803d84ca6f92))
* automation runtime tool pass-through and compliance suites ([a6e9fa4](https://github.com/UteamUP/uteamup-mcp/commit/a6e9fa413e2d707f1d33a234872a7950fdda921e))
* **automation:** assert the mocked replies pass through the seven new tools ([529b8cc](https://github.com/UteamUP/uteamup-mcp/commit/529b8cc76fb79b367a1c308754009a8719927de9))
* **automation:** cover the workflow, approval and UPMate agent tools ([bc86220](https://github.com/UteamUP/uteamup-mcp/commit/bc86220b471f84e35380be509c71f05a6b79eeb3))
* **automation:** match the escaped draft graph in the proxied reply ([ff994cc](https://github.com/UteamUP/uteamup-mcp/commit/ff994cc4c34c100d4bc53fb9239059d5febed1cf))
* **bugs-and-features:** update tests for feature requests and adjust package dependencies ([0e20a90](https://github.com/UteamUP/uteamup-mcp/commit/0e20a90ade29e5da87d2fdf2a9b1de6c90c53e6c))
* **ci:** assert the js-yaml security floor by intent, not override shape ([8276657](https://github.com/UteamUP/uteamup-mcp/commit/8276657d1481ad1485b8e3a52f7696fd43b8b8f1))
* **codecatalog:** cover the create-code-by-path tool ([7810315](https://github.com/UteamUP/uteamup-mcp/commit/7810315880bd38877084df1cab70056549da5473))
* **contact-type:** add tests for contact type CRUD operations and validation ([c70670d](https://github.com/UteamUP/uteamup-mcp/commit/c70670d06a50c754f5cfae4efa79fa4cafa031fb))
* **conversation:** cover the reaction-toggle tool end to end ([24319ad](https://github.com/UteamUP/uteamup-mcp/commit/24319adbef8c622822fa540acb9bdcc537afe5a4))
* cover booking service type lookup through MCP proxy ([1f7dc30](https://github.com/UteamUP/uteamup-mcp/commit/1f7dc30e912bdee4ecb2b285094d3e3f4cf11970))
* cover complete pool definitions through MCP ([22ad9c3](https://github.com/UteamUP/uteamup-mcp/commit/22ad9c3f217feaee7acb835aaf350784507baf60))
* cover cross-subject dossier contracts ([f9f1e34](https://github.com/UteamUP/uteamup-mcp/commit/f9f1e34b394657b8b966e5919d4127627d53cede))
* cover direct deliverable cost plan proxy contract ([f324f0f](https://github.com/UteamUP/uteamup-mcp/commit/f324f0fa356ee397d8d5aef8f424392f4d38ef22))
* cover exact document review tool contracts ([aaf368f](https://github.com/UteamUP/uteamup-mcp/commit/aaf368fee50765b973172b64ad909049305a502c))
* cover exact resource source lookup through MCP ([4315070](https://github.com/UteamUP/uteamup-mcp/commit/43150705f4aabfedbf628985aa98112bc8ee95c4))
* cover field check MCP proxy contracts ([f0ae584](https://github.com/UteamUP/uteamup-mcp/commit/f0ae584856d680540a68b47ee7370842d611a9d5))
* cover handover creation options through MCP proxy ([9ff29e4](https://github.com/UteamUP/uteamup-mcp/commit/9ff29e49f4aba05de0c5171db8d9cbeb8baa01bc))
* cover lifecycle workspace MCP proxy ([ecf515c](https://github.com/UteamUP/uteamup-mcp/commit/ecf515c16288e8f40d486a64c9e574a9f8a5e0f5))
* cover native Business Central stock tool contracts ([d5ffda1](https://github.com/UteamUP/uteamup-mcp/commit/d5ffda1a69a1aaedd08ab29dd6e363b32148fbf2))
* cover NCR MCP proxy contracts ([9b623be](https://github.com/UteamUP/uteamup-mcp/commit/9b623be635a7739466e99e3d5163d16d6595ee54))
* cover on-call replacement lookup transport ([345a0a6](https://github.com/UteamUP/uteamup-mcp/commit/345a0a6eaaef855cf64f808166661b5087cadf35))
* cover paged on-call decision history proxy ([ca65dc8](https://github.com/UteamUP/uteamup-mcp/commit/ca65dc8bc883ce6052c409b872fc8ceea251f78a))
* cover paginated timesheet MCP responses and filters ([df00eb4](https://github.com/UteamUP/uteamup-mcp/commit/df00eb4da1208b519711dbb4b669144c67aeae7b))
* cover project baseline snapshot proxy contract ([e136e87](https://github.com/UteamUP/uteamup-mcp/commit/e136e8709b830c373cdaeb1618c03c83856ab99d))
* cover project cost evidence through MCP ([6a7f744](https://github.com/UteamUP/uteamup-mcp/commit/6a7f744b81bb0d5bef9314fc714e8f8c1aaa6b89))
* cover project portfolio filter forwarding ([5700b5a](https://github.com/UteamUP/uteamup-mcp/commit/5700b5a59339b5d5a94556227cede1afbd00c0d4))
* cover project reservation read tool transport ([58dc80e](https://github.com/UteamUP/uteamup-mcp/commit/58dc80eecf4f39cb9a3cfd1429d460109d0207fa))
* cover public actor GUIDs in handover MCP responses ([61923c8](https://github.com/UteamUP/uteamup-mcp/commit/61923c820a949ac750f661215e202f81a64cebd4))
* cover radio license management tools ([8ae44ab](https://github.com/UteamUP/uteamup-mcp/commit/8ae44abd9f341a692475c7ff598ea55b044a1464))
* cover radio MCP administration and history contracts ([6d87036](https://github.com/UteamUP/uteamup-mcp/commit/6d87036a27c13b5b4b576177258857e27265ab4d))
* cover radio pilot lifecycle tool authorization ([e441e1b](https://github.com/UteamUP/uteamup-mcp/commit/e441e1b038d495286cb5c8e1133b500e5af02542))
* cover Radio SharePoint availability proxy ([d4ff24f](https://github.com/UteamUP/uteamup-mcp/commit/d4ff24fcf19e2baad043390fb1526d3d44eb9ca3))
* cover Radio validation through the MCP proxy ([c678a4c](https://github.com/UteamUP/uteamup-mcp/commit/c678a4c541c0817205a42d8061cac8d3c259989d))
* cover read-only connector radio tools ([a578a6e](https://github.com/UteamUP/uteamup-mcp/commit/a578a6ea6bdf95ab42f75e197a260f1643e72979))
* cover receipt units and starting pending stock counts ([49258fb](https://github.com/UteamUP/uteamup-mcp/commit/49258fb0c38d32994ef7d8aa2c023c04ee4b5736))
* cover rental lifecycle and readiness MCP evidence contracts ([00a108f](https://github.com/UteamUP/uteamup-mcp/commit/00a108ff025492efcb961cb7b194ad373dd77623))
* cover resource pool member type search filtering ([aaa57a5](https://github.com/UteamUP/uteamup-mcp/commit/aaa57a593d17a6ca79303a5d6d90fe585fc8a99b))
* cover resource source lookup transport ([d9134c5](https://github.com/UteamUP/uteamup-mcp/commit/d9134c5e3eb8cb2937b51da1a9878522f8d40c2c))
* cover retained radio transmission tool ([0325794](https://github.com/UteamUP/uteamup-mcp/commit/03257949db191673117a087e3cefd293ef065f97))
* cover retained radio transmission transcript tools ([41f3523](https://github.com/UteamUP/uteamup-mcp/commit/41f3523df9c3c9ef1ad256ec3935b861a159a23e))
* cover reviewed project schedule tool contracts ([d9b9ab1](https://github.com/UteamUP/uteamup-mcp/commit/d9b9ab19f8f196788bceca2c991a832be7c234c8))
* cover reviewed project scope commands and reference tools ([ac45164](https://github.com/UteamUP/uteamup-mcp/commit/ac4516431ea2b7a0cd42a68877e7300bc0ce18de))
* cover reviewed project scope tool transport ([3fa385e](https://github.com/UteamUP/uteamup-mcp/commit/3fa385e0eadb347e33b19c86869fe5fa80502e76))
* cover reviewed version in resource pool member requests ([18762af](https://github.com/UteamUP/uteamup-mcp/commit/18762af87bbaed4c2e5b24503ec17bf32281b19b))
* cover tenant crew lookup through the MCP proxy ([3e8495e](https://github.com/UteamUP/uteamup-mcp/commit/3e8495ed31b112e4d8e51d203b930d5ca3efad81))
* cover transport MCP lifecycle and conflict contracts ([f461f56](https://github.com/UteamUP/uteamup-mcp/commit/f461f5677af45e9273d80f47d8e3796bfd35473f))
* cover versioned handover draft update contracts ([5721be6](https://github.com/UteamUP/uteamup-mcp/commit/5721be6656a1ed54dba12356dc14bf7ab8e16231))
* cover work-order project scope replay contracts ([54722f3](https://github.com/UteamUP/uteamup-mcp/commit/54722f3a009775ce664e50af03e7b8ebf3bb32a0))
* cover workforce MCP self-service tool contracts ([4e50196](https://github.com/UteamUP/uteamup-mcp/commit/4e50196a316004ad40827e798997638f9b307358))
* distance-tax and statutory meter-ledger tool suites ([f184f1c](https://github.com/UteamUP/uteamup-mcp/commit/f184f1c7b2875575642d7f3d6912a08b624ec500))
* **dossier:** the subject pair survives the proxy hop ([61459b5](https://github.com/UteamUP/uteamup-mcp/commit/61459b552578ede095339ad25352b8e7a87d20f9))
* enhance UteamupMarketplaceMyOffersList tool tests with pagination and status filtering ([98ebecd](https://github.com/UteamUP/uteamup-mcp/commit/98ebecdbd5b9a7b0eace83407a819186cabd1552))
* **farm:** cover MCP farm unit reads ([3dff45e](https://github.com/UteamUP/uteamup-mcp/commit/3dff45e6fad7532454e475664d348715476f5623))
* forward resource creation retry keys through MCP ([69069f4](https://github.com/UteamUP/uteamup-mcp/commit/69069f4df3fd837b5bf73d771351447e41f998d1))
* **industry-coding:** cover document profile proposal proxy ([10fd475](https://github.com/UteamUP/uteamup-mcp/commit/10fd47548f632d5994b1acb15921633ccd4a67bd))
* **industry-coding:** cover the tenant designation format tool ([40ee080](https://github.com/UteamUP/uteamup-mcp/commit/40ee080d4c0be674ecee1c8a0c0dd420cfe44f83))
* **itmanagement:** add connections quota reporting test ([89389b2](https://github.com/UteamUP/uteamup-mcp/commit/89389b2d7166ba0c886b8f11614a726985bcf6f2))
* **itmanagement:** add monitored subscriptions and access checks to connection status ([1661da2](https://github.com/UteamUP/uteamup-mcp/commit/1661da27f21f77723c5fe398501b91e1e283e24e))
* **itmanagement:** count every enabled capability in the UPMate matrix ([7ca1408](https://github.com/UteamUP/uteamup-mcp/commit/7ca1408305cac06d6748d30f267c39a2f6169c03))
* **itmanagement:** cover the activity log tool ([d299cc8](https://github.com/UteamUP/uteamup-mcp/commit/d299cc89de60c0db982cb9b113065bd356a588a4))
* **itmanagement:** cover the resource-children and asset-proposal tools ([ffbf79a](https://github.com/UteamUP/uteamup-mcp/commit/ffbf79a8c68520dfbaf17e280b80f228c269da59))
* **itmanagement:** MCP contract tests for the IT Management tools ([36d1335](https://github.com/UteamUP/uteamup-mcp/commit/36d13358da9dd903657c512195f014d752545762))
* match the explicit reconciliation enum serializer ([70e17a2](https://github.com/UteamUP/uteamup-mcp/commit/70e17a25d6cde7e4c10ce78efcc2462d4c285943))
* **mcp:** add maintenance revision forwarding and stale review rejection ([75f45c0](https://github.com/UteamUP/uteamup-mcp/commit/75f45c0310b4b4136e9474e51bd2df3063c6e3c7))
* **mcp:** cover completion report args and report analytics tools ([dcc164b](https://github.com/UteamUP/uteamup-mcp/commit/dcc164b8701cc8975b6ab1eb8c5e093fc1b66c77))
* **mcp:** cover report template and schedule tools ([02acad3](https://github.com/UteamUP/uteamup-mcp/commit/02acad3b8dedfc44b15b64adf771e0ebb000101e))
* **mcp:** cover the asset group, dependency, dossier and share tools ([f8ca283](https://github.com/UteamUP/uteamup-mcp/commit/f8ca28318bc288ef0344689704448ab79ef00bab))
* **mcp:** cover the UteamupBiosecurityStatus proxy tool ([2b43521](https://github.com/UteamUP/uteamup-mcp/commit/2b4352149b60042e3547f53f6529032043319b5e))
* **mcp:** cover UteamupAssetPatch ([6d6f139](https://github.com/UteamUP/uteamup-mcp/commit/6d6f139dd7c70d9edc295d095bdb74ff8000a693))
* **mcp:** cover work report output, share summary and completion failure tools ([617e522](https://github.com/UteamUP/uteamup-mcp/commit/617e5223953647589801e5bf0da20b2581fdff8d))
* **mcp:** cover work report tools through the proxy ([757fef0](https://github.com/UteamUP/uteamup-mcp/commit/757fef0c1e5fade9a53fa3f223a94c56d36d2e28))
* mirror labour modifier GUID references in MCP fixtures ([b14e93e](https://github.com/UteamUP/uteamup-mcp/commit/b14e93e0d04452bce78fe0a1d1478a867c41c759))
* preserve exact holiday versions in project schedule tools ([4e546e8](https://github.com/UteamUP/uteamup-mcp/commit/4e546e870a6386727a632d8469ca9f777890e591))
* preserve exact project gate reviews through MCP ([231f9c0](https://github.com/UteamUP/uteamup-mcp/commit/231f9c09dc636843b4579c0bfaaf1af5b423e887))
* preserve exact stock source filter through MCP ([bfb7271](https://github.com/UteamUP/uteamup-mcp/commit/bfb7271e059bba384884f657b13ee79e829673dd))
* preserve owning project work-order scope contracts ([d109621](https://github.com/UteamUP/uteamup-mcp/commit/d109621406d715020e12a86a35dd1f70822da5b7))
* preserve project cost creation retry receipts ([4e9a8e5](https://github.com/UteamUP/uteamup-mcp/commit/4e9a8e578b3cce106362fc14fd45e004d7c6b715))
* preserve resource update retry keys through MCP ([b114f17](https://github.com/UteamUP/uteamup-mcp/commit/b114f1705e32e9a668e2c61548d47cff4a41b0bd))
* **project-share:** proxy contract tests for the project share tools ([e8bc397](https://github.com/UteamUP/uteamup-mcp/commit/e8bc3974420cdf544928521a3e9d9470a2114d87))
* **project-share:** withhold baselines in the default grid fixture ([fd623b8](https://github.com/UteamUP/uteamup-mcp/commit/fd623b809030d5f3da637bfe081cb12121771fa0))
* **project-timeline:** add tests for project timeline and workflow contracts ([863765a](https://github.com/UteamUP/uteamup-mcp/commit/863765aeed701e6037ecc74b268acdd3b1492666))
* **project:** cover the project template MCP tools ([860ce3e](https://github.com/UteamUP/uteamup-mcp/commit/860ce3eb8f18f38af51f1eaf93304468d70f1f54))
* **quality:** add audit finding MCP proxy contracts ([71474ee](https://github.com/UteamUP/uteamup-mcp/commit/71474ee7c7408d67aa47091993dc37460e08a788))
* **quality:** add CAPA MCP proxy contracts ([96c729a](https://github.com/UteamUP/uteamup-mcp/commit/96c729a6260646ec12594a3cf817d21913c541dd))
* **quality:** align CAPA proxy consequences ([30f2cc6](https://github.com/UteamUP/uteamup-mcp/commit/30f2cc64e41546ea57405d46933f95537b5abe32))
* **quality:** cover audit programme MCP proxy ([86d40e9](https://github.com/UteamUP/uteamup-mcp/commit/86d40e96fb659c581bf0b82aa72b68e26e675c0a))
* **quality:** cover main audit MCP proxy ([a77a8bf](https://github.com/UteamUP/uteamup-mcp/commit/a77a8bfd6bece53cb52b9ea06a4ee02defbea96b))
* **quality:** generic-proxy contracts for the quality workflow-policy tools ([68cae9c](https://github.com/UteamUP/uteamup-mcp/commit/68cae9ced272eb685ecd7abe2cf89fd1f541a3b1))
* **quality:** proxy contracts for the ITP, ITP execution and SCAR tools (T2.14) ([b857a66](https://github.com/UteamUP/uteamup-mcp/commit/b857a6698fc6306aba048645c4221aeb084503f8))
* retain legacy odometer handover contract coverage ([b13a4ff](https://github.com/UteamUP/uteamup-mcp/commit/b13a4ffe2d439960089338748fabbe5ec45f0314))
* retain project booking reviews and replay receipts in MCP ([d11ae7a](https://github.com/UteamUP/uteamup-mcp/commit/d11ae7a86a91be26fd577f42d09a54e94aa78f06))
* retain reviewed project process proxy contracts ([cfabeb1](https://github.com/UteamUP/uteamup-mcp/commit/cfabeb1d0e12c1ff868ed15c02ee457c7bd97933))
* **safety:** jest coverage for the legal and emergency-contact tools ([47dc499](https://github.com/UteamUP/uteamup-mcp/commit/47dc49921e7cc36717d43e174221a4ee1fb56226))
* **stock:** cover alert acknowledgement state forwarding ([c9c50b5](https://github.com/UteamUP/uteamup-mcp/commit/c9c50b5236bf732131345b006201657f81aabe12))
* **stock:** cover stock search sort, sheet and stock-level status forwarding ([6b635a5](https://github.com/UteamUP/uteamup-mcp/commit/6b635a57b7f0b81ca4ab578e7b9397e7b05079b7))
* **system-status-tools:** add tests for UteamupExternalServiceStatus tool ([86cb96d](https://github.com/UteamUP/uteamup-mcp/commit/86cb96dcda74e38507a832650d2c917ddcf0fb7b))
* **tenant-coding-profile:** add tests for tenant designation profile MCP tools ([4f8bd59](https://github.com/UteamUP/uteamup-mcp/commit/4f8bd590f8270395b3844e73c5cf33455ffc1df7))
* **tenant:** cover industry and module MCP proxies ([d5c19de](https://github.com/UteamUP/uteamup-mcp/commit/d5c19de255b56e172a633e760a35bcc532a7bbb7))
* use the response helper for handover search contracts ([7a6665e](https://github.com/UteamUP/uteamup-mcp/commit/7a6665e4a4fb237956b0b7b5cdd73b9b960c366a))
* **user:** pin the userGuid contract of the user tools ([a2d50f0](https://github.com/UteamUP/uteamup-mcp/commit/a2d50f02927cc875bc907a37f380a3e6486a1891))
* **vin:** Jest contract suite for the fleet VIN decode MCP tool ([42dc9e2](https://github.com/UteamUP/uteamup-mcp/commit/42dc9e2baffc3a936c27deb6cbc444dfa37e6d0f))
* **weather:** cover the UteamupWeatherSiteWindows tool through the proxy ([deacdef](https://github.com/UteamUP/uteamup-mcp/commit/deacdefecb343517a8419095d4a6a103468f755b))
* **workorder-share:** proxy contract tests for the share tools ([fe05a2f](https://github.com/UteamUP/uteamup-mcp/commit/fe05a2f4c7b5278fd7db5b953290479cc4242828))

## [2.2.0-beta.9](https://github.com/UteamUP/uteamup-mcp/compare/2.1.0-beta.9...2.2.0-beta.9) (2026-08-29)


### Features

* **handover:** proxy numeric redemption safely ([bcf142e](https://github.com/UteamUP/uteamup-mcp/commit/bcf142e41ab26625e4a40daafe9ca65710f2f3e7))
* **mcp:** add buildMcpForwardHeaders function and related tests; update transport security methods ([528951e](https://github.com/UteamUP/uteamup-mcp/commit/528951e59b19492d99dfd29d98fd1b881c9968fe))
* **security:** implement transport security and payload limits ([64d23e9](https://github.com/UteamUP/uteamup-mcp/commit/64d23e97c4d0c60fad208bbf5716496cb17d1254))
* **tests:** enhance tests for asset certification and heat exposure tools; add redaction for sensitive data in logger ([a383973](https://github.com/UteamUP/uteamup-mcp/commit/a383973e63f1a0ca4d714b72f749bb2a989ddfe0))


### Bug Fixes

* harden MCP AI governance boundary ([3bb1016](https://github.com/UteamUP/uteamup-mcp/commit/3bb101673cebfbffc2dab0eef98e155768a76396))
* update brace-expansion transitive dependencies ([7304935](https://github.com/UteamUP/uteamup-mcp/commit/7304935e18b46bd06d3848cadd7e8e5f615238ed))


### Miscellaneous

* **security:** add npm dependabot ecosystem and weekly audit workflow ([350a0df](https://github.com/UteamUP/uteamup-mcp/commit/350a0dfa12d65b3107b0f36c59bbcac5fa85de9a))
* update .gitignore to exclude MSBuild binary logs ([d0aa1ab](https://github.com/UteamUP/uteamup-mcp/commit/d0aa1ab151fb9438e0617786b99171a9f26d5807))


### Documentation

* **mcp:** update MCPGuidelines.md to specify that tests should only be ([4a7c2d3](https://github.com/UteamUP/uteamup-mcp/commit/4a7c2d3ebee3c55c877d9ff5993cdb1b50e58ae7))
* update changelog with tutorial tools test coverage ([a587c7f](https://github.com/UteamUP/uteamup-mcp/commit/a587c7f07958c7892a5dc2a43b05c2a5c3e47511))
* update frontend styling rules documentation path ([0b8ff27](https://github.com/UteamUP/uteamup-mcp/commit/0b8ff273cd4cb5b8a6b9d15f80053cd401190226))


### Tests

* add unit tests for asset assistant and shift handover ai summary tools ([baddf7e](https://github.com/UteamUP/uteamup-mcp/commit/baddf7e65443acf8f72d4dfd7b33cf6ea1cab88c))
* add unit tests for part and stock tools ([c2ae5d7](https://github.com/UteamUP/uteamup-mcp/commit/c2ae5d7addb89060fceec81e75ece56efcb2384d))
* **agreements:** cover MCP entitlement contracts ([096b3e6](https://github.com/UteamUP/uteamup-mcp/commit/096b3e6d3d9122de588af97f7c91b5eca53ec7b5))
* **agreements:** cover MCP service agreement contracts ([991b250](https://github.com/UteamUP/uteamup-mcp/commit/991b2505317ecd26a900735d37354c701c4c3b61))
* **ai-credit-packages-tools:** update mock payload structure in unit tests ([fa87816](https://github.com/UteamUP/uteamup-mcp/commit/fa87816d99f85a25180aa5a32a2cf1d3f110f870))
* **ai-tier-assist-tools:** add unit tests for tier assist tools ([97f0e16](https://github.com/UteamUP/uteamup-mcp/commit/97f0e1675c26fe8800bb1f45ad64ca4b7dbcbb83))
* **ai:** add outcome measurements tools tests ([e6a1680](https://github.com/UteamUP/uteamup-mcp/commit/e6a1680a1046ecc029228db0e809b30ab9424e90))
* **ai:** cover control plane MCP proxy ([a1b13d1](https://github.com/UteamUP/uteamup-mcp/commit/a1b13d14a952273a16d70c938af7eda094980480))
* **ai:** cover data readiness MCP proxy ([aedbf52](https://github.com/UteamUP/uteamup-mcp/commit/aedbf52ce025241d15408ae737ef67fabf31a9f2))
* **ai:** cover Knowledge tutorial trust proxy ([711c389](https://github.com/UteamUP/uteamup-mcp/commit/711c389b76bd9a11473aa86e17ebe06a90ac5d7b))
* align cleanup MCP enum fixtures ([5938d63](https://github.com/UteamUP/uteamup-mcp/commit/5938d63791755a862cdf13d29879d93ca4f3c92e))
* align contractor and vendor tools with GUID contracts ([b669b71](https://github.com/UteamUP/uteamup-mcp/commit/b669b71e8835f40fce1f945dc161a77f1b92bb0d))
* align journal code linking with GUID contracts ([1abf196](https://github.com/UteamUP/uteamup-mcp/commit/1abf1961e35ebb5d5ab60e1f7b9e101eeebac6e4))
* align labour rate MCP fixtures with tenant GUIDs ([bb850ba](https://github.com/UteamUP/uteamup-mcp/commit/bb850bad6f44611b2599c19089467177360253d4))
* assert shift handover guid contract ([463e40f](https://github.com/UteamUP/uteamup-mcp/commit/463e40f3d91ac61133341f5c7e90decefe9be65d))
* attendance-station, on-call, and timesheet MCP tool coverage ([b321485](https://github.com/UteamUP/uteamup-mcp/commit/b3214853c86cfa85ecad87b59cfba285ed28341a))
* **briefing:** cover daily read and HITL confirm tools ([88c2e25](https://github.com/UteamUP/uteamup-mcp/commit/88c2e25dafe821630598302d11901c689b8c551c))
* **catalog-physical-attributes-tools:** add new test file for catalog physical attributes tools ([9cf5040](https://github.com/UteamUP/uteamup-mcp/commit/9cf504072617b077ed75ec41b2a1652e495c8e3a))
* **conversation:** add MCP tool tests ([bf9ba52](https://github.com/UteamUP/uteamup-mcp/commit/bf9ba52876f2fb5493898472e3b06bd73f290e31))
* cover asset assistant citation freshness ([a3d2115](https://github.com/UteamUP/uteamup-mcp/commit/a3d211511786e9cb586f3c038c9330ece1bf3338))
* cover asset report GUID tools ([dd67830](https://github.com/UteamUP/uteamup-mcp/commit/dd67830920e001b7b2d051002df93c4b56afac53))
* cover concurrent time entry contracts ([bf33682](https://github.com/UteamUP/uteamup-mcp/commit/bf3368241e9e397f52fa6e2af542f306a03e9844))
* cover enabled UPMate MCP capability contracts ([c1149f0](https://github.com/UteamUP/uteamup-mcp/commit/c1149f07df5ccf020922d435b72d87e356896de5))
* cover field service mutation retry contracts ([afb0a8a](https://github.com/UteamUP/uteamup-mcp/commit/afb0a8ad7178e9683ace7821f8b03a6e20ddbd88))
* cover fleet maintenance proposal MCP capability ([92865a7](https://github.com/UteamUP/uteamup-mcp/commit/92865a7f28eddf6a8388d3f554bf3590b759da06))
* cover GUID logbook import tool ([ebf41f0](https://github.com/UteamUP/uteamup-mcp/commit/ebf41f041163a9098d60b954c2d06a21e35580b9))
* cover GUID maintenance plan tools ([4864590](https://github.com/UteamUP/uteamup-mcp/commit/4864590872bf2a79609785c9d82af9c4c1ce983b))
* cover GUID portal communication tools ([ea38ded](https://github.com/UteamUP/uteamup-mcp/commit/ea38ded7423f5f24074ed5bfa84a55f557fc8db6))
* cover handover carry-over MCP contracts ([843bac1](https://github.com/UteamUP/uteamup-mcp/commit/843bac1ea31419ae8fd3ff6063f86c79a1487a5e))
* cover operational baton MCP proxy ([0b6d155](https://github.com/UteamUP/uteamup-mcp/commit/0b6d15515c21e40701677080ee09c8501d2cc7e4))
* cover provider-neutral billing tools ([9ea6019](https://github.com/UteamUP/uteamup-mcp/commit/9ea6019cd41ae399bc847e34c6db0f21ea3b694f))
* cover quality cleanup MCP proxy ([b3b5a50](https://github.com/UteamUP/uteamup-mcp/commit/b3b5a5002972b0b00eb7a76077385bbb49df6838))
* cover quality governance MCP tools ([a9b60c0](https://github.com/UteamUP/uteamup-mcp/commit/a9b60c0e9313b78b41620a6c4f1e65c6c9d1b256))
* cover quick report MCP tools ([a79e48e](https://github.com/UteamUP/uteamup-mcp/commit/a79e48e3bb21897556fbd129cfcdaaef5da99eb8))
* cover service SLA milestone proxy ([8804032](https://github.com/UteamUP/uteamup-mcp/commit/880403249de51ff10326a4f4421a4d9419178451))
* cover shift handover audit MCP tools ([c626509](https://github.com/UteamUP/uteamup-mcp/commit/c6265093d7b78b8712e264c9dc8eb92ff80662b1))
* cover shift handover section MCP contracts ([424cfdc](https://github.com/UteamUP/uteamup-mcp/commit/424cfdc69a1c7cce1a245634ef7eaa426f5424a9))
* cover UPMate asset detail contract ([ba84e08](https://github.com/UteamUP/uteamup-mcp/commit/ba84e081ade6385e3af1744ffad11b7a580f89b9))
* **digitaltwin:** add MCP proxy contract tests for the twin tools ([f991822](https://github.com/UteamUP/uteamup-mcp/commit/f9918229fceb515410653dd8d822c3d4699f3636))
* enforce shift handover GUID responses ([2402a08](https://github.com/UteamUP/uteamup-mcp/commit/2402a085fc20279280d08ad29c6130581f83e7e7))
* expand coverage for labour marketplace and shift handover tools ([075e1dc](https://github.com/UteamUP/uteamup-mcp/commit/075e1dc8d942a952c7a8567ed79402605547b3e9))
* **failures:** enforce GUID-only MCP reads ([3f7b1ce](https://github.com/UteamUP/uteamup-mcp/commit/3f7b1ce57c490b99ba2a693b1586394c9ea8fe2c))
* **fleet:** add asset contact GUID and service price list tests ([e6fc7bf](https://github.com/UteamUP/uteamup-mcp/commit/e6fc7bfa2e2aff2e1706243b54f7f46b1e2902c9))
* **fleet:** cover intelligence MCP parity ([a012e0f](https://github.com/UteamUP/uteamup-mcp/commit/a012e0fcba976ba361583aeb4793bfe3a73c0f01))
* **fleet:** cover intelligence mcp tools ([744193d](https://github.com/UteamUP/uteamup-mcp/commit/744193df0fc705e6d958494b94185f733531433a))
* **fleet:** verify GUID calendar MCP contracts ([9b7e9f9](https://github.com/UteamUP/uteamup-mcp/commit/9b7e9f94aee496ebb168bf2c473bc1509a20a7df))
* harden emergency insertion mcp proxy ([051d18e](https://github.com/UteamUP/uteamup-mcp/commit/051d18e755a67a4da6caf3e60cbf02f10a2e64c1))
* **inventory:** cover the scope-enforced bulk delete MCP tool ([f0916e7](https://github.com/UteamUP/uteamup-mcp/commit/f0916e7f166dd735b4a8ea21d2e190f9fff4b367))
* **iot:** add initial iot tests ([62bd370](https://github.com/UteamUP/uteamup-mcp/commit/62bd3700af6bab003b270594d7b507a2f0add934))
* Jest coverage for the 14 construction MCP tools ([9efb7cb](https://github.com/UteamUP/uteamup-mcp/commit/9efb7cb5bac2663aceb71bd06c64d8064e87fe53))
* **journals:** verify MCP field note parity ([15f3589](https://github.com/UteamUP/uteamup-mcp/commit/15f35891e5a8512a67211999ac305dbdfd369cd5))
* lock canonical workorder links ([20da7a2](https://github.com/UteamUP/uteamup-mcp/commit/20da7a2b2cb3f0354f73263044ce9e41e4461dc3))
* **maintenance:** cover nest asset maintenance plan MCP tool ([c0f73db](https://github.com/UteamUP/uteamup-mcp/commit/c0f73db591ea45ca3ac4b82b835b55f15bda2b6f))
* **maintenance:** verify planning MCP parity ([2e37150](https://github.com/UteamUP/uteamup-mcp/commit/2e371509e1f804699943490fadca2f85594471c2))
* **marketplace-tools:** update buyer verification property to isEstablished ([3a60368](https://github.com/UteamUP/uteamup-mcp/commit/3a6036835f9055d4fe04a59024856c5af4031adc))
* **marketplace:** add conversation controls tests ([e16d8c5](https://github.com/UteamUP/uteamup-mcp/commit/e16d8c507a1396d3df8bd69d49637eac21904cdd))
* **marketplace:** add coverage for worker dispatch replacement and update shift handover tool arguments ([e8174fe](https://github.com/UteamUP/uteamup-mcp/commit/e8174fe6f37ab3455b12fabba8c40aa86c6577f1))
* **marketplace:** add labour contractor analytics tests ([51e3b71](https://github.com/UteamUP/uteamup-mcp/commit/51e3b7197d1d37d8872dcd05f2a655c2b228c9ef))
* **marketplace:** add tests for UteamupMarketplaceSavedSearchesList, UteamupMarketplaceSaveSearch, and UteamupMarketplaceDeleteSavedSearch tools ([8456d0e](https://github.com/UteamUP/uteamup-mcp/commit/8456d0e401cd5b561c851e17a9d19ffd9993b8d2))
* **marketplace:** add tests for UteamupMarketplaceSellerScorecard tool ([2a180bf](https://github.com/UteamUP/uteamup-mcp/commit/2a180bfb23cf305b4e0f0fa96cce198670e0fa66))
* **marketplace:** cover labour agreement timesheets ([457f1f0](https://github.com/UteamUP/uteamup-mcp/commit/457f1f006106fc57d3cb2e9cc3c3479b6dec4a1c))
* **marketplace:** cover labour AI tools ([f30ee40](https://github.com/UteamUP/uteamup-mcp/commit/f30ee408acce9250b7991b0015baf9f8de704199))
* **marketplace:** cover private conversation AI summaries ([a2bfd44](https://github.com/UteamUP/uteamup-mcp/commit/a2bfd44afca8c3c9bdd4b5980a528343d6afaadc))
* **marketplace:** cover private labour workspace tool ([abf40a2](https://github.com/UteamUP/uteamup-mcp/commit/abf40a22da93a7261fede43871b47310bfcf614e))
* **marketplace:** Jest coverage for the facets MCP tool (H4) ([07adee6](https://github.com/UteamUP/uteamup-mcp/commit/07adee6a1681dd648c78e95cdccb15740e7cceb5))
* **marketplace:** Jest for buyer-reputation MCP tool (H13) ([945dcbc](https://github.com/UteamUP/uteamup-mcp/commit/945dcbc5d81f3634873df9693fc4c2e275c60e76))
* **mcp:** add Jest tests for UteamupCodeCatalogDuplicate + UteamupStockItemDuplicate ([2845ddc](https://github.com/UteamUP/uteamup-mcp/commit/2845ddc2cff2dbe34f5924e6369b0e705612c1e4))
* **mcp:** add part procurement intelligence tool tests ([7480c92](https://github.com/UteamUP/uteamup-mcp/commit/7480c92c568cd0b280df6793b108549dae7106bf))
* **mcp:** add promotion tools test coverage ([e056002](https://github.com/UteamUP/uteamup-mcp/commit/e056002b193775487cbffafc3c09a27808cf4ae0))
* **mcp:** add tests for UteamupTeamMoodRead tool and error handling ([b8f93da](https://github.com/UteamUP/uteamup-mcp/commit/b8f93dab8e30f04bc24e364edfcf6e900b588b97))
* **mcp:** cover accounting export tools ([9fc5f20](https://github.com/UteamUP/uteamup-mcp/commit/9fc5f206896492a708083a47985fbaafb18abeef))
* **mcp:** cover active and expiring rentals ([5c90c30](https://github.com/UteamUP/uteamup-mcp/commit/5c90c30cc613a3259c8dd9f495cbfb044385813b))
* **mcp:** cover asset certification status reads ([d3674c1](https://github.com/UteamUP/uteamup-mcp/commit/d3674c129b3503666c4bfea13e6823d8c75c8bea))
* **mcp:** cover AssetCertification create with CE fields ([c700381](https://github.com/UteamUP/uteamup-mcp/commit/c700381389cbb0d372dfc08aca7ff4d477d96742))
* **mcp:** cover authoritative offer cards ([e804b58](https://github.com/UteamUP/uteamup-mcp/commit/e804b58d38050f6552de4cc77c359b2e5924ae3a))
* **mcp:** cover available asset rentals ([956d36f](https://github.com/UteamUP/uteamup-mcp/commit/956d36f2276e5c8e447b76b41400c64c57ba5bf6))
* **mcp:** cover bookable resource tools ([fe09ed1](https://github.com/UteamUP/uteamup-mcp/commit/fe09ed1a9f2a1b05a499abffc066e7391de89674))
* **mcp:** cover consent-stage contact cards ([f75cd45](https://github.com/UteamUP/uteamup-mcp/commit/f75cd45c7b64ec17c654e94a3e6779605640288c))
* **mcp:** cover contractor application AI drafts ([5f68749](https://github.com/UteamUP/uteamup-mcp/commit/5f68749172fc25261db444badf3a72ac791c514a))
* **mcp:** cover critical handover acknowledgements ([c632513](https://github.com/UteamUP/uteamup-mcp/commit/c63251305b8627d8d8257d27436ee87db07f6ea6))
* **mcp:** cover filtered asset lifecycle reads ([d0abc0f](https://github.com/UteamUP/uteamup-mcp/commit/d0abc0f41c2174edde65f44436ab948449f3b571))
* **mcp:** cover governed IoT command tools ([d4b607a](https://github.com/UteamUP/uteamup-mcp/commit/d4b607a36944e0888e4b3841f21a9a7b530fd529))
* **mcp:** cover Heat NEP exposure list and create tools ([b7faf82](https://github.com/UteamUP/uteamup-mcp/commit/b7faf82e00ec33df2836d3b5f42364e08f93a7a0))
* **mcp:** cover location access schedule tools ([90e7d79](https://github.com/UteamUP/uteamup-mcp/commit/90e7d7921dcc9b9fbaf939237a66b3c6aa0c8a93))
* **mcp:** cover marketplace meeting tools ([0ba6835](https://github.com/UteamUP/uteamup-mcp/commit/0ba68356c7331bde9f2e5c0163e39cf721a265e2))
* **mcp:** cover marketplace participant mentions ([525d473](https://github.com/UteamUP/uteamup-mcp/commit/525d47338f672022f46db923aafd9e5241b55609))
* **mcp:** cover open asset failures ([5261541](https://github.com/UteamUP/uteamup-mcp/commit/5261541b743ad2f90f6b91232bdc757403715153))
* **mcp:** cover operational service billing tools ([d73963d](https://github.com/UteamUP/uteamup-mcp/commit/d73963df763080a1705823642a69a4798771f2a5))
* **mcp:** cover overdue asset calibrations ([bbe6a25](https://github.com/UteamUP/uteamup-mcp/commit/bbe6a25959110a737b69f36a2aa8b3d13e969bad))
* **mcp:** cover project field context ([d593494](https://github.com/UteamUP/uteamup-mcp/commit/d5934940f90fbb1d5ca80c422c1fdc50eab96a0a))
* **mcp:** cover rental revenue reads ([aff4ea2](https://github.com/UteamUP/uteamup-mcp/commit/aff4ea253cb1a71b68e84aacff2f089d803afa06))
* **mcp:** cover report catalog proxy ([8385cfa](https://github.com/UteamUP/uteamup-mcp/commit/8385cfadc2eb5983821539406e1825ae5486afe0))
* **mcp:** cover reporting-link tool proxying ([9a67c73](https://github.com/UteamUP/uteamup-mcp/commit/9a67c73a85f8c9565174967ddf301b4544ee2b6b))
* **mcp:** cover return case lifecycle tools ([c8aa51d](https://github.com/UteamUP/uteamup-mcp/commit/c8aa51d5603cde1688d3b65cdd1103fe3058d4f2))
* **mcp:** cover severity-filtered asset failures ([6cef3f7](https://github.com/UteamUP/uteamup-mcp/commit/6cef3f7a00009eb886585d027a02324a1194229c))
* **mcp:** cover shift handover operational links ([18f4c1f](https://github.com/UteamUP/uteamup-mcp/commit/18f4c1f50b2c4baef150a39667151ec8a495a954))
* **mcp:** cover the GUID-first bank-transfer billing tools ([a2688d3](https://github.com/UteamUP/uteamup-mcp/commit/a2688d325e70f3db19a194920aa579f635a640c5))
* **mcp:** cover the payment-provider tools ([95dc53e](https://github.com/UteamUP/uteamup-mcp/commit/95dc53e9af818570aebfda27ed214e0fddddbe43))
* **mcp:** cover UPMate field service tools ([da02c84](https://github.com/UteamUP/uteamup-mcp/commit/da02c8417c9f2992dd8fa40b76e666339594384e))
* **mcp:** expand test coverage for asset calibration and shift handover ([fa95cab](https://github.com/UteamUP/uteamup-mcp/commit/fa95cab1cb5165b5a2c8d110f78c63aa1e69c4bf))
* **mcp:** mirror shift handover reference GUIDs ([cbeb380](https://github.com/UteamUP/uteamup-mcp/commit/cbeb380184245f83fddb979276bedd4e450f8a16))
* **mcp:** read the tool result from the response body ([41154df](https://github.com/UteamUP/uteamup-mcp/commit/41154dfa4a6c6b8db551b98842a2c2d34e343d4d))
* **mcp:** update documentation and expand test coverage ([4a7c2d3](https://github.com/UteamUP/uteamup-mcp/commit/4a7c2d3ebee3c55c877d9ff5993cdb1b50e58ae7))
* **mcp:** update labour rate tools to use modifierGuid instead of id ([c27e579](https://github.com/UteamUP/uteamup-mcp/commit/c27e579b109c444965a710c83853d7e192d5301a))
* **mcp:** use real supplier-invoice match statuses in fixtures ([bfb3de1](https://github.com/UteamUP/uteamup-mcp/commit/bfb3de1118a172b7eab05e408b85ad8ae911ad44))
* **messaging:** add tests for UteamupMarketplaceMessageSend and related tools ([0560970](https://github.com/UteamUP/uteamup-mcp/commit/056097021d8da4062cd3344a30ddb689baec628e))
* **meters:** mirror GUID workorder reading tool ([e37fce9](https://github.com/UteamUP/uteamup-mcp/commit/e37fce943f23e1600c61542507dd814b8b8b9078))
* **meters:** remove integer schedule contracts ([64aed60](https://github.com/UteamUP/uteamup-mcp/commit/64aed60d03f72eadaa1d87d47306a80b4e5b938b))
* mirror canonical workorder create tool ([c79c858](https://github.com/UteamUP/uteamup-mcp/commit/c79c8585746a915fe61afc48a805ea9cf6335e1f))
* mirror guid shift request contracts ([920cc0a](https://github.com/UteamUP/uteamup-mcp/commit/920cc0a69e1e1101f3f0a796d4e2d80b4199c899))
* mirror GUID-only MCP boundary tools ([a765ebf](https://github.com/UteamUP/uteamup-mcp/commit/a765ebf6dc2e7fda71a719af95af5b22298eae1c))
* mirror IoT definition history tool ([5e81568](https://github.com/UteamUP/uteamup-mcp/commit/5e81568df4334d724c2c08f399866f906ea35096))
* **operations:** cover planning proxy contracts ([8c5b334](https://github.com/UteamUP/uteamup-mcp/commit/8c5b334123ef3432a6e1b2e724f6d73b469a2228))
* **partner:** update test comments/const after reseller→partner rename ([fe867d1](https://github.com/UteamUP/uteamup-mcp/commit/fe867d1d2410875193375d5c7412f8c7c4bf8032))
* **partner:** update tests for Partner MCP tools and rename references from Reseller to Partner ([d879cf8](https://github.com/UteamUP/uteamup-mcp/commit/d879cf847cd41065fb849d18b643fdcc0d99c9ea))
* pin GUID-only workorder completion proxy ([d098f18](https://github.com/UteamUP/uteamup-mcp/commit/d098f185fc0466e1b3ebfeae70abc6785d6cbb5f))
* preserve asset calibration overdue coverage ([9c4c678](https://github.com/UteamUP/uteamup-mcp/commit/9c4c67865b4550d19336a2e9a814229e6e792316))
* preserve IoT stamp diagnostics through MCP ([8935148](https://github.com/UteamUP/uteamup-mcp/commit/89351483c13144f356cb7d02ea4ae5d8c4f8deca))
* **procurement:** cover supplier invoice MCP tools ([0c71e6f](https://github.com/UteamUP/uteamup-mcp/commit/0c71e6fd6ad02ea9d73227baa5cb50d74b386a7b))
* **project-governance:** add unit tests for project governance tool ([ea239c3](https://github.com/UteamUP/uteamup-mcp/commit/ea239c394558deec8de9b5018025f09212a25479))
* **project-governance:** update tool names and argument keys in unit tests ([a093e04](https://github.com/UteamUP/uteamup-mcp/commit/a093e04dafbebd4c47ca537e2cbdaaa55dcd6acd))
* **project-my-projects:** remove id property from project test data ([9cc21d1](https://github.com/UteamUP/uteamup-mcp/commit/9cc21d1739797b354b635cc880cf23e2172deaac))
* **project-planning:** cover the new workorder-link MCP tools ([cd51b1c](https://github.com/UteamUP/uteamup-mcp/commit/cd51b1cc9880716fe700bcee77b23d2ede3719d1))
* **quality:** align cleanup replay fixture ([c1454a8](https://github.com/UteamUP/uteamup-mcp/commit/c1454a890fac524b41c435e33cca12511c6f4eef))
* refactor tests and add eslint configuration ([610d72e](https://github.com/UteamUP/uteamup-mcp/commit/610d72ec4ee6cb4568982c3d2ad39d3e0361dfcb))
* **reliability:** cover governed MCP tools ([52b8e0c](https://github.com/UteamUP/uteamup-mcp/commit/52b8e0ca6224fcc1c84e0477aa46e5207bef28e7))
* **reliability:** cover risk intelligence mcp parity ([f1097c3](https://github.com/UteamUP/uteamup-mcp/commit/f1097c3f8673b0998a600273c6e469b32bfcb8a7))
* **reliability:** cover strategy proposal mcp parity ([e0486fb](https://github.com/UteamUP/uteamup-mcp/commit/e0486fbcb3ef97bf21145f9ced224ab688c7596e))
* **reliability:** enforce GUID-only analytics contracts ([f808e4c](https://github.com/UteamUP/uteamup-mcp/commit/f808e4c465748235642c7d629af0b4eaa75287dd))
* remove retired billing overview tool ([9fef096](https://github.com/UteamUP/uteamup-mcp/commit/9fef096d3b5fc268e9e21f3c97a33443c50a0197))
* **reseller:** add tests for Reseller MCP tools and functionality ([15c9eb2](https://github.com/UteamUP/uteamup-mcp/commit/15c9eb23469386e6d998e07fcc2ee98afb785e84))
* retire immediate bank transfer refund tool ([4c761a1](https://github.com/UteamUP/uteamup-mcp/commit/4c761a104a7c47ac8e2ecd20ce90175b0d0cfcca))
* **route:** cover guid operational contracts ([de5bfe6](https://github.com/UteamUP/uteamup-mcp/commit/de5bfe673762312a78121e291462128831cb6140))
* **schedule-emergency-insertion:** add working time policy and violation ([4a7c2d3](https://github.com/UteamUP/uteamup-mcp/commit/4a7c2d3ebee3c55c877d9ff5993cdb1b50e58ae7))
* **schedule-emergency-insertion:** update test data with runGuid and idempotencyKey ([5b8594f](https://github.com/UteamUP/uteamup-mcp/commit/5b8594f75915c0b7b1b0d26a03cea29c4dd3684c))
* **schedule:** add crew details to proposed assignments in optimization tests ([d99ad27](https://github.com/UteamUP/uteamup-mcp/commit/d99ad27481d22c957a098cc1f951affd529229e5))
* **schedule:** add schedule optimization run tests ([4ad69ee](https://github.com/UteamUP/uteamup-mcp/commit/4ad69eee7def86916e372dcd0277c407ce8e01a7))
* **schedule:** cover emergency insertion preview tool ([dd352c4](https://github.com/UteamUP/uteamup-mcp/commit/dd352c41548aa6b6621568f3d3fef8cfcde416dd))
* **schedule:** cover guid booking MCP contracts ([48eaed9](https://github.com/UteamUP/uteamup-mcp/commit/48eaed9b3618e7046aa5c4986a7ed3b22b650af0))
* **schedule:** cover optimization apply and revert tools ([d1ffebc](https://github.com/UteamUP/uteamup-mcp/commit/d1ffebcd1dcea2dfd5b3d384a2d79f4ec0af44d1))
* **schedule:** cover optimization evidence ([98a1c98](https://github.com/UteamUP/uteamup-mcp/commit/98a1c981f12eecc20d3c344d685e9fae95a1fe9a))
* **schedule:** cover optimization policy tools ([37e05fd](https://github.com/UteamUP/uteamup-mcp/commit/37e05fd3c3d53bf187ad96ac9701dc327110f8cf))
* **schedule:** cover policy restore, archive listing and the enum wire format ([ebe5760](https://github.com/UteamUP/uteamup-mcp/commit/ebe576037793ce0abb5e0458c48ea5c5ffd83918))
* **schedule:** cover publication proxy contracts ([f7025ba](https://github.com/UteamUP/uteamup-mcp/commit/f7025bac27e490676349e44a209ca9a00a8a4426))
* **schedule:** cover supporting resource proxy ([1893889](https://github.com/UteamUP/uteamup-mcp/commit/18938892f3a35242bfb964dba8a30fa972b114fd))
* **security:** align TLS coverage with origin validation ([1563161](https://github.com/UteamUP/uteamup-mcp/commit/15631611d9fecb26c7d9199a72555f8f9283307f))
* **shift-handover:** cover operational metrics proxy ([161afb5](https://github.com/UteamUP/uteamup-mcp/commit/161afb559fc6e500265eb57bd9bf1a604fe2e6de))
* **shift-handover:** cover transfer challenge MCP proxy ([a7223ed](https://github.com/UteamUP/uteamup-mcp/commit/a7223ed4793507206991394a05fd20a584de02eb))
* **stock-activity-tool:** add unit tests for stock activity tool ([bbd799c](https://github.com/UteamUP/uteamup-mcp/commit/bbd799c871b16366b9a3712e231ce21a19149daf))
* **stock-ai-count-session-tools:** add unit tests for stock ai count session tool ([a688c38](https://github.com/UteamUP/uteamup-mcp/commit/a688c3817fa6b7620b58b2381907eed9eea28deb))
* **stock-enterprise-tools:** add condition grade filter test case ([9cf5040](https://github.com/UteamUP/uteamup-mcp/commit/9cf504072617b077ed75ec41b2a1652e495c8e3a))
* **stock-seasonality-tools:** add unit tests for stock seasonality tool ([aa6d40e](https://github.com/UteamUP/uteamup-mcp/commit/aa6d40eb2fd6984c90864f3a8c053c301025e305))
* **tutorial-tools:** add unit tests for tutorial tools ([9463cf8](https://github.com/UteamUP/uteamup-mcp/commit/9463cf8f1463d4527def846fb79795d2aa7d2579))
* **upmate:** add additional enabled capability contracts ([eb7b51c](https://github.com/UteamUP/uteamup-mcp/commit/eb7b51cfd75e439d1b4d45b9adc69f197635e6e8))
* **upmate:** add coverage for project health and customer portal work requests ([77b1068](https://github.com/UteamUP/uteamup-mcp/commit/77b106879b309ebc4aa4984929ecea6bd7dc7ec5))
* **upmate:** add coverage for workorder template analysis and customer portal users ([d8c92a0](https://github.com/UteamUP/uteamup-mcp/commit/d8c92a0649f6d9826f706a48281c84b317846810))
* **upmate:** add UteamupProjectBudgetGet to capability contracts ([930ae3d](https://github.com/UteamUP/uteamup-mcp/commit/930ae3d535035802e1d9b1079291fef26203ed76))
* **upmate:** cover document and vendor read contracts ([42eeedc](https://github.com/UteamUP/uteamup-mcp/commit/42eeedc3b971e07a5a3a116f137af07bb7b81b21))
* **upmate:** cover fleet dashboard read contracts ([a90d84d](https://github.com/UteamUP/uteamup-mcp/commit/a90d84d03b757e7a92c1174f2145b4cda898ea11))
* **upmate:** cover fleet package retries ([56df195](https://github.com/UteamUP/uteamup-mcp/commit/56df19555319d759508c0a480d3303e1104989c2))
* **upmate:** cover IoT rules read contract ([eadf903](https://github.com/UteamUP/uteamup-mcp/commit/eadf90391a380f96e902b5a5b8d5ca9f465e3b5f))
* **upmate:** cover project and shift detail contracts ([a2c9187](https://github.com/UteamUP/uteamup-mcp/commit/a2c91878e10de18fc4a9cceab6cd1d1936ed3159))
* **upmate:** Jest coverage for the eight governed field-service tools ([7675dd4](https://github.com/UteamUP/uteamup-mcp/commit/7675dd4f09b7fec2996f25ed4c82e07046f3807e))
* **upmate:** synchronize enabled capability count ([2818c10](https://github.com/UteamUP/uteamup-mcp/commit/2818c10ae78055fc37e9059b072e755a107b0481))
* **upmate:** verify cross-module tutorial discovery ([c9ecde4](https://github.com/UteamUP/uteamup-mcp/commit/c9ecde49010d99509649b080e8055f7c4be31a36))
* use GUID for extension install contracts ([27d993a](https://github.com/UteamUP/uteamup-mcp/commit/27d993a9b20e320a5729a1c89ebd6fa6b1efb7dc))
* use guid handover acceptance contracts ([c48171e](https://github.com/UteamUP/uteamup-mcp/commit/c48171e5684faaa4d8d849796cc0398aa9b8cf1a))
* **vehicle-inspection-overdue:** add new test suite for vehicle inspection ([4a7c2d3](https://github.com/UteamUP/uteamup-mcp/commit/4a7c2d3ebee3c55c877d9ff5993cdb1b50e58ae7))
* **vendors:** use guid scorecard tool contracts ([5c833ff](https://github.com/UteamUP/uteamup-mcp/commit/5c833ff2010a4e74816ac3d9ade71a6b5a7008b2))
* **workforce:** align MCP planning GUID contracts ([9419f0b](https://github.com/UteamUP/uteamup-mcp/commit/9419f0b263ea5f65ad8b89ad218a4bba90665adf))
* **workforce:** enforce GUID planning contracts ([cb3ac4a](https://github.com/UteamUP/uteamup-mcp/commit/cb3ac4a54082ebaafd18776a4d7041cd8459633d))


### CI/CD

* **cra:** publish a CycloneDX SBOM for the MCP server ([d8d1c36](https://github.com/UteamUP/uteamup-mcp/commit/d8d1c368465cd775e630f06a1cbde5dce4ff92d3))
* enforce MCP AI governance and locked installs ([f83b0d9](https://github.com/UteamUP/uteamup-mcp/commit/f83b0d9fe44f73e8dadea0ae6fc7f9281c0aecdc))
* **security:** add dependency release cooldown ([a9de3c1](https://github.com/UteamUP/uteamup-mcp/commit/a9de3c174679fe2ff1be4f499f82f9a1626eb397))

## [Unreleased]
- test(stock): cover forwarding both acknowledgement states through the tenant alert inbox tool.

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
