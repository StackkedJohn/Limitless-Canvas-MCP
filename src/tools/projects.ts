/**
 * Project Tools for Limitless Canvas MCP Server
 *
 * Provides CRUD operations for projects:
 * - list_projects: List all projects in a workspace
 * - get_project: Get detailed project info with tasks
 * - create_project: Create a new project
 * - update_project: Update project details
 * - update_project_progress: Update project completion percentage
 */

import { getSupabase, getDefaultWorkspaceId, validateWorkspaceId, validateProjectId } from '../supabase/client.js';
import type {
  ProjectRow,
  ProjectWithTasks,
  TaskRow,
  ListProjectsInput,
  GetProjectInput,
  CreateProjectInput,
  UpdateProjectInput,
  ToolResult,
  TaskStatus,
} from '../types/index.js';

/**
 * List all projects in a workspace with optional filtering.
 */
export async function listProjects(input: ListProjectsInput): Promise<ToolResult<ProjectRow[]>> {
  const supabase = getSupabase();
  const workspaceId = input.workspace_id || getDefaultWorkspaceId();

  if (!workspaceId) {
    return {
      success: false,
      error: 'workspace_id is required. Either provide it or set DEFAULT_WORKSPACE_ID.',
      code: 'MISSING_WORKSPACE_ID',
    };
  }

  const isValid = await validateWorkspaceId(workspaceId);
  if (!isValid) {
    return {
      success: false,
      error: `Workspace with ID "${workspaceId}" not found.`,
      code: 'WORKSPACE_NOT_FOUND',
    };
  }

  let query = supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (input.status) {
    query = query.eq('status', input.status);
  }

  if (input.limit) {
    query = query.limit(input.limit);
  }

  const { data, error } = await query;

  if (error) {
    return {
      success: false,
      error: `Failed to list projects: ${error.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  return {
    success: true,
    data: data as ProjectRow[],
    message: `Found ${data.length} project(s)`,
  };
}

/**
 * Get detailed information about a specific project.
 * Optionally includes all tasks.
 */
interface ProjectWithTaskCounts extends ProjectWithTasks {
  task_counts: {
    total: number;
    backlog: number;
    todo: number;
    'in-progress': number;
    review: number;
    done: number;
  };
}

export async function getProject(input: GetProjectInput): Promise<ToolResult<ProjectWithTaskCounts | ProjectRow>> {
  const supabase = getSupabase();

  const isValid = await validateProjectId(input.project_id);
  if (!isValid) {
    return {
      success: false,
      error: `Project with ID "${input.project_id}" not found.`,
      code: 'PROJECT_NOT_FOUND',
    };
  }

  if (input.include_tasks !== false) {
    // Default: include tasks
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        tasks (*)
      `)
      .eq('id', input.project_id)
      .single();

    if (error) {
      return {
        success: false,
        error: `Failed to get project: ${error.message}`,
        code: 'DATABASE_ERROR',
      };
    }

    const project = data as ProjectWithTasks;

    // Calculate task counts for convenience
    const taskCounts = {
      total: project.tasks?.length || 0,
      backlog: project.tasks?.filter((t: TaskRow) => t.status === 'backlog').length || 0,
      todo: project.tasks?.filter((t: TaskRow) => t.status === 'todo').length || 0,
      'in-progress': project.tasks?.filter((t: TaskRow) => t.status === 'in-progress').length || 0,
      review: project.tasks?.filter((t: TaskRow) => t.status === 'review').length || 0,
      done: project.tasks?.filter((t: TaskRow) => t.status === 'done').length || 0,
    };

    return {
      success: true,
      data: { ...project, task_counts: taskCounts },
      message: `Project "${project.name}" with ${taskCounts.total} task(s)`,
    };
  } else {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', input.project_id)
      .single();

    if (error) {
      return {
        success: false,
        error: `Failed to get project: ${error.message}`,
        code: 'DATABASE_ERROR',
      };
    }

    return {
      success: true,
      data: data as ProjectRow,
      message: `Project "${data.name}"`,
    };
  }
}

/**
 * Create a new project in a workspace.
 */
export async function createProject(input: CreateProjectInput): Promise<ToolResult<ProjectRow>> {
  const supabase = getSupabase();

  const isValidWorkspace = await validateWorkspaceId(input.workspace_id);
  if (!isValidWorkspace) {
    return {
      success: false,
      error: `Workspace with ID "${input.workspace_id}" not found.`,
      code: 'WORKSPACE_NOT_FOUND',
    };
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: input.workspace_id,
      name: input.name,
      description: input.description || null,
      status: input.status || 'planning',
      priority: input.priority || 'medium',
      progress: 0,
      budget: input.budget || null,
      due_date: input.due_date || null,
      client_id: input.client_id || null,
      estimated_duration_hours: input.estimated_duration_hours || null,
      item_type: 'project',
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      error: `Failed to create project: ${error.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  return {
    success: true,
    data: data as ProjectRow,
    message: `Created project "${data.name}" (ID: ${data.id})`,
  };
}

/**
 * Update an existing project.
 */
export async function updateProject(input: UpdateProjectInput): Promise<ToolResult<ProjectRow>> {
  const supabase = getSupabase();

  const isValid = await validateProjectId(input.project_id);
  if (!isValid) {
    return {
      success: false,
      error: `Project with ID "${input.project_id}" not found.`,
      code: 'PROJECT_NOT_FOUND',
    };
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.status !== undefined) updates.status = input.status;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.progress !== undefined) updates.progress = Math.min(100, Math.max(0, input.progress));
  if (input.budget !== undefined) updates.budget = input.budget;
  if (input.spent !== undefined) updates.spent = input.spent;
  if (input.due_date !== undefined) updates.due_date = input.due_date;

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', input.project_id)
    .select()
    .single();

  if (error) {
    return {
      success: false,
      error: `Failed to update project: ${error.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  return {
    success: true,
    data: data as ProjectRow,
    message: `Updated project "${data.name}"`,
  };
}

/**
 * Update project progress percentage (convenience method).
 */
export async function updateProjectProgress(
  projectId: string,
  progress: number
): Promise<ToolResult<ProjectRow>> {
  return updateProject({
    project_id: projectId,
    progress: Math.min(100, Math.max(0, progress)),
  });
}

/**
 * Calculate project progress based on task completion.
 * Returns a number between 0-100.
 */
export async function calculateProjectProgress(projectId: string): Promise<ToolResult<number>> {
  const supabase = getSupabase();

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('status')
    .eq('project_id', projectId);

  if (error) {
    return {
      success: false,
      error: `Failed to calculate progress: ${error.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  if (!tasks || tasks.length === 0) {
    return {
      success: true,
      data: 0,
      message: 'No tasks in project',
    };
  }

  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const progress = Math.round((completedTasks / tasks.length) * 100);

  return {
    success: true,
    data: progress,
    message: `${completedTasks}/${tasks.length} tasks completed (${progress}%)`,
  };
}

/**
 * Auto-update project progress based on task status.
 * Call this after modifying tasks.
 */
export async function syncProjectProgress(projectId: string): Promise<ToolResult<ProjectRow>> {
  const progressResult = await calculateProjectProgress(projectId);

  if (!progressResult.success) {
    return progressResult as ToolResult<ProjectRow>;
  }

  return updateProjectProgress(projectId, progressResult.data);
}
