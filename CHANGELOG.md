# Changelog

## [1.11.1](https://github.com/ubiquity-os-marketplace/command-start-stop/compare/v1.11.0...v1.11.1) (2025-09-06)


### Bug Fixes

* release please issue permission ([cdb1011](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/cdb101185a5000ac7f6861a85dd4c8a9c4a03c62))
* release please issue permission ([b468670](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/b468670eea5a5b77c342b9b36f42e8068c8e7b85))

## [1.11.0](https://github.com/ubiquity-os-marketplace/command-start-stop/compare/v1.10.0...v1.11.0) (2025-07-12)


### Features

* deno ([ffe0906](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/ffe0906e16613260aaf8789ca1cfd9ea6f407715))


### Bug Fixes

* added a default for transformedRole to enable empty configs ([d616699](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/d6166997265f2b3571cfed21593445a47bebb8f8))
* added a default for transformedRole to enable empty configs ([8445aa3](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8445aa3db11fb2cee0d0b0b0e8cf6bd08b0f2f7f))
* handle owner-type when fetching repositories ([811d3c4](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/811d3c498a75cc6ea9239977620ecb4a379af37f))
* handle owner-type when fetching repositories ([006c465](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/006c4655ebcdaa9a0df8df7ad110557a6b5a786a))

## [1.10.0](https://github.com/ubiquity-os-marketplace/command-start-stop/compare/v1.9.0...v1.10.0) (2025-05-07)


### Features

* add Azure Functions integration and deployment workflows ([6f62c13](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/6f62c130db7650edebf2a7d6243a37af62b3f267))
* add task access control configuration with price limits and refactor context creation ([5e82f61](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/5e82f61be02dd189e008c07bb910aca530690daf))
* add transformedRole for handling Infinity in collaborator and contributor roles ([737b578](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/737b578975cf9a2ebcb2f4c4146dbfb121feddee))
* implement task access control with price limits and add tests for default values ([6192aaf](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/6192aaf0ba0e8454c0a9ae38d1ee0dc109eb9b40))
* Task Access Control ([5c7da5b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/5c7da5b0edef641037e045d37a5892c7059e9d6a))
* used ubiquity's knip-reporter ([30456d1](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/30456d19d0f4a654dd54cd4e3f33b51927453b2b))
* used ubiquity's knip-reporter ([ac5603c](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/ac5603cba276f0bac040e7d16e54d8dc1ab2aa74))


### Bug Fixes

* disable start command for contributors ([d8c522a](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/d8c522aff2cd57e5ef34e679f3c04c1c612e2d7a))
* disable start with different message on negative setting ([224611a](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/224611a0bb95f5bb31a337c86baded8d9ee78523))
* improve price label parsing and enhance task access control validation ([e5330ac](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/e5330ac5b1923b84e3a5bbd1cd5ab18c4dc027cf))
* messages telling the user it cannot be using `/start` are now displayed as `warnings` ([ea95869](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/ea9586931d674685cf2b73c38ec1d7821d359e06))
* update role transformation and logging for task limits ([e2a5da0](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/e2a5da08c3e389489da1e1395f70d10538a2048e))

## [1.9.0](https://github.com/ubiquity-os-marketplace/command-start-stop/compare/v1.8.0...v1.9.0) (2025-02-09)


### Features

* aggregate price label and requirements errors ([088126b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/088126b234a67279a2198656438a6b3fae7e67a2))
* correct context and skip issues outside of the org ([2549597](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/2549597b57ec35071acb9551975b510e40aae8e3))
* remove self assign handler ([0a3d85c](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/0a3d85ce58074c4aec99a418a07be14babdef9fc))
* support cross-org ([bd63352](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/bd63352b346491a9fb79d016ddf992f8cc88e6b3))
* upload source maps ([bb751d4](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/bb751d4ba6af72458fb4409a2dd9352c0367b029))


### Bug Fixes

* add dependency ([506906b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/506906bcdc68c5032a736871d7bbe53d726aa30a))
* aggregate error and source maps ([a9383df](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/a9383df1c26ae0af7b1a08b2ec027823b8eed1c3))
* deployment checkout branch ([a2088b9](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/a2088b99605817da2cb6a77a5c8ae254f4fe9cab))
* error formatting ([597a745](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/597a745350e240c5580c6d9cb7b6d5af80076913))
* fix jest tests to handle AggregateError ([7ef84db](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/7ef84db2b61c2e9fe641c4793b935b315ce8a1d8))
* message formatting ([982a3f5](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/982a3f56413c79d5991aacdbcdab88b4efc6bed7))
* pricing error do not close the linked pull-request ([9f97c8e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9f97c8e15ec1f06c3dd2be6ae82d5632bf714c2c))
* tests ([e4977d0](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/e4977d0538ffdd8f025db8743d235889de73fc8d))
* tests ([1e47186](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/1e471860392303cc8f01c4f99344b8be87686a87))
* tests ([c2b42a4](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/c2b42a4745dd1f3bc11b210be9ff968a7bcaad62))

## [1.8.0](https://github.com/ubiquity-os-marketplace/command-start-stop/compare/v1.7.1...v1.8.0) (2025-01-16)

### Features

