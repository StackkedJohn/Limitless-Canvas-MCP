/**
 * Workspace Tools for Limitless Canvas MCP Server
 *
 * Provides operations for workspaces:
 * - list_workspaces: List all accessible workspaces
 * - get_workspace: Get workspace details with summary
 * - get_workspace_summary: Get analytics summary for a workspace
 */

import { getSupabase, validateWorkspaceId } from '../supabase/client.js';
import type {
  WorkspaceRow,
  ProjectRow,
  TaskRow,
  TeamMemberRow,
  ListWorkspacesInput,
  GetWorkspaceInput,
  ToolResult,
} from '../types/index.js';

export interface WorkspaceSummary {
  workspace: WorkspaceRow;
  projects: {
    total: number;
    active: number;
    completed: number;
    planning: number;
    on_hold: number;
  };
  tasks: {
    total: number;
    backlog: number;
    todo: number;
    in_progress: number;
    review: number;
    done: number;
  };
  team_members: number;
  recent_projects: ProjectRow[];
}

/**
 * List all workspaces the service has access to.
 */
export async function listWorkspaces(input: ListWorkspacesInput = {}): Promise<ToolResult<WorkspaceRow[]>> {
  const supabase = getSupabase();

  let query = supabase
    .from('workspaces')
    .select('*')
    .order('updated_at', { ascending: false });

  if (input.limit) {
    query = query.limit(input.limit);
  }

  const { data, error } = await query;

  if (error) {
    return {
      success: false,
      error: `Failed to list workspaces: ${error.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  return {
    success: true,
    data: data as WorkspaceRow[],
    message: `Found ${data.length} workspace(s)`,
  };
}

/**
 * Get detailed workspace information.
 */
export async function getWorkspace(input: GetWorkspaceInput): Promise<ToolResult<WorkspaceRow>> {
  const supabase = getSupabase();

  const isValid = await validateWorkspaceId(input.workspace_id);
  if (!isValid) {
    return {
      success: false,
      error: `Workspace with ID "${input.workspace_id}" not found.`,
      code: 'WORKSPACE_NOT_FOUND',
    };
  }

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', input.workspace_id)
    .single();

  if (error) {
    return {
      success: false,
      error: `Failed to get workspace: ${error.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  return {
    success: true,
    data: data as WorkspaceRow,
    message: `Workspace: "${data.name}"`,
  };
}

/**
 * Get a comprehensive summary of a workspace including project and task counts.
 */
export async function getWorkspaceSummary(workspaceId: string): Promise<ToolResult<WorkspaceSummary>> {
  const supabase = getSupabase();

  // Validate workspace
  const isValid = await validateWorkspaceId(workspaceId);
  if (!isValid) {
    return {
      success: false,
      error: `Workspace with ID "${workspaceId}" not found.`,
      code: 'WORKSPACE_NOT_FOUND',
    };
  }

  // Fetch workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();

  if (wsError || !workspace) {
    return {
      success: false,
      error: `Failed to get workspace: ${wsError?.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  // Fetch projects
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (projError) {
    return {
      success: false,
      error: `Failed to get projects: ${projError.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  // Fetch all tasks for these projects
  const projectIds = projects.map((p: ProjectRow) => p.id);
  let tasks: TaskRow[] = [];

  if (projectIds.length > 0) {
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .in('project_id', projectIds);

    if (taskError) {
      return {
        success: false,
        error: `Failed to get tasks: ${taskError.message}`,
        code: 'DATABASE_ERROR',
      };
    }
    tasks = taskData as TaskRow[];
  }

  // Fetch team members
  const { data: teamMembers, error: teamError } = await supabase
    .from('team_members')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (teamError) {
    return {
      success: false,
      error: `Failed to get team members: ${teamError.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  // Calculate project counts
  const projectCounts = {
    total: projects.length,
    active: projects.filter((p: ProjectRow) => p.status === 'active').length,
    completed: projects.filter((p: ProjectRow) => p.status === 'completed').length,
    planning: projects.filter((p: ProjectRow) => p.status === 'planning').length,
    on_hold: projects.filter((p: ProjectRow) => p.status === 'on-hold').length,
  };

  // Calculate task counts
  const taskCounts = {
    total: tasks.length,
    backlog: tasks.filter((t: TaskRow) => t.status === 'backlog').length,
    todo: tasks.filter((t: TaskRow) => t.status === 'todo').length,
    in_progress: tasks.filter((t: TaskRow) => t.status === 'in-progress').length,
    review: tasks.filter((t: TaskRow) => t.status === 'review').length,
    done: tasks.filter((t: TaskRow) => t.status === 'done').length,
  };

  // Get recent active projects (last 5)
  const recentProjects = projects
    .filter((p: ProjectRow) => p.status === 'active')
    .sort((a: ProjectRow, b: ProjectRow) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 5) as ProjectRow[];

  const summary: WorkspaceSummary = {
    workspace: workspace as WorkspaceRow,
    projects: projectCounts,
    tasks: taskCounts,
    team_members: teamMembers?.length || 0,
    recent_projects: recentProjects,
  };

  return {
    success: true,
    data: summary,
    message: `Workspace "${workspace.name}": ${projectCounts.total} projects, ${taskCounts.total} tasks`,
  };
}

/**
 * Get active work in progress for a workspace.
 * Returns tasks that are currently in-progress or in-review.
 */
export async function getWorkInProgress(workspaceId: string): Promise<ToolResult<TaskRow[]>> {
  const supabase = getSupabase();

  const isValid = await validateWorkspaceId(workspaceId);
  if (!isValid) {
    return {
      success: false,
      error: `Workspace with ID "${workspaceId}" not found.`,
      code: 'WORKSPACE_NOT_FOUND',
    };
  }

  // Get all project IDs in this workspace
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id')
    .eq('workspace_id', workspaceId);

  if (projError) {
    return {
      success: false,
      error: `Failed to get projects: ${projError.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  const projectIds = projects.map((p: { id: string }) => p.id);

  if (projectIds.length === 0) {
    return {
      success: true,
      data: [],
      message: 'No projects in workspace',
    };
  }

  // Get in-progress and review tasks
  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .in('project_id', projectIds)
    .in('status', ['in-progress', 'review'])
    .order('updated_at', { ascending: false });

  if (taskError) {
    return {
      success: false,
      error: `Failed to get tasks: ${taskError.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  return {
    success: true,
    data: tasks as TaskRow[],
    message: `${tasks.length} task(s) in progress or review`,
  };
}
