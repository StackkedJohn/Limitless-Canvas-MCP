/**
 * Task Tools for Limitless Canvas MCP Server
 *
 * Provides CRUD operations for tasks:
 * - create_task: Create a new task in a project
 * - update_task: Update task details
 * - move_task: Move task between kanban columns
 * - complete_task: Mark task as done
 * - start_task: Move task to in-progress
 * - search_tasks: Search tasks by keyword
 * - get_task: Get a single task by ID
 * - delete_task: Delete a task
 */

import { getSupabase, getDefaultWorkspaceId, validateProjectId, validateTaskId } from '../supabase/client.js';
import { syncProjectProgress } from './projects.js';
import type {
  TaskRow,
  TaskWithProject,
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
  SearchTasksInput,
  ToolResult,
  TaskStatus,
} from '../types/index.js';

/**
 * Get the next order number for a task in a project.
 */
async function getNextTaskOrder(projectId: string): Promise<number> {
  const supabase = getSupabase();

  const { data } = await supabase
    .from('tasks')
    .select('order')
    .eq('project_id', projectId)
    .order('order', { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    return (data[0].order || 0) + 1;
  }
  return 0;
}

/**
 * Create a new task in a project.
 */
export async function createTask(input: CreateTaskInput): Promise<ToolResult<TaskRow>> {
  const supabase = getSupabase();

  const isValidProject = await validateProjectId(input.project_id);
  if (!isValidProject) {
    return {
      success: false,
      error: `Project with ID "${input.project_id}" not found.`,
      code: 'PROJECT_NOT_FOUND',
    };
  }

  const now = new Date().toISOString();
  const order = await getNextTaskOrder(input.project_id);

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: input.project_id,
      title: input.title,
      description: input.description || null,
      status: input.status || 'todo',
      priority: input.priority || 'medium',
      assignee: input.assignee || null,
      due_date: input.due_date || null,
      tags: input.tags || null,
      order,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      error: `Failed to create task: ${error.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  // Sync project progress after creating task
  await syncProjectProgress(input.project_id);

  return {
    success: true,
    data: data as TaskRow,
    message: `Created task "${data.title}" in ${input.status || 'todo'} column`,
  };
}

/**
 * Get a single task by ID.
 */
export async function getTask(taskId: string): Promise<ToolResult<TaskWithProject>> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      project:projects (
        id,
        name,
        workspace_id
      )
    `)
    .eq('id', taskId)
    .single();

  if (error) {
    return {
      success: false,
      error: `Task with ID "${taskId}" not found.`,
      code: 'TASK_NOT_FOUND',
    };
  }

  return {
    success: true,
    data: data as TaskWithProject,
    message: `Task: "${data.title}"`,
  };
}

/**
 * Update an existing task.
 */