- added admin infinity in decode ([84d4641](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/84d464180badf5ef78443123b81a2b27c44b3e99))
- added validator endpoint ([58b457e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/58b457e5078eba5c2fdc241209781a19c1be3861))
- added worker deploy / delete capabilities ([13e0b4c](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/13e0b4cc9235138b442a2ff0a3b1900646f4e8c5))
- added worker deploy / delete capabilities ([ee5479d](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/ee5479ddb4357b37a7aa1933ba08752ade4fdd06))
- closing user pull-requests when unassigned ([210d943](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/210d943615aaf0a531b63516a893138c15ec7343))
- custom message for private issues without plan ([829a134](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/829a1342ed716c062ec25d4d010142cc4c285c1d))
- enforce collaborator-only label restriction ([413c844](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/413c8442170e4ff8455256dc590d02f81f82a608))
- fine grain permission to start tasks ([e408abe](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/e408abee2503a3bd47ce3db0e00127d57ef27117))
- make issues and PRs search configurable ([32e9280](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/32e9280d5ccfdc7ef827158aafa410ebfc0c9b9f))
- make task limits configurable ([9b7bbdf](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9b7bbdf618cd39fd6337b44dfa9221745a57e5f2))
- manifest commands object ([aaf9c59](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/aaf9c59f083b15f82c5348eb7495d87fa7eb2791))
- max task assignment for collaborators ([8d5c56a](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8d5c56a65c6f1fb586fd1d1d518c876db5516f47))
- new error msg on missing required label ([ef6198a](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/ef6198ae51b9d8a39f61fe669144e8826e724924))
- pull edit handler ([188d00e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/188d00eb7486fe920c0d800d6d50dd7536818f25))
- pull edit handler ([30959ec](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/30959ec39e4e7567a1d4a8df35900dfb0ca410c7))
- requiredLabelsToStart config ([5326f20](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/5326f20dbbe3e1a849487bc1d62572ce534fa0da))
- schema generation ([5999073](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/59990739868c2f5a4fb02ce55d3d25b635a36e34))
- sdk and command interface ([6c1a13e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/6c1a13ec7f6047e32bcf518ea74333b8e5edb247))
- switch to Bun and fix deploy ([6241af7](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/6241af7be3f21449632960daa12a51a5182eb2e6))
- task limit improvement ([f00a9c6](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/f00a9c67b09a4d98fd9c2d2d49489ce41fbe2f0e))
- task limit improvement ([5497d7e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/5497d7ebd89b24c282ff9501c206c4b3274036b8))
- **tests:** add collaborator tests for issue assignment ([c5e58f5](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/c5e58f5f24ef96d3a8ba4b7f0d54c34f6a3744a7))
- update style ([734f97b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/734f97bcb910452461fc87a7d5f54156b5a4149c))
- upgrade typebox ([1a32260](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/1a32260f4b2be30f4adcb4f139392aadc38a4f06))

### Bug Fixes

