#!/usr/bin/env node
/**
 * Limitless Canvas MCP Server
 *
 * This MCP server enables Claude Code to interact with your Limitless Canvas
 * project management system. It provides tools to:
 *
 * - List and manage projects
 * - Create, update, and move tasks between kanban columns
 * - Track project progress automatically
 * - Search for tasks across workspaces
 *
 * Usage:
 *   Set environment variables:
 *     SUPABASE_URL - Your Supabase project URL
 *     SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key
 *     DEFAULT_WORKSPACE_ID - (Optional) Default workspace to use
 *
 *   Run the server:
 *     node build/index.js
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import { initializeSupabase } from './supabase/client.js';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  updateProjectProgress,
} from './tools/projects.js';
import {
  createTask,
  getTask,
  updateTask,
  moveTask,
  completeTask,
  startTask,
  reviewTask,
  searchTasks,
  deleteTask,
  listProjectTasks,
} from './tools/tasks.js';
import {
  listWorkspaces,
  getWorkspace,
  getWorkspaceSummary,
  getWorkInProgress,
} from './tools/workspaces.js';

import type { ToolResult } from './types/index.js';

// ============================================================================
// Server Configuration
// ============================================================================

const SERVER_NAME = 'limitless-canvas';
const SERVER_VERSION = '1.0.0';

// Load configuration from environment
const config = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  defaultWorkspaceId: process.env.DEFAULT_WORKSPACE_ID,
};

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS = [
  // Workspace Tools
  {
    name: 'list_workspaces',
    description: 'List all workspaces accessible to the service. Returns workspace names, IDs, and colors.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of workspaces to return',
        },
      },
    },
  },
  {
    name: 'get_workspace',
    description: 'Get details about a specific workspace by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'string',
          description: 'The workspace ID',
        },
      },
      required: ['workspace_id'],
    },
  },
  {
    name: 'get_workspace_summary',
    description: 'Get a comprehensive summary of a workspace including project counts, task counts by status, team size, and recent active projects.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'string',
          description: 'The workspace ID',
        },
      },
      required: ['workspace_id'],
    },
  },
  {
    name: 'get_work_in_progress',
    description: 'Get all tasks currently in-progress or in-review for a workspace. Useful for understanding current work.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'string',
          description: 'The workspace ID',
        },
      },
      required: ['workspace_id'],
    },
  },

  // Project Tools
  {
    name: 'list_projects',
    description: 'List all projects in a workspace. Use this to see what projects exist and their current status.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'string',
          description: 'Workspace ID (optional if DEFAULT_WORKSPACE_ID is set)',
        },
        status: {
          type: 'string',
          enum: ['active', 'completed', 'on-hold', 'planning'],
          description: 'Filter by project status',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of projects to return',
        },
      },
    },
  },
  {
    name: 'get_project',
    description: 'Get detailed information about a specific project including all its tasks organized by status.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID',
        },
        include_tasks: {
          type: 'boolean',
          description: 'Whether to include tasks (default: true)',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'create_project',
    description: 'Create a new project in a workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'string',
          description: 'The workspace ID to create the project in',
        },
        name: {
          type: 'string',
          description: 'Project name',
        },
        description: {
          type: 'string',
          description: 'Project description',
        },
        status: {
          type: 'string',
          enum: ['active', 'completed', 'on-hold', 'planning'],
          description: 'Initial project status (default: planning)',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Project priority (default: medium)',
        },
        budget: {
          type: 'number',
          description: 'Project budget',
        },
        due_date: {
          type: 'string',
          description: 'Due date in ISO format (e.g., 2024-12-31)',
        },
        estimated_duration_hours: {
          type: 'number',
          description: 'Estimated hours to complete',
        },
      },
      required: ['workspace_id', 'name'],
    },
  },
  {
    name: 'update_project',
    description: 'Update project details like name, description, status, priority, or progress.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to update',
        },
        name: { type: 'string', description: 'New project name' },
        description: { type: 'string', description: 'New description' },
        status: {
          type: 'string',
          enum: ['active', 'completed', 'on-hold', 'planning'],
          description: 'New status',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'New priority',
        },
        progress: {
          type: 'number',
          description: 'Progress percentage (0-100)',
        },
        budget: { type: 'number', description: 'New budget' },
        spent: { type: 'number', description: 'Amount spent' },
        due_date: { type: 'string', description: 'New due date' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'update_project_progress',
    description: 'Quick way to update just the project progress percentage.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID',
        },
        progress: {
          type: 'number',
          description: 'Progress percentage (0-100)',
        },
      },
      required: ['project_id', 'progress'],
    },
  },

  // Task Tools
  {
    name: 'create_task',
    description: 'Create a new task in a project. Use when discovering new work that needs to be done.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to add the task to',
        },
        title: {
          type: 'string',
          description: 'Task title',
        },
        description: {
          type: 'string',
          description: 'Task description with details',
        },
        status: {
          type: 'string',
          enum: ['backlog', 'todo', 'in-progress', 'review', 'done'],
          description: 'Initial status (default: todo)',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Task priority (default: medium)',
        },
        assignee: {
          type: 'string',
          description: 'Assignee name or ID',
        },
        due_date: {
          type: 'string',
          description: 'Due date in ISO format',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
      },
      required: ['project_id', 'title'],
    },
  },
  {
    name: 'get_task',
    description: 'Get detailed information about a specific task.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'update_task',
    description: 'Update task details like title, description, priority, or due date.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID to update',
        },
        title: { type: 'string', description: 'New title' },
        description: { type: 'string', description: 'New description' },
        status: {
          type: 'string',
          enum: ['backlog', 'todo', 'in-progress', 'review', 'done'],
          description: 'New status',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'New priority',
        },
        assignee: { type: 'string', description: 'New assignee' },
        due_date: { type: 'string', description: 'New due date' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'New tags',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'move_task',
    description: 'Move a task to a different kanban column (status). Use this when task status changes.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID to move',
        },
        new_status: {
          type: 'string',
          enum: ['backlog', 'todo', 'in-progress', 'review', 'done'],
          description: 'The new status/column',
        },
      },
      required: ['task_id', 'new_status'],
    },
  },
  {
    name: 'start_task',
    description: 'Start working on a task (moves to in-progress). Use when beginning implementation.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID to start',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as complete (moves to done). Use when finishing implementation.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID to complete',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'review_task',
    description: 'Move a task to review status. Use when implementation is done and needs review.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID to review',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'search_tasks',
    description: 'Search for tasks by keyword across projects. Useful for finding related work.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (searches title and description)',
        },
        workspace_id: {
          type: 'string',
          description: 'Limit search to specific workspace',
        },
        project_id: {
          type: 'string',
          description: 'Limit search to specific project',
        },
        status: {
          type: 'string',
          enum: ['backlog', 'todo', 'in-progress', 'review', 'done'],
          description: 'Filter by status',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 20)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_project_tasks',
    description: 'List all tasks in a project, optionally filtered by status.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID',
        },
        status: {
          type: 'string',
          enum: ['backlog', 'todo', 'in-progress', 'review', 'done'],
          description: 'Filter by status',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task. Use with caution.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID to delete',
        },
      },
      required: ['task_id'],
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    // Workspace Tools
    case 'list_workspaces':
      return listWorkspaces({ limit: args.limit as number | undefined });

    case 'get_workspace':
      return getWorkspace({ workspace_id: args.workspace_id as string });

    case 'get_workspace_summary':
      return getWorkspaceSummary(args.workspace_id as string);

    case 'get_work_in_progress':
      return getWorkInProgress(args.workspace_id as string);

    // Project Tools
    case 'list_projects':
      return listProjects({
        workspace_id: args.workspace_id as string | undefined,
        status: args.status as any,
        limit: args.limit as number | undefined,
      });

    case 'get_project':
      return getProject({
        project_id: args.project_id as string,
        include_tasks: args.include_tasks as boolean | undefined,
      });

    case 'create_project':
      return createProject({
        workspace_id: args.workspace_id as string,
        name: args.name as string,
        description: args.description as string | undefined,
        status: args.status as any,
        priority: args.priority as any,
        budget: args.budget as number | undefined,
        due_date: args.due_date as string | undefined,
        estimated_duration_hours: args.estimated_duration_hours as number | undefined,
      });

    case 'update_project':
      return updateProject({
        project_id: args.project_id as string,
        name: args.name as string | undefined,
        description: args.description as string | undefined,
        status: args.status as any,
        priority: args.priority as any,
        progress: args.progress as number | undefined,
        budget: args.budget as number | undefined,
        spent: args.spent as number | undefined,
        due_date: args.due_date as string | undefined,
      });

    case 'update_project_progress':
      return updateProjectProgress(
        args.project_id as string,
        args.progress as number
      );

    // Task Tools
    case 'create_task':
      return createTask({
        project_id: args.project_id as string,
        title: args.title as string,
        description: args.description as string | undefined,
        status: args.status as any,
        priority: args.priority as any,
        assignee: args.assignee as string | undefined,
        due_date: args.due_date as string | undefined,
        tags: args.tags as string[] | undefined,
      });

    case 'get_task':
      return getTask(args.task_id as string);

    case 'update_task':
      return updateTask({
        task_id: args.task_id as string,
        title: args.title as string | undefined,
        description: args.description as string | undefined,
        status: args.status as any,
        priority: args.priority as any,
        assignee: args.assignee as string | undefined,
        due_date: args.due_date as string | undefined,
        tags: args.tags as string[] | undefined,
      });

    case 'move_task':
      return moveTask({
        task_id: args.task_id as string,
        new_status: args.new_status as any,
      });

    case 'start_task':
      return startTask(args.task_id as string);

    case 'complete_task':
      return completeTask(args.task_id as string);

    case 'review_task':
      return reviewTask(args.task_id as string);

    case 'search_tasks':
      return searchTasks({
        query: args.query as string,
        workspace_id: args.workspace_id as string | undefined,
        project_id: args.project_id as string | undefined,
        status: args.status as any,
        limit: args.limit as number | undefined,
      });

    case 'list_project_tasks':
      return listProjectTasks(
        args.project_id as string,
        args.status as any
      );

    case 'delete_task':
      return deleteTask(args.task_id as string);

    default:
      return {
        success: false,
        error: `Unknown tool: ${name}`,
        code: 'UNKNOWN_TOOL',
      };
  }
}

// ============================================================================
// Server Setup
// ============================================================================

async function main() {
  // Validate configuration
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
    console.error('');
    console.error('Set these environment variables:');
    console.error('  SUPABASE_URL=https://your-project.supabase.co');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
    console.error('  DEFAULT_WORKSPACE_ID=your-workspace-id (optional)');
    process.exit(1);
  }

  // Initialize Supabase client
  try {
    initializeSupabase(config);
    console.error(`[${SERVER_NAME}] Supabase client initialized`);
  } catch (error) {
    console.error(`[${SERVER_NAME}] Failed to initialize Supabase:`, error);
    process.exit(1);
  }

  // Create MCP server
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: { listChanged: true } } }
  );

  // Register tool listing handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;

    console.error(`[${SERVER_NAME}] Tool called: ${name}`);

    try {
      const result = await handleToolCall(name, args as Record<string, unknown>);

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: result.message,
                  data: result.data,
                },
                null,
                2
              ),
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: result.error,
                  code: result.code,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      console.error(`[${SERVER_NAME}] Error handling tool ${name}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                code: 'INTERNAL_ERROR',
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[${SERVER_NAME}] MCP server running on stdio`);
  console.error(`[${SERVER_NAME}] ${TOOLS.length} tools available`);
  if (config.defaultWorkspaceId) {
    console.error(`[${SERVER_NAME}] Default workspace: ${config.defaultWorkspaceId}`);
  }
}

// Run the server
main().catch((error) => {
  console.error(`[${SERVER_NAME}] Fatal error:`, error);
  process.exit(1);
});
