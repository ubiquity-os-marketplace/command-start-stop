# `@ubiquibot/command-start-stop`

This plugin allows a hunter to begin a task as well as gracefully stop a task without incurring a negative impact on the hunter's XP or karma.

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

#### Note: The command name is `"start"` when configuring your `.ubiquibot-config.yml` file.

To configure your Ubiquibot to run this plugin, add the following to the `.ubiquibot-config.yml` file in your organization configuration repository.

```yml
- plugin: http://localhost:4000 # or the URL where the plugin is hosted
  name: start-stop
  id: start-stop-command
  description: "Allows a user to start/stop a task without negative XP impact"
  command: "\/start|\/stop"
  example: "/start" # or "/stop"
  with:
    reviewDelayTolerance: "3 Days"
    taskStaleTimeoutDuration: "30 Days"
    maxConcurrentTasks: 3
    startRequiresWallet: true # default is true
```

# Testing

### Jest

To run the Jest test suite, run the following command:

```bash
yarn test
```