- add env typebox validator to worker, fix tests ([f5bc1d5](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/f5bc1d5adb3ee811f0b984750f938e8e1608ccbd))
- add fallback methods for fetching issues/PRs ([16ba3a8](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/16ba3a84835b5fc74d882fb4f0f5902491eec57a))
- add rolesWithReviewAuth to config ([9180717](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9180717d3789da49b43aaf3b68ad78ccd1f3e926))
- add rolesWithReviewAuth to config ([4c29657](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/4c296573b0d7091eb3bcb1c02b5ebf909d73d59d))
- add validation to check for duplicate roles ([d62cfe5](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/d62cfe59a8426eea16239af779bceb39afeb8639))
- added test for start with carriage returns ([41a8058](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/41a8058604fb0e83355b7842d434cb4f1ecb4701))
- added www. prefix ([0b63098](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/0b630988ddd313bb09c2103c76f66138260beec3))
- address duplicate logging on max limit ([0bfa5e0](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/0bfa5e0bba90837cdb3826490949c25d6f1bf14e))
- alternative way to list issues within network ([72cc120](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/72cc1200d5ad7848c54eab4c878a53eb15f6452c))
- assignee issue and open pr fetching ([f308aca](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/f308acab4e389d40bee8f68ab6ed47be797fc791))
- change checks for invalid env to get more details ([cc6ccfa](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/cc6ccfac4da89e727bf16f68cd047884399e91d1))
- check limit per role correctly ([9416b25](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9416b25389063ebe9f25307c31845adab9e8f7e4))
- clean up queries ([df7ff28](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/df7ff28afad86cc5fc793ac490c65a42fcec626a))
- cleanup ([239d26e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/239d26e33eda370643f2be428b5334aae8fd0c82))
- cleanup merge ([a4df1b9](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/a4df1b99f2839f81dd0fea8334e15265458678ff))
- collaborator check with try catch ([32a4457](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/32a4457e1cbf3597fd9142fa3440cb6233e35998))
- condition for branch target changed to be either ref or workflow ref ([82bd846](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/82bd84634edbb3aa7340802f95e172754bc7be45))
- **config:** add descriptions to JSON schema properties ([4fed7fd](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/4fed7fd36b2fbb1107d28d5ec266986fa34bab7a))
- convert AssignedIssueScope to enum ([986261a](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/986261acf7c62ed8f474ea4842fae4acbfe4a92f))
- ensure assignee is checked in userUnassigned handler ([5659fc3](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/5659fc3fa7c692f1f5bd7e79298202ac553775e9))
- fix failling knip and double logging max limit error message ([84c8465](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/84c8465c815c9f2edfab3b151e109d40504c083b))
- fix format and type ([044f8a8](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/044f8a87e652e19e1349c138dfdabad03c6d022f))
- fixed /stop formatting ([43244a9](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/43244a92e663e5700816b4ed23de4d9e66b676e3))
- fixed failing test ([3e18c1b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3e18c1bc97b1039db021130d096aa87ee3bb5022))
- fixed tip display and removed bold ([32082db](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/32082db649a70afb6a4d671a7214985708858330))
- get contributors from config ([32b0456](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/32b045672108106c780dff00b3c793461467211b))
- get contributors from config ([212f9bf](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/212f9bf226ffa1ca2c460af6917d090e6a0f5a20))
- handle 404 ([d09f2d4](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/d09f2d4f535a51ce004806bfac8a0a07ae912c2e))
- handle fetch error ([2474312](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/2474312f268ae015065f3f8000a9cb67ff735f3d))
- handle search API private repo ([d8fead7](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/d8fead76df4723c8f387ffbae9314324481eb3a3))
- hide deadline if no time label ([1ab9112](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/1ab9112bcd9789babbfdc5111c603f0726148532))
- ignore dist ([2ba5e14](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/2ba5e142969eb24b0d898c5eed44df1abb957588))
- ignore eslint config ([9155361](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9155361f8fcb61fd72b5fb74a8856089a13de55a))
- **issue:** handle 404 status in fetch pull request reviews ([82064c5](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/82064c543782138221213a80455e68ba110f625c))
- linked pull-requests on tasks that cannot be started get closed ([b36b79b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/b36b79b9e55279e407295e02ad4c95cdf05a5012))
- logic to retrieve pull-requests pending for a user updated ([e5259f1](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/e5259f16f1e2ab931383152a8d749c21d0720327))
- ncc build ([29c2aef](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/29c2aefeeadf5b134edfc25e05a2e2d85bbdc442))
- pass decoded env ([a9b21e0](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/a9b21e0ca1d866c2bb0acfcbd1814811d136fa23))
- prevent bot from double posting messages ([9c40d09](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9c40d09bfc0c4ec178bb874afc03c57409ffe7ec))
- process review comments ([8fcedd9](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8fcedd9cc4ba3860a50b6835d8b8345cbc27e9f1))
- query network in getAllPRs ([58fd4da](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/58fd4da3ecb986b9a7bdcdbfd60aca5e96e6da8c))
- regenerate bun lock file ([788b468](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/788b468217d21cef23e0f75a98efb0d0b70de2d2))
- register warning message change ([8868146](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8868146912b878614467b153b4568becd6e157b2))
- register warning message change ([8dd8463](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8dd84638b69cc8d2fabf8d5572dfa5155d995d08))
- remove duplicate maxTask checks ([99ccab3](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/99ccab31345cfce1ddf804999cd9bf3707010c26))
- remove individual limit comment ([38b1653](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/38b16539ead5dde3a9007251608a797897eae865))
- remove openedPullRequest checks for maxlimit ([14f8e5f](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/14f8e5f2ed01af77d5711eb49501f79696b4c61c))
- remove union type ([09c5337](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/09c533716356716789fb6a2ed1b6004107e55f36))
- remove unneeded usage of no wallet string param ([6151b52](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/6151b52e6678b928e6ca096b4c94180bde66e0d4))
- removed deadline message on issue assigned ([f9c38e9](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/f9c38e9c7e1b40340919b5cf6eaaf401a6c3bcc5))
- removed debug lines ([ad20e32](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/ad20e32526c6a9bf1ec2d87f8558e4aeb2b62e0c))
- removed duplicate error messages ([da03c15](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/da03c1504ecc03ebfa7f7cecf51f36b832046470))
- removed duplicate error messages ([3f61f14](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3f61f149c2998d69b6181ad580b40a27e5dfae85))
- renamed checkIssues to assignedIssueScope ([87e7b16](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/87e7b16f334f7dec5a1ee34f01b9611b1e120ace))
- return lowest task limit if user role doesnt match any of those in the config ([b4696c8](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/b4696c87462a52f0eb126a376c1fb3357770560a))
- return lowest task limit if user role doesnt match any of those in the config ([391bdde](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/391bdde81d1f1da7b6d9f95ec7e445865024e271))
- revert change in package.json ([8bf9f6f](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8bf9f6f672e28ce1d679d9a6ed3a011e7d9e9f74))
- set a default value which is type string ([40def46](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/40def464f2e0eca6065324ea94652cf561a89f6a))
- set smallest task on error when getting user role ([10b985a](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/10b985ab574ae50ec9fe3e2118509a205278f1b4))
- show message by a config of the emptyWalletText ([b11fc4f](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/b11fc4f534b53132182f4fb501b88f1fe214f026))
- skipping deadline self assign post if no deadline ([ebf98c4](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/ebf98c455278fc8ea21d442ae37bd6d6d6f4f81e))
- switch back to CJS ([5f81ebf](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/5f81ebfd2aa3c89f2004dc8f75539dfbd9d31fdd))
- **tests:** update error message for collaborators assignment ([4a954be](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/4a954bee3021c6bb4f32271b0ae382ee9bf4b2bd))
- the messages are displayed on catch errors ([c79b63f](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/c79b63fa8224012d90c36de488c6c1fed6e5ba77))
- the pull-request author is now the user assigned instead of the editor of the PR body ([7023f84](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/7023f848b7d9ae214f8e823646d9924f3c8d6bc4))
- the stop commands are counted by assignment periods ([35f62c2](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/35f62c2ad09255f32f626a8af5022ed661155913))
- the user role is determined from the repo when unavailable from organization ([fa4692b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/fa4692b76ca37de3744eaac78e549f6f2c89cb93))
- undo changes in manifest ([3827d28](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3827d28303a1d36e7668809194f6c9963c2a3140))
- update mock handlers ([0953019](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/0953019c1c0f1b84ed837d8ab65c5ae1072cd9b6))
- update octokit method namespace ([3d760e3](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3d760e37911f24c4d61601bc74960d742396b36b))
- update yarn.lock ([910ebf0](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/910ebf08767b9905d399152f832d2b90d5857423))
- updated yarn.lock ([0a6bd74](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/0a6bd743a63ee756c63d866b16453f31855422cf))
- upgrade bun regenerate lock file ([3ed0b7e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3ed0b7ec06d96f7f97cb0a9853fcd675b00608fa))
- used API to query orgs where the app is installed ([cd96022](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/cd960229256da8a60d4c5138b014041725be8e9b))
- user t.record and loop by object.entries ([a5bd14d](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/a5bd14dac37ee612e257e3a2d0e4375cc5f8b373))
- using graphql to fetch prs ([c49982b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/c49982b9b1415d46d0c97739c55046553d8ac2f0))
- yarn v1 ([7deffaf](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/7deffaf3d91385468e3a2ccf3b91c7d89c47175a))

