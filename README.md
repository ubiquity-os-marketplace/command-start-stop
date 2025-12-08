# `@ubiquity-os/command-start-stop`

This plugin allows a hunter to begin a task as well as gracefully stop a task without incurring a negative impact on the hunter's XP or karma.

## Technical Architecture

### Overview

- Built as a UbiquityOS plugin using TypeScript
- Reads wallet addresses for users
- Implements a webhook-based event system for GitHub interactions
- Provides a REST API for programmatic access to task operations
- Runs as a Cloudflare Worker using Hono for HTTP handling
- Supports JWT authentication and rate limiting for API access

### Core Components

#### 1. Plugin System

The plugin is built on the `@ubiquity-os/plugin-sdk` and handles:

- GitHub webhook event processing
- Command parsing and validation
- Error handling with automatic comment posting
- Environment configuration validation
- Signature verification for security

#### 2. Database Layer

- Reads wallet addresses for users
- Implements database adapters in `src/adapters/supabase/`

#### 3. Event Handling

Processes multiple GitHub webhook events:

- `issue_comment.created`: Handles `/start` and `/stop` commands
- `issues.assigned`: Manages self-assignments
- `pull_request.opened/edited`: Links PRs to issues
- `issues.unassigned`: Cleanup for unassigned tasks

#### 4. Command Processing

Two main commands with complex validation:

- `/start`: Task assignment flow
  - Validates price labels
  - Checks assignment availability
  - Verifies user task limits
  - Validates XP requirements
  - Handles wallet requirements
- `/stop`: Task completion flow
  - Verifies current assignment
  - Manages PR associations
  - Handles unassignment cleanup

#### 5. Security & Authorization

- Command-level role checks
- Repository and organization-level command controls
- Wallet verification when required
- Review authority validation

#### 6. Public API

The plugin exposes a REST API for external integrations:

- **Authentication**: JWT-based authentication using Supabase tokens
- **Rate Limiting**: Per-user limits using Cloudflare KV or Deno KV storage
- **CORS Support**: Configurable cross-origin resource sharing
- **Dual Modes**: Validate-only (GET) and execute (POST) operations
- **Error Handling**: Structured JSON responses with detailed error messages

## Usage

### Start a task

To start a task, a hunter should use the `/start` command. This will assign them to the issue so long as the following is true:

- Price labels are set on the issue
- The issue is not already assigned
- The hunter has not reached the maximum number of concurrent tasks
- The command is not disabled at the repository or organization level
- The contributor's GitHub account meets the minimum age requirement (default: 365.25 days)
- The contributor has sufficient XP for the task's priority level (if configured)
- The contributor has set their wallet address (if required)

### Stop a task

To stop a task, a hunter should use the `/stop` command. This will unassign them from the issue so long as the following is true:

- The hunter is assigned to the issue
- The command is not disabled at the repository or organization level
- The command is called on the issue, not the associated pull request

## Public API

The plugin provides a REST API endpoint for programmatic access to task eligibility checking and assignment functionality. This allows external applications to integrate with the start/stop workflow.

### Endpoint

**Base URL**: `/start`

### Authentication

All API requests require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

The JWT token should be obtained from Supabase authentication.

### Response

**Example Response:**

```json
{
  ok: boolean;
  errors: LogReturn[] | null;
  warnings: LogReturn[] | null;
  computed: {
    deadline: string | null;
    isTaskStale: boolean | null;
    wallet: string | null;
    toAssign: string[];
    assignedIssues: AssignedIssue[];
    consideredCount: number;
    senderRole: ReturnType<typeof getTransformedRole>;
  };
};
```

### Methods

#### GET `/start` (Validate Mode)

Validates task eligibility without performing assignment.

**Query Parameters:**

- `userId` (required): GitHub user ID (numeric)
- `issueUrl` (required): Full GitHub issue URL

**Example Request:**

```bash
GET /start?userId=123456&issueUrl=https://github.com/owner/repo/issues/1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...
```

#### POST `/start` (Execute Mode)

Validates eligibility and performs task assignment.

**Request Body:**

```json
{
  "userId": 123456,
  "issueUrl": "https://github.com/owner/repo/issues/1"
}
```

**Example Request:**

```bash
POST /start
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...

{
  "userId": 123456,
  "issueUrl": "https://github.com/owner/repo/issues/1"
}
```

### Rate Limiting

- **Validate mode (GET)**: 10 requests per minute per user
- **Execute mode (POST)**: 3 requests per minute per user

Rate limited responses include:

