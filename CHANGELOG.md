# Changelog

## [1.3.0](https://github.com/ubiquity-os-marketplace/command-start-stop/compare/v1.2.0...v1.3.0) (2024-11-08)


### Features

* requiredLabelsToStart config ([5326f20](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/5326f20dbbe3e1a849487bc1d62572ce534fa0da))


### Bug Fixes

* convert AssignedIssueScope to enum ([986261a](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/986261acf7c62ed8f474ea4842fae4acbfe4a92f))
* handle search API private repo ([d8fead7](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/d8fead76df4723c8f387ffbae9314324481eb3a3))
* process review comments ([8fcedd9](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8fcedd9cc4ba3860a50b6835d8b8345cbc27e9f1))
* renamed checkIssues to assignedIssueScope ([87e7b16](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/87e7b16f334f7dec5a1ee34f01b9611b1e120ace))
* undo changes in manifest ([3827d28](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3827d28303a1d36e7668809194f6c9963c2a3140))

## [1.2.0](https://github.com/ubiquity-os-marketplace/command-start-stop/compare/v1.1.1...v1.2.0) (2024-11-04)


### Features

* added admin infinity in decode ([84d4641](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/84d464180badf5ef78443123b81a2b27c44b3e99))
* added validator endpoint ([58b457e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/58b457e5078eba5c2fdc241209781a19c1be3861))
* closing user pull-requests when unassigned ([210d943](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/210d943615aaf0a531b63516a893138c15ec7343))
* enforce collaborator-only label restriction ([413c844](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/413c8442170e4ff8455256dc590d02f81f82a608))
* pull edit handler ([188d00e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/188d00eb7486fe920c0d800d6d50dd7536818f25))
* pull edit handler ([30959ec](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/30959ec39e4e7567a1d4a8df35900dfb0ca410c7))
* schema generation ([5999073](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/59990739868c2f5a4fb02ce55d3d25b635a36e34))
* **tests:** add collaborator tests for issue assignment ([c5e58f5](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/c5e58f5f24ef96d3a8ba4b7f0d54c34f6a3744a7))


### Bug Fixes

* add fallback methods for fetching issues/PRs ([16ba3a8](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/16ba3a84835b5fc74d882fb4f0f5902491eec57a))
* add rolesWithReviewAuth to config ([9180717](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9180717d3789da49b43aaf3b68ad78ccd1f3e926))
* change checks for invalid env to get more details ([cc6ccfa](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/cc6ccfac4da89e727bf16f68cd047884399e91d1))
* cleanup merge ([a4df1b9](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/a4df1b99f2839f81dd0fea8334e15265458678ff))
* collaborator check with try catch ([32a4457](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/32a4457e1cbf3597fd9142fa3440cb6233e35998))
* fixed tip display and removed bold ([32082db](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/32082db649a70afb6a4d671a7214985708858330))
* **issue:** handle 404 status in fetch pull request reviews ([82064c5](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/82064c543782138221213a80455e68ba110f625c))
* register warning message change ([8868146](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8868146912b878614467b153b4568becd6e157b2))
* register warning message change ([8dd8463](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8dd84638b69cc8d2fabf8d5572dfa5155d995d08))
* removed duplicate error messages ([da03c15](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/da03c1504ecc03ebfa7f7cecf51f36b832046470))
* removed duplicate error messages ([3f61f14](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3f61f149c2998d69b6181ad580b40a27e5dfae85))
* **tests:** update error message for collaborators assignment ([4a954be](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/4a954bee3021c6bb4f32271b0ae382ee9bf4b2bd))
* update octokit method namespace ([3d760e3](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3d760e37911f24c4d61601bc74960d742396b36b))
* using graphql to fetch prs ([c49982b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/c49982b9b1415d46d0c97739c55046553d8ac2f0))

## [1.1.1](https://github.com/ubiquibot/command-start-stop/compare/v1.1.0...v1.1.1) (2024-09-08)


### Bug Fixes