## [1.7.0](https://github.com/ubiquity-os-marketplace/command-start-stop/compare/v1.6.0...v1.7.0) (2025-01-14)

### Features

- add a new config param ([7fa0ead](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/7fa0eadd428c5daec854d4ee7f4de42305a922d9))
- added admin infinity in decode ([84d4641](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/84d464180badf5ef78443123b81a2b27c44b3e99))
- added validator endpoint ([58b457e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/58b457e5078eba5c2fdc241209781a19c1be3861))
- added worker deploy / delete capabilities ([13e0b4c](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/13e0b4cc9235138b442a2ff0a3b1900646f4e8c5))
- added worker deploy / delete capabilities ([ee5479d](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/ee5479ddb4357b37a7aa1933ba08752ade4fdd06))
- check unassigns ([2bf7363](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/2bf73630ba2447f8b0e1b8b35beab209cdd0f80d))
- closing user pull-requests when unassigned ([210d943](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/210d943615aaf0a531b63516a893138c15ec7343))
- custom message for private issues without plan ([829a134](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/829a1342ed716c062ec25d4d010142cc4c285c1d))
- enforce collaborator-only label restriction ([413c844](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/413c8442170e4ff8455256dc590d02f81f82a608))
- fine grain permission to start tasks ([e408abe](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/e408abee2503a3bd47ce3db0e00127d57ef27117))
- make issues and PRs search configurable ([32e9280](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/32e9280d5ccfdc7ef827158aafa410ebfc0c9b9f))
- make task limits configurable ([9b7bbdf](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9b7bbdf618cd39fd6337b44dfa9221745a57e5f2))
- make task limits configurable ([71324b8](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/71324b82133d540907fc1271abc4a05742df62de))
- manifest commands object ([aaf9c59](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/aaf9c59f083b15f82c5348eb7495d87fa7eb2791))
- max task assignment for collaborators ([8d5c56a](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8d5c56a65c6f1fb586fd1d1d518c876db5516f47))
- max task assignment for collaborators ([bedb60b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/bedb60b15b3102f69b42e1f92132a634a465fdd6))
- new error msg on missing required label ([ef6198a](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/ef6198ae51b9d8a39f61fe669144e8826e724924))
- previous assignment filter ([1f82df8](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/1f82df8853ff947b02750f8b46b6476c92c15049))
- pull edit handler ([188d00e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/188d00eb7486fe920c0d800d6d50dd7536818f25))
- pull edit handler ([30959ec](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/30959ec39e4e7567a1d4a8df35900dfb0ca410c7))
- requiredLabelsToStart config ([5326f20](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/5326f20dbbe3e1a849487bc1d62572ce534fa0da))
- schema generation ([5999073](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/59990739868c2f5a4fb02ce55d3d25b635a36e34))
- sdk and command interface ([6c1a13e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/6c1a13ec7f6047e32bcf518ea74333b8e5edb247))
- switch to Bun and fix deploy ([6241af7](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/6241af7be3f21449632960daa12a51a5182eb2e6))
- task limit improvement ([f00a9c6](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/f00a9c67b09a4d98fd9c2d2d49489ce41fbe2f0e))
- task limit improvement ([5497d7e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/5497d7ebd89b24c282ff9501c206c4b3274036b8))
- **tests:** add collaborator tests for issue assignment ([c5e58f5](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/c5e58f5f24ef96d3a8ba4b7f0d54c34f6a3744a7))
- update style ([734f97b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/734f97bcb910452461fc87a7d5f54156b5a4149c))
- upgrade typebox ([1a32260](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/1a32260f4b2be30f4adcb4f139392aadc38a4f06))