```json
{
  "ok": false,
  "reasons": ["RateLimit: exceeded"],
  "resetAt": 1703123456789
}
```

### CORS Support

The API supports CORS for cross-origin requests. Configure allowed origins via the `PUBLIC_API_ALLOWED_ORIGINS` environment variable.

### Development and Testing Notes

Contributors working on this API are likely to also be working on `work.ubq.fi`. If so, they should set up their own `devpool-directory` and integrate it properly. Otherwise, the system will attempt to create an Octokit instance through their GitHub app (kernel app) using ubiquity/partner issues, which will fail since the app is not installed on those repositories.

To successfully QA this API as a contributor:

- Only use `issueUrl` parameters that belong to repositories where your GitHub app is installed
- This can be achieved by hardcoding URLs on the client side or when creating request payloads
- Use repositories within your own organizations or test repositories where the app has been properly installed

Failure to use properly accessible repositories will result in `repoOctokit` instantiation failures. While this doesn't block functionality in development environments (as long as appropriate workarounds are implemented), it prevents proper testing of the full integration workflow.

### [Configuration](./src/types/plugin-input.ts)

#### Note: The command name is `"start"` when configuring your `.ubiquity-os.config.yml` file.

To configure your Ubiquity Kernel to run this plugin, add the following to the `.ubiquity-os.config.yml` file in your organization configuration repository.

```yml
- plugin: http://localhost:4000 # or the URL where the plugin is hosted
  id: start-stop-command
  with:
    reviewDelayTolerance: "3 Days"
    taskStaleTimeoutDuration: "30 Days"
    maxConcurrentTasks: # Default concurrent task limits per role.
      collaborator: 5
      contributor: 3
    startRequiresWallet: true # default is true
    assignedIssueScope: "org" # or "org" or "network". Default is org
    emptyWalletText: "Please set your wallet address with the /wallet command first and try again."
    rolesWithReviewAuthority: ["MEMBER", "OWNER"]
    requiredLabelsToStart:
      - name: "Priority: 5 (Emergency)"
        allowedRoles: ["contributor", "collaborator"]
    taskAccessControl:
      usdPriceMax:
        collaborator: 5000
        contributor: 1000 # Set to -1 to disable contributor tasks (only allow core operations)
      accountRequiredAge:
        minimumDays: 365.25 # Default: 365.25 days (1 year)
      experience:
        priorityThresholds:
          - label: "Priority: 0 (Regression)"
            minimumXp: -2000
          - label: "Priority: 1 (Normal)"
            minimumXp: -1000
          - label: "Priority: 2 (Medium)"
            minimumXp: 0
          - label: "Priority: 3 (High)"
            minimumXp: 1000
          - label: "Priority: 4 (Urgent)"
            minimumXp: 2000
          - label: "Priority: 5 (Emergency)"
            minimumXp: 3000
```

## Development

### Environment Setup

1. Node.js >=20.10.0 is required
2. Copy `.dev.vars.example` to `.dev.vars` and configure environment variables
3. Install dependencies with `bun install`

### Local Development

Run the worker locally:

```bash
bun run worker
```

### Testing

#### Jest Tests

Run the full test suite:

```bash
bun run test
```

### Code Quality

The project includes several quality tools:

- ESLint for code linting
- Prettier for code formatting
- CSpell for spell checking
- Knip for dependency checking
- Husky for git hooks

Run all formatting:

```bash
bun run format
```

## Environment Variables

### Required

- `APP_ID`: GitHub App ID
- `APP_PRIVATE_KEY`: GitHub App private key
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase service role key
- `BOT_USER_ID`: Bot's GitHub user ID
- `KERNEL_PUBLIC_KEY`: Public key for webhook signature verification

### Optional

- `LOG_LEVEL`: Logging level (default: INFO)
- `XP_SERVICE_BASE_URL`: XP service URL (default: https://os-daemon-xp.ubq.fi)
- `PUBLIC_API_ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS (default: localhost in dev)
- `RATE_LIMIT_KV`: Cloudflare KV namespace binding for rate limiting (optional, falls back to in-memory)
- `NODE_ENV`: Environment mode (development, production, test)

## Technical Dependencies

### Core

- `@ubiquity-os/plugin-sdk`: Core plugin functionality
- `@supabase/supabase-js`: Database operations
- `@octokit/*`: GitHub API integration
- `hono`: Web server framework

### Developer Tooling

- TypeScript for type safety
- Jest for testing
- ESLint & Prettier for code quality
- Husky for git hooks
- Wrangler for Cloudflare Workers deployment
