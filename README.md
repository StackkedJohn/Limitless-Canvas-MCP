# Limitless Canvas MCP Server

An MCP (Model Context Protocol) server that enables Claude Code to interact with your Limitless Canvas project management system. This allows Claude to automatically track progress, manage tasks, and update projects as you work.

## What This Enables

- **Automatic Progress Tracking**: Claude can move tasks between kanban columns as you work
- **Task Discovery**: When Claude discovers new work, it can create tasks automatically
- **Real-time Sync**: Your Limitless Canvas dashboard updates in real-time as you code
- **Cross-Project Awareness**: Search and navigate tasks across all your projects
- **Zero Manual Updates**: Never update your project board manually again

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Claude Code   │ ◄─MCP──►│  MCP Server      │ ◄─────► │   Supabase DB   │
│   (any project) │         │  (Node.js)       │         │  (Canvas data)  │
└─────────────────┘         └──────────────────┘         └─────────────────┘
       │                            │                             │
       │                            │                             │
   Working on                  Exposes tools:              Your projects
   your code                   - list_projects                & tasks
                               - create_task
                               - move_task
                               - complete_task
                               - search_tasks
                               - etc.
```

## Installation

### Prerequisites

- Node.js 18+
- A Limitless Canvas Supabase project
- Your Supabase service role key (for database access)

### Steps

1. **Clone or copy the MCP server**:
   ```bash
   cd limitless-canvas-mcp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the server**:
   ```bash
   npm run build
   ```

4. **Configure environment variables**:
   Create a `.env` file or set these environment variables:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DEFAULT_WORKSPACE_ID=your-workspace-id  # Optional
   ```

5. **Add to Claude Code MCP settings**:

   **Windows** (`%APPDATA%\Claude\claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "limitless-canvas": {
         "command": "node",
         "args": ["C:/path/to/limitless-canvas-mcp/build/index.js"],
         "env": {
           "SUPABASE_URL": "https://your-project.supabase.co",
           "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
           "DEFAULT_WORKSPACE_ID": "your-workspace-id"
         }
       }
     }
   }
   ```

   **macOS** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "limitless-canvas": {
         "command": "node",
         "args": ["/path/to/limitless-canvas-mcp/build/index.js"],
         "env": {
           "SUPABASE_URL": "https://your-project.supabase.co",
           "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
           "DEFAULT_WORKSPACE_ID": "your-workspace-id"
         }
       }
     }
   }
   ```

6. **Restart Claude Code** to load the MCP server.

## Available Tools

### Workspace Tools

| Tool | Description |
|------|-------------|
| `list_workspaces` | List all accessible workspaces |
| `get_workspace` | Get workspace details |
| `get_workspace_summary` | Get project/task counts and recent activity |
| `get_work_in_progress` | Get all tasks currently being worked on |

### Project Tools

| Tool | Description |
|------|-------------|
| `list_projects` | List projects in a workspace |
| `get_project` | Get project details with all tasks |
| `create_project` | Create a new project |
| `update_project` | Update project details |
| `update_project_progress` | Quick progress percentage update |

### Task Tools

| Tool | Description |
|------|-------------|
| `create_task` | Create a new task |
| `get_task` | Get task details |
| `update_task` | Update task details |
| `move_task` | Move task between columns |
| `start_task` | Move task to "in-progress" |
| `complete_task` | Move task to "done" |
| `review_task` | Move task to "review" |
| `search_tasks` | Search tasks by keyword |
| `list_project_tasks` | List all tasks in a project |
| `delete_task` | Delete a task |

## Usage Examples

### When you start working on a feature:
```
Claude, let's implement the user authentication system.
```

Claude will automatically:
1. Find your project using `list_projects`
2. Look for the relevant task using `search_tasks`
3. Move it to "in-progress" using `start_task`

### When you discover new work:
```
I noticed we need to add password reset functionality.
```

Claude will automatically:
1. Create a new task using `create_task`
2. Set appropriate priority and status

### When you complete work:
```
The login feature is done.
```

Claude will automatically:
1. Mark the task as complete using `complete_task`
2. Project progress updates automatically

## Project Structure

```
limitless-canvas-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── tools/
│   │   ├── projects.ts       # Project CRUD tools
│   │   ├── tasks.ts          # Task CRUD tools
│   │   └── workspaces.ts     # Workspace tools
│   ├── supabase/
│   │   └── client.ts         # Supabase connection
│   └── types/
│       └── index.ts          # TypeScript types
├── tests/
│   ├── types.test.ts         # Type tests
│   └── tools.test.ts         # Tool logic tests
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Running in development:
```bash
npm run dev  # Watch mode for TypeScript
```

### Running tests:
```bash
npm test
```

### Building:
```bash
npm run build
```

## Security Notes

- The server uses the Supabase **service role key** which has full database access
- This key should never be exposed to clients - it's safe here because MCP runs locally
- The server only runs when Claude Code is active
- All database operations are logged to stderr

## Troubleshooting

### "Supabase client not initialized"
Make sure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly.

### "Workspace not found"
Either provide `workspace_id` in the tool call or set `DEFAULT_WORKSPACE_ID`.

### Tools not appearing in Claude
1. Check that the MCP config path is correct
2. Restart Claude Code
3. Check stderr output for errors: `node build/index.js 2>&1`

## Future Enhancements

- [ ] Time tracking integration (`start_timer`, `stop_timer`)
- [ ] Git commit linking (auto-update tasks based on commits)
- [ ] Notifications/webhooks for task changes
- [ ] AI-powered task suggestions

## License

MIT