### Bug Fixes

- add env typebox validator to worker, fix tests ([f5bc1d5](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/f5bc1d5adb3ee811f0b984750f938e8e1608ccbd))
- add fallback methods for fetching issues/PRs ([16ba3a8](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/16ba3a84835b5fc74d882fb4f0f5902491eec57a))
- add rolesWithReviewAuth to config ([9180717](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9180717d3789da49b43aaf3b68ad78ccd1f3e926))
- add rolesWithReviewAuth to config ([4c29657](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/4c296573b0d7091eb3bcb1c02b5ebf909d73d59d))
- add validation to check for duplicate roles ([d62cfe5](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/d62cfe59a8426eea16239af779bceb39afeb8639))
- added test for start with carriage returns ([41a8058](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/41a8058604fb0e83355b7842d434cb4f1ecb4701))
- added www. prefix ([0b63098](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/0b630988ddd313bb09c2103c76f66138260beec3))
- address duplicate logging on max limit ([0bfa5e0](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/0bfa5e0bba90837cdb3826490949c25d6f1bf14e))
- alternative way to list issues within network ([72cc120](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/72cc1200d5ad7848c54eab4c878a53eb15f6452c))
- assignee issue and open pr fetching ([f308aca](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/f308acab4e389d40bee8f68ab6ed47be797fc791))
- change checks for invalid env to get more details ([cc6ccfa](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/cc6ccfac4da89e727bf16f68cd047884399e91d1))
- check limit per role correctly ([9416b25](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9416b25389063ebe9f25307c31845adab9e8f7e4))
- clean up queries ([df7ff28](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/df7ff28afad86cc5fc793ac490c65a42fcec626a))
- cleanup ([239d26e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/239d26e33eda370643f2be428b5334aae8fd0c82))
- cleanup merge ([a4df1b9](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/a4df1b99f2839f81dd0fea8334e15265458678ff))
- collaborator check with try catch ([32a4457](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/32a4457e1cbf3597fd9142fa3440cb6233e35998))
- **config:** add descriptions to JSON schema properties ([4fed7fd](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/4fed7fd36b2fbb1107d28d5ec266986fa34bab7a))
- convert AssignedIssueScope to enum ([986261a](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/986261acf7c62ed8f474ea4842fae4acbfe4a92f))
- ensure assignee is checked in userUnassigned handler ([5659fc3](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/5659fc3fa7c692f1f5bd7e79298202ac553775e9))
- fix failling knip and double logging max limit error message ([84c8465](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/84c8465c815c9f2edfab3b151e109d40504c083b))
- fix format and type ([044f8a8](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/044f8a87e652e19e1349c138dfdabad03c6d022f))
- fixed /stop formatting ([43244a9](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/43244a92e663e5700816b4ed23de4d9e66b676e3))
- fixed failing test ([3e18c1b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3e18c1bc97b1039db021130d096aa87ee3bb5022))
- fixed tip display and removed bold ([32082db](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/32082db649a70afb6a4d671a7214985708858330))
- get contributors from config ([32b0456](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/32b045672108106c780dff00b3c793461467211b))
- get contributors from config ([212f9bf](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/212f9bf226ffa1ca2c460af6917d090e6a0f5a20))
- handle 404 ([d09f2d4](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/d09f2d4f535a51ce004806bfac8a0a07ae912c2e))
- handle fetch error ([2474312](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/2474312f268ae015065f3f8000a9cb67ff735f3d))
- handle search API private repo ([d8fead7](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/d8fead76df4723c8f387ffbae9314324481eb3a3))
- hide deadline if no time label ([1ab9112](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/1ab9112bcd9789babbfdc5111c603f0726148532))
- ignore dist ([2ba5e14](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/2ba5e142969eb24b0d898c5eed44df1abb957588))
- ignore eslint config ([9155361](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9155361f8fcb61fd72b5fb74a8856089a13de55a))
- **issue:** handle 404 status in fetch pull request reviews ([82064c5](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/82064c543782138221213a80455e68ba110f625c))
- linked pull-requests on tasks that cannot be started get closed ([b36b79b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/b36b79b9e55279e407295e02ad4c95cdf05a5012))
- logic to retrieve pull-requests pending for a user updated ([e5259f1](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/e5259f16f1e2ab931383152a8d749c21d0720327))
- ncc build ([29c2aef](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/29c2aefeeadf5b134edfc25e05a2e2d85bbdc442))
- pass decoded env ([a9b21e0](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/a9b21e0ca1d866c2bb0acfcbd1814811d136fa23))
- prevent bot from double posting messages ([9c40d09](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9c40d09bfc0c4ec178bb874afc03c57409ffe7ec))
- process review comments ([8fcedd9](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8fcedd9cc4ba3860a50b6835d8b8345cbc27e9f1))
- query network in getAllPRs ([58fd4da](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/58fd4da3ecb986b9a7bdcdbfd60aca5e96e6da8c))
- regenerate bun lock file ([788b468](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/788b468217d21cef23e0f75a98efb0d0b70de2d2))
- register warning message change ([8868146](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8868146912b878614467b153b4568becd6e157b2))
- register warning message change ([8dd8463](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8dd84638b69cc8d2fabf8d5572dfa5155d995d08))
- remove duplicate maxTask checks ([99ccab3](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/99ccab31345cfce1ddf804999cd9bf3707010c26))
- remove individual limit comment ([38b1653](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/38b16539ead5dde3a9007251608a797897eae865))
- remove openedPullRequest checks for maxlimit ([14f8e5f](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/14f8e5f2ed01af77d5711eb49501f79696b4c61c))
- remove union type ([09c5337](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/09c533716356716789fb6a2ed1b6004107e55f36))
- remove unneeded usage of no wallet string param ([6151b52](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/6151b52e6678b928e6ca096b4c94180bde66e0d4))
- removed deadline message on issue assigned ([f9c38e9](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/f9c38e9c7e1b40340919b5cf6eaaf401a6c3bcc5))
- removed debug lines ([ad20e32](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/ad20e32526c6a9bf1ec2d87f8558e4aeb2b62e0c))
- removed duplicate error messages ([da03c15](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/da03c1504ecc03ebfa7f7cecf51f36b832046470))
- removed duplicate error messages ([3f61f14](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3f61f149c2998d69b6181ad580b40a27e5dfae85))
- renamed checkIssues to assignedIssueScope ([87e7b16](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/87e7b16f334f7dec5a1ee34f01b9611b1e120ace))
- return lowest task limit if user role doesnt match any of those in the config ([b4696c8](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/b4696c87462a52f0eb126a376c1fb3357770560a))
- return lowest task limit if user role doesnt match any of those in the config ([391bdde](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/391bdde81d1f1da7b6d9f95ec7e445865024e271))
- revert change in package.json ([8bf9f6f](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8bf9f6f672e28ce1d679d9a6ed3a011e7d9e9f74))
- set a default value which is type string ([40def46](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/40def464f2e0eca6065324ea94652cf561a89f6a))
- set smallest task on error when getting user role ([10b985a](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/10b985ab574ae50ec9fe3e2118509a205278f1b4))
- show message by a config of the emptyWalletText ([b11fc4f](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/b11fc4f534b53132182f4fb501b88f1fe214f026))
- skipping deadline self assign post if no deadline ([ebf98c4](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/ebf98c455278fc8ea21d442ae37bd6d6d6f4f81e))
- switch back to CJS ([5f81ebf](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/5f81ebfd2aa3c89f2004dc8f75539dfbd9d31fdd))
- **tests:** update error message for collaborators assignment ([4a954be](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/4a954bee3021c6bb4f32271b0ae382ee9bf4b2bd))
- the messages are displayed on catch errors ([c79b63f](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/c79b63fa8224012d90c36de488c6c1fed6e5ba77))
- the pull-request author is now the user assigned instead of the editor of the PR body ([7023f84](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/7023f848b7d9ae214f8e823646d9924f3c8d6bc4))
- the stop commands are counted by assignment periods ([35f62c2](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/35f62c2ad09255f32f626a8af5022ed661155913))
- the user role is determined from the repo when unavailable from organization ([fa4692b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/fa4692b76ca37de3744eaac78e549f6f2c89cb93))
- undo changes in manifest ([3827d28](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3827d28303a1d36e7668809194f6c9963c2a3140))
- update mock handlers ([0953019](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/0953019c1c0f1b84ed837d8ab65c5ae1072cd9b6))
- update octokit method namespace ([3d760e3](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3d760e37911f24c4d61601bc74960d742396b36b))
- update yarn.lock ([910ebf0](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/910ebf08767b9905d399152f832d2b90d5857423))
- updated yarn.lock ([0a6bd74](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/0a6bd743a63ee756c63d866b16453f31855422cf))
- upgrade bun regenerate lock file ([3ed0b7e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3ed0b7ec06d96f7f97cb0a9853fcd675b00608fa))
- used API to query orgs where the app is installed ([cd96022](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/cd960229256da8a60d4c5138b014041725be8e9b))
- user t.record and loop by object.entries ([a5bd14d](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/a5bd14dac37ee612e257e3a2d0e4375cc5f8b373))
- using graphql to fetch prs ([c49982b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/c49982b9b1415d46d0c97739c55046553d8ac2f0))
- yarn v1 ([7deffaf](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/7deffaf3d91385468e3a2ccf3b91c7d89c47175a))