export async function updateTask(input: UpdateTaskInput): Promise<ToolResult<TaskRow>> {
  const supabase = getSupabase();

  // Get current task to check project_id for progress sync
  const { data: currentTask, error: fetchError } = await supabase
    .from('tasks')
    .select('project_id')
    .eq('id', input.task_id)
    .single();

  if (fetchError || !currentTask) {
    return {
      success: false,
      error: `Task with ID "${input.task_id}" not found.`,
      code: 'TASK_NOT_FOUND',
    };
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.status !== undefined) updates.status = input.status;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.assignee !== undefined) updates.assignee = input.assignee;
  if (input.due_date !== undefined) updates.due_date = input.due_date;
  if (input.tags !== undefined) updates.tags = input.tags;

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', input.task_id)
    .select()
    .single();

  if (error) {
    return {
      success: false,
      error: `Failed to update task: ${error.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  // Sync project progress if status changed
  if (input.status !== undefined) {
    await syncProjectProgress(currentTask.project_id);
  }

  return {
    success: true,
    data: data as TaskRow,
    message: `Updated task "${data.title}"`,
  };
}

/**
 * Move a task to a different kanban column (status).
 */
export async function moveTask(input: MoveTaskInput): Promise<ToolResult<TaskRow>> {
  const supabase = getSupabase();

  // Validate the status
  const validStatuses: TaskStatus[] = ['backlog', 'todo', 'in-progress', 'review', 'done'];
  if (!validStatuses.includes(input.new_status)) {
    return {
      success: false,
      error: `Invalid status "${input.new_status}". Valid statuses: ${validStatuses.join(', ')}`,
      code: 'INVALID_STATUS',
    };
  }

  // Get current task for project_id
  const { data: currentTask, error: fetchError } = await supabase
    .from('tasks')
    .select('project_id, title, status')
    .eq('id', input.task_id)
    .single();

  if (fetchError || !currentTask) {
    return {
      success: false,
      error: `Task with ID "${input.task_id}" not found.`,
      code: 'TASK_NOT_FOUND',
    };
  }

  const previousStatus = currentTask.status;

  const { data, error } = await supabase
    .from('tasks')
    .update({
      status: input.new_status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.task_id)
    .select()
    .single();

  if (error) {
    return {
      success: false,
      error: `Failed to move task: ${error.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  // Sync project progress
  await syncProjectProgress(currentTask.project_id);

  return {
    success: true,
    data: data as TaskRow,
    message: `Moved "${data.title}" from ${previousStatus} → ${input.new_status}`,
  };
}

/**
 * Mark a task as complete (done).
 */
export async function completeTask(taskId: string): Promise<ToolResult<TaskRow>> {
  return moveTask({ task_id: taskId, new_status: 'done' });
}

/**
 * Start working on a task (move to in-progress).
 */
export async function startTask(taskId: string): Promise<ToolResult<TaskRow>> {
  return moveTask({ task_id: taskId, new_status: 'in-progress' });
}

/**
 * Move a task to review.
 */
export async function reviewTask(taskId: string): Promise<ToolResult<TaskRow>> {
  return moveTask({ task_id: taskId, new_status: 'review' });
}

/**
 * Search for tasks by keyword.
 */
export async function searchTasks(input: SearchTasksInput): Promise<ToolResult<TaskWithProject[]>> {
  const supabase = getSupabase();

  let query = supabase
    .from('tasks')
    .select(`
      *,
      project:projects (
        id,
        name,
        workspace_id
      )
    `)
    .or(`title.ilike.%${input.query}%,description.ilike.%${input.query}%`);

  // Filter by project if provided
  if (input.project_id) {
    query = query.eq('project_id', input.project_id);
  }

  // Filter by workspace if provided (through project relationship)
  if (input.workspace_id) {
    query = query.eq('project.workspace_id', input.workspace_id);
  }

  // Filter by status if provided
  if (input.status) {
    query = query.eq('status', input.status);
  }

  // Apply limit
  query = query.limit(input.limit || 20);

  // Order by updated_at
  query = query.order('updated_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    return {
      success: false,
      error: `Failed to search tasks: ${error.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  // Filter out tasks where the project filter didn't match (due to Supabase join behavior)
  const filteredData = input.workspace_id
    ? data.filter((t: any) => t.project && t.project.workspace_id === input.workspace_id)
    : data;

  return {
    success: true,
    data: filteredData as TaskWithProject[],
    message: `Found ${filteredData.length} task(s) matching "${input.query}"`,
  };
}

/**
 * Delete a task.
 */
export async function deleteTask(taskId: string): Promise<ToolResult<{ deleted: boolean }>> {
  const supabase = getSupabase();

  // Get project_id first for progress sync
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('project_id, title')
    .eq('id', taskId)
    .single();

  if (fetchError || !task) {
    return {
      success: false,
      error: `Task with ID "${taskId}" not found.`,
      code: 'TASK_NOT_FOUND',
    };
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    return {
      success: false,
      error: `Failed to delete task: ${error.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  // Sync project progress after deletion
  await syncProjectProgress(task.project_id);

  return {
    success: true,
    data: { deleted: true },
    message: `Deleted task "${task.title}"`,
  };
}

/**
 * List tasks for a project with optional status filter.
 */
export async function listProjectTasks(
  projectId: string,
  status?: TaskStatus
): Promise<ToolResult<TaskRow[]>> {
  const supabase = getSupabase();

  const isValid = await validateProjectId(projectId);
  if (!isValid) {
    return {
      success: false,
      error: `Project with ID "${projectId}" not found.`,
      code: 'PROJECT_NOT_FOUND',
    };
  }

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('order', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return {
      success: false,
      error: `Failed to list tasks: ${error.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  return {
    success: true,
    data: data as TaskRow[],
    message: `Found ${data.length} task(s)${status ? ` in ${status}` : ''}`,
  };
}