* fixed /stop formatting ([43244a9](https://github.com/ubiquibot/command-start-stop/commit/43244a92e663e5700816b4ed23de4d9e66b676e3))
* skipping deadline self assign post if no deadline ([ebf98c4](https://github.com/ubiquibot/command-start-stop/commit/ebf98c455278fc8ea21d442ae37bd6d6d6f4f81e))
* the messages are displayed on catch errors ([c79b63f](https://github.com/ubiquibot/command-start-stop/commit/c79b63fa8224012d90c36de488c6c1fed6e5ba77))

## [1.1.0](https://github.com/ubiquibot/command-start-stop/compare/v1.0.0...v1.1.0) (2024-08-28)


### Features

* added worker deploy / delete capabilities ([ee5479d](https://github.com/ubiquibot/command-start-stop/commit/ee5479ddb4357b37a7aa1933ba08752ade4fdd06))
* custom message for private issues without plan ([4342e5f](https://github.com/ubiquibot/command-start-stop/commit/4342e5f24abcfa10cb3e261c7db4130e54d20361))


### Bug Fixes

* hide deadline if no time label ([28ee060](https://github.com/ubiquibot/command-start-stop/commit/28ee0609d8d206799f39365e0b515137f73fa28f))
* startRequiresWallet default true ([7ee8bc3](https://github.com/ubiquibot/command-start-stop/commit/7ee8bc362db89bdbbb11f94bdc7d4b40633575a8))

## 1.0.0 (2024-07-25)


### Features

* workerize ([cf1a6b6](https://github.com/ubiquibot/command-start-stop/commit/cf1a6b6ab7fa33b7204df19473fec94f7d76ba99))


### Bug Fixes

* add config defaults ([bedfb6d](https://github.com/ubiquibot/command-start-stop/commit/bedfb6d876a18c4a78e8c105dc73ad5ae29b3c11))
* better formatting for closed pulls ([6a20875](https://github.com/ubiquibot/command-start-stop/commit/6a2087565ccf85c360653ecbde55323fe83fae3f))
* corrected all issues reported by Knip ([c63579b](https://github.com/ubiquibot/command-start-stop/commit/c63579b364553781931f3c85515a009074c0c5e1))
* enable corepack for knip and fixed release-please.yml ([292a6e7](https://github.com/ubiquibot/command-start-stop/commit/292a6e748e5dbfd89cd5b27041b399ae6e167063))
* logs types ([b2420da](https://github.com/ubiquibot/command-start-stop/commit/b2420da42387b3fc262bf0a60940ed0a0f52a1c2))
* naming convention ([9bdf4c5](https://github.com/ubiquibot/command-start-stop/commit/9bdf4c577569f62963e424665fc3319206fb552e))
* no parsing required ([926c319](https://github.com/ubiquibot/command-start-stop/commit/926c3197fff0976d35d194b62a0e791dbe05deb7))
* optional chain and types ([4095cd3](https://github.com/ubiquibot/command-start-stop/commit/4095cd33922ef25cd62eec062fe58dc4e2b4c7f5))
* parse labels and correct env ([36458ce](https://github.com/ubiquibot/command-start-stop/commit/36458ceca0a4c758c6605a148f161aabbfb415b4))
* pretty logs types ([fd2c198](https://github.com/ubiquibot/command-start-stop/commit/fd2c1982f8555aaf5e03e93a480d636991f2f578))
* readme and const placement ([6fd8d73](https://github.com/ubiquibot/command-start-stop/commit/6fd8d73d2f07b152b6395f34f7e4d841f73351fd))
* readme config ([844b867](https://github.com/ubiquibot/command-start-stop/commit/844b867be17b03e038c7b1216d9eaa0f0479bdc3))
* readme, log type tweaks, tests passing ([bfb71f2](https://github.com/ubiquibot/command-start-stop/commit/bfb71f247f665be8d8549b8ebc310b8ea367fa11))
* remove compute. use ubiquibot token ([8b594bb](https://github.com/ubiquibot/command-start-stop/commit/8b594bbfc2a351dbd2ec20c6ee00f023247e648f))
* remove configs ([7e5fc99](https://github.com/ubiquibot/command-start-stop/commit/7e5fc99ff79d597d123ecbd3c620330f67d2a4da))
* remove unused ([0d41663](https://github.com/ubiquibot/command-start-stop/commit/0d41663e986978ed2bead6cbf67151135e89c521))
* removing helpers previously missed ([b166046](https://github.com/ubiquibot/command-start-stop/commit/b166046fd354af75fdd0052455663e45898993ee))
* return check ([8039369](https://github.com/ubiquibot/command-start-stop/commit/8039369290459b47abffe1345362c4b54f6f503d))
* target ESNEXT ([0dcd243](https://github.com/ubiquibot/command-start-stop/commit/0dcd24329b904c7b050e3f7c2fdaf84c7b48fc4c))
* types and package name ([c484635](https://github.com/ubiquibot/command-start-stop/commit/c4846359fc1e1df23fc56384bfe27d8e3a845841))
* updated jest and knip workflow to work on `pull_request` event instead of target ([e1043b1](https://github.com/ubiquibot/command-start-stop/commit/e1043b10be8dbea7c6f2cfad601df9f0d0762569))
* use Octokit types ([23e748e](https://github.com/ubiquibot/command-start-stop/commit/23e748e4abdf3604b1a05c430209646bf74f4176))