## [1.5.0](https://github.com/ubiquity-os-marketplace/command-start-stop/compare/v1.4.0...v1.5.0) (2024-11-29)

### Features

- manifest commands object ([aaf9c59](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/aaf9c59f083b15f82c5348eb7495d87fa7eb2791))
- switch to Bun and fix deploy ([6241af7](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/6241af7be3f21449632960daa12a51a5182eb2e6))
- upgrade typebox ([1a32260](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/1a32260f4b2be30f4adcb4f139392aadc38a4f06))

### Bug Fixes

- ignore dist ([2ba5e14](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/2ba5e142969eb24b0d898c5eed44df1abb957588))
- ignore eslint config ([9155361](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9155361f8fcb61fd72b5fb74a8856089a13de55a))
- logic to retrieve pull-requests pending for a user updated ([e5259f1](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/e5259f16f1e2ab931383152a8d749c21d0720327))
- ncc build ([29c2aef](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/29c2aefeeadf5b134edfc25e05a2e2d85bbdc442))
- switch back to CJS ([5f81ebf](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/5f81ebfd2aa3c89f2004dc8f75539dfbd9d31fdd))
- yarn v1 ([7deffaf](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/7deffaf3d91385468e3a2ccf3b91c7d89c47175a))

## [1.4.0](https://github.com/ubiquity-os-marketplace/command-start-stop/compare/v1.3.0...v1.4.0) (2024-11-18)

