# `@ubiquity-os/command-start-stop`

This plugin allows a hunter to begin a task as well as gracefully stop a task without incurring a negative impact on the hunter's XP or karma.

## Technical Architecture

### Overview

- Built as a UbiquityOS plugin using TypeScript
- Reads wallet addresses for users
- Implements a webhook-based event system for GitHub interactions
- Runs as a Cloudflare Worker using Hono for HTTP handling

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

## Usage

### Start a task

To start a task, a hunter should use the `/start` command. This will assign them to the issue so long as the following is true:

- Price labels are set on the issue
- The issue is not already assigned
- The hunter has not reached the maximum number of concurrent tasks
- The command is not disabled at the repository or organization level
- TODO: If the hunter meets the required XP requirements

### Stop a task

To stop a task, a hunter should use the `/stop` command. This will unassign them from the issue so long as the following is true:

- The hunter is assigned to the issue
- The command is not disabled at the repository or organization level
- The command is called on the issue, not the associated pull request

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
        contributor: 1000  # Set to -1 to disable collaborator tasks (only allow core operations)
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

## Technical Dependencies

### Core

- `@ubiquity-os/plugin-sdk`: Core plugin functionality
- `@supabase/supabase-js`: Database operations
- `@octokit/*`: GitHub API integration
- `hono`: Web server framework

### Development

- TypeScript for type safety
- Jest for testing
- ESLint & Prettier for code quality
- Husky for git hooks
- Wrangler for Cloudflare Workers deployment
