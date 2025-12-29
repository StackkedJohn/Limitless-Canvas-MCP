# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that connects Claude Code to a Limitless Canvas project management system via Supabase. It enables automated task tracking, project management, and real-time kanban board updates.

## Common Commands

```bash
npm run build      # Compile TypeScript to build/
npm run dev        # Watch mode compilation
npm test           # Run Jest tests (uses --experimental-vm-modules for ESM)
npm run test:watch # Run tests in watch mode
npm start          # Run the built server
```

Run a single test file:
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/types.test.ts
```

## Architecture

### MCP Server Flow
```
Claude Code <--MCP--> index.ts <--tools--> Supabase DB
```

- `src/index.ts`: Main entry point. Registers all 18 MCP tools with the SDK and routes tool calls to handlers. Uses stdio transport.
- `src/supabase/client.ts`: Singleton Supabase client with validation helpers for workspace/project/task IDs.
- `src/tools/`: Tool implementations organized by entity:
  - `workspaces.ts`: Workspace listing and summaries
  - `projects.ts`: Project CRUD with automatic progress calculation
  - `tasks.ts`: Task CRUD with kanban column management

### Key Patterns

**Tool Result Pattern**: All tool functions return `ToolResult<T>` (success with data or error with code):
```typescript
type ToolResult<T> = ToolSuccess<T> | ToolError;
```

**Auto-Progress Sync**: When tasks change status, `syncProjectProgress()` recalculates project completion percentage based on done tasks.

**Validation**: Entity IDs are validated before operations using `validateWorkspaceId()`, `validateProjectId()`, `validateTaskId()`.

**Default Workspace**: If `DEFAULT_WORKSPACE_ID` env var is set, `workspace_id` becomes optional for project operations.

### Database Schema (Supabase)

Three main tables mirroring types in `src/types/index.ts`:
- `workspaces` (id, name, color, owner_id)
- `projects` (id, workspace_id, name, status, priority, progress, budget)
- `tasks` (id, project_id, title, status, priority, assignee, order)

Task statuses: `backlog` | `todo` | `in-progress` | `review` | `done`
Project statuses: `active` | `completed` | `on-hold` | `planning`

## Environment Variables

Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (full DB access)

Optional:
- `DEFAULT_WORKSPACE_ID` - Default workspace when not specified in tool calls

## Testing

Tests use Jest with ESM support and mocked Supabase responses. Test files in `tests/` directory:
- `types.test.ts` - Type validation tests
- `tools.test.ts` - Tool business logic tests with mock data