### Features

- new error msg on missing required label ([ef6198a](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/ef6198ae51b9d8a39f61fe669144e8826e724924))

## [1.3.0](https://github.com/ubiquity-os-marketplace/command-start-stop/compare/v1.2.0...v1.3.0) (2024-11-08)

### Features

- requiredLabelsToStart config ([5326f20](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/5326f20dbbe3e1a849487bc1d62572ce534fa0da))

### Bug Fixes

- convert AssignedIssueScope to enum ([986261a](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/986261acf7c62ed8f474ea4842fae4acbfe4a92f))
- handle search API private repo ([d8fead7](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/d8fead76df4723c8f387ffbae9314324481eb3a3))
- process review comments ([8fcedd9](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8fcedd9cc4ba3860a50b6835d8b8345cbc27e9f1))
- renamed checkIssues to assignedIssueScope ([87e7b16](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/87e7b16f334f7dec5a1ee34f01b9611b1e120ace))
- undo changes in manifest ([3827d28](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3827d28303a1d36e7668809194f6c9963c2a3140))

## [1.2.0](https://github.com/ubiquity-os-marketplace/command-start-stop/compare/v1.1.1...v1.2.0) (2024-11-04)

### Features

- added admin infinity in decode ([84d4641](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/84d464180badf5ef78443123b81a2b27c44b3e99))
- added validator endpoint ([58b457e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/58b457e5078eba5c2fdc241209781a19c1be3861))
- closing user pull-requests when unassigned ([210d943](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/210d943615aaf0a531b63516a893138c15ec7343))
- enforce collaborator-only label restriction ([413c844](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/413c8442170e4ff8455256dc590d02f81f82a608))
- pull edit handler ([188d00e](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/188d00eb7486fe920c0d800d6d50dd7536818f25))
- pull edit handler ([30959ec](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/30959ec39e4e7567a1d4a8df35900dfb0ca410c7))
- schema generation ([5999073](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/59990739868c2f5a4fb02ce55d3d25b635a36e34))
- **tests:** add collaborator tests for issue assignment ([c5e58f5](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/c5e58f5f24ef96d3a8ba4b7f0d54c34f6a3744a7))

### Bug Fixes

- add fallback methods for fetching issues/PRs ([16ba3a8](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/16ba3a84835b5fc74d882fb4f0f5902491eec57a))
- add rolesWithReviewAuth to config ([9180717](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/9180717d3789da49b43aaf3b68ad78ccd1f3e926))
- change checks for invalid env to get more details ([cc6ccfa](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/cc6ccfac4da89e727bf16f68cd047884399e91d1))
- cleanup merge ([a4df1b9](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/a4df1b99f2839f81dd0fea8334e15265458678ff))
- collaborator check with try catch ([32a4457](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/32a4457e1cbf3597fd9142fa3440cb6233e35998))
- fixed tip display and removed bold ([32082db](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/32082db649a70afb6a4d671a7214985708858330))
- **issue:** handle 404 status in fetch pull request reviews ([82064c5](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/82064c543782138221213a80455e68ba110f625c))
- register warning message change ([8868146](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8868146912b878614467b153b4568becd6e157b2))
- register warning message change ([8dd8463](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/8dd84638b69cc8d2fabf8d5572dfa5155d995d08))
- removed duplicate error messages ([da03c15](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/da03c1504ecc03ebfa7f7cecf51f36b832046470))
- removed duplicate error messages ([3f61f14](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3f61f149c2998d69b6181ad580b40a27e5dfae85))
- **tests:** update error message for collaborators assignment ([4a954be](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/4a954bee3021c6bb4f32271b0ae382ee9bf4b2bd))
- update octokit method namespace ([3d760e3](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/3d760e37911f24c4d61601bc74960d742396b36b))
- using graphql to fetch prs ([c49982b](https://github.com/ubiquity-os-marketplace/command-start-stop/commit/c49982b9b1415d46d0c97739c55046553d8ac2f0))

## [1.1.1](https://github.com/ubiquibot/command-start-stop/compare/v1.1.0...v1.1.1) (2024-09-08)

### Bug Fixes

- fixed /stop formatting ([43244a9](https://github.com/ubiquibot/command-start-stop/commit/43244a92e663e5700816b4ed23de4d9e66b676e3))
- skipping deadline self assign post if no deadline ([ebf98c4](https://github.com/ubiquibot/command-start-stop/commit/ebf98c455278fc8ea21d442ae37bd6d6d6f4f81e))
- the messages are displayed on catch errors ([c79b63f](https://github.com/ubiquibot/command-start-stop/commit/c79b63fa8224012d90c36de488c6c1fed6e5ba77))

## [1.1.0](https://github.com/ubiquibot/command-start-stop/compare/v1.0.0...v1.1.0) (2024-08-28)

### Features

- added worker deploy / delete capabilities ([ee5479d](https://github.com/ubiquibot/command-start-stop/commit/ee5479ddb4357b37a7aa1933ba08752ade4fdd06))
- custom message for private issues without plan ([4342e5f](https://github.com/ubiquibot/command-start-stop/commit/4342e5f24abcfa10cb3e261c7db4130e54d20361))

### Bug Fixes

- hide deadline if no time label ([28ee060](https://github.com/ubiquibot/command-start-stop/commit/28ee0609d8d206799f39365e0b515137f73fa28f))
- startRequiresWallet default true ([7ee8bc3](https://github.com/ubiquibot/command-start-stop/commit/7ee8bc362db89bdbbb11f94bdc7d4b40633575a8))

## 1.0.0 (2024-07-25)

### Features

- workerize ([cf1a6b6](https://github.com/ubiquibot/command-start-stop/commit/cf1a6b6ab7fa33b7204df19473fec94f7d76ba99))

### Bug Fixes

- add config defaults ([bedfb6d](https://github.com/ubiquibot/command-start-stop/commit/bedfb6d876a18c4a78e8c105dc73ad5ae29b3c11))
- better formatting for closed pulls ([6a20875](https://github.com/ubiquibot/command-start-stop/commit/6a2087565ccf85c360653ecbde55323fe83fae3f))
- corrected all issues reported by Knip ([c63579b](https://github.com/ubiquibot/command-start-stop/commit/c63579b364553781931f3c85515a009074c0c5e1))
- enable corepack for knip and fixed release-please.yml ([292a6e7](https://github.com/ubiquibot/command-start-stop/commit/292a6e748e5dbfd89cd5b27041b399ae6e167063))
- logs types ([b2420da](https://github.com/ubiquibot/command-start-stop/commit/b2420da42387b3fc262bf0a60940ed0a0f52a1c2))
- naming convention ([9bdf4c5](https://github.com/ubiquibot/command-start-stop/commit/9bdf4c577569f62963e424665fc3319206fb552e))
- no parsing required ([926c319](https://github.com/ubiquibot/command-start-stop/commit/926c3197fff0976d35d194b62a0e791dbe05deb7))
- optional chain and types ([4095cd3](https://github.com/ubiquibot/command-start-stop/commit/4095cd33922ef25cd62eec062fe58dc4e2b4c7f5))
- parse labels and correct env ([36458ce](https://github.com/ubiquibot/command-start-stop/commit/36458ceca0a4c758c6605a148f161aabbfb415b4))
- pretty logs types ([fd2c198](https://github.com/ubiquibot/command-start-stop/commit/fd2c1982f8555aaf5e03e93a480d636991f2f578))
- readme and const placement ([6fd8d73](https://github.com/ubiquibot/command-start-stop/commit/6fd8d73d2f07b152b6395f34f7e4d841f73351fd))
- readme config ([844b867](https://github.com/ubiquibot/command-start-stop/commit/844b867be17b03e038c7b1216d9eaa0f0479bdc3))
- readme, log type tweaks, tests passing ([bfb71f2](https://github.com/ubiquibot/command-start-stop/commit/bfb71f247f665be8d8549b8ebc310b8ea367fa11))
- remove compute. use ubiquibot token ([8b594bb](https://github.com/ubiquibot/command-start-stop/commit/8b594bbfc2a351dbd2ec20c6ee00f023247e648f))
- remove configs ([7e5fc99](https://github.com/ubiquibot/command-start-stop/commit/7e5fc99ff79d597d123ecbd3c620330f67d2a4da))
- remove unused ([0d41663](https://github.com/ubiquibot/command-start-stop/commit/0d41663e986978ed2bead6cbf67151135e89c521))
- removing helpers previously missed ([b166046](https://github.com/ubiquibot/command-start-stop/commit/b166046fd354af75fdd0052455663e45898993ee))
- return check ([8039369](https://github.com/ubiquibot/command-start-stop/commit/8039369290459b47abffe1345362c4b54f6f503d))
- target ESNEXT ([0dcd243](https://github.com/ubiquibot/command-start-stop/commit/0dcd24329b904c7b050e3f7c2fdaf84c7b48fc4c))
- types and package name ([c484635](https://github.com/ubiquibot/command-start-stop/commit/c4846359fc1e1df23fc56384bfe27d8e3a845841))
- updated jest and knip workflow to work on `pull_request` event instead of target ([e1043b1](https://github.com/ubiquibot/command-start-stop/commit/e1043b10be8dbea7c6f2cfad601df9f0d0762569))
- use Octokit types ([23e748e](https://github.com/ubiquibot/command-start-stop/commit/23e748e4abdf3604b1a05c430209646bf74f4176))
