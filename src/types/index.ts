/**
 * Limitless Canvas MCP Server Types
 *
 * These types are derived from the Supabase database schema and match
 * the Limitless Canvas frontend application types.
 */

// ============================================================================
// Database Enums
// ============================================================================

export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type ProjectStatus = 'active' | 'completed' | 'on-hold' | 'planning';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';
export type ProjectItemType = 'project' | 'task' | 'quick_task';

// ============================================================================
// Database Row Types (from Supabase)
// ============================================================================

export interface WorkspaceRow {
  id: string;
  name: string;
  color: string;
  logo: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  progress: number;
  budget: number | null;
  spent: number | null;
  due_date: string | null;
  client_id: string | null;
  team_size: number | null;
  item_type: ProjectItemType;
  estimated_duration_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  due_date: string | null;
  tags: string[] | null;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberRow {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  department: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API Response Types (enriched with relationships)
// ============================================================================

export interface ProjectWithTasks extends ProjectRow {
  tasks: TaskRow[];
}

export interface ProjectWithTaskCounts extends ProjectRow {
  task_counts: {
    total: number;
    backlog: number;
    todo: number;
    in_progress: number;
    review: number;
    done: number;
  };
}

export interface TaskWithProject extends TaskRow {
  project: {
    id: string;
    name: string;
    workspace_id: string;
  };
}

// ============================================================================
// Tool Input Types
// ============================================================================

export interface ListProjectsInput {
  workspace_id?: string;
  status?: ProjectStatus;
  limit?: number;
}

export interface GetProjectInput {
  project_id: string;
  include_tasks?: boolean;
}

export interface CreateProjectInput {
  workspace_id: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  budget?: number;
  due_date?: string;
  client_id?: string;
  estimated_duration_hours?: number;
}

export interface UpdateProjectInput {
  project_id: string;
  name?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  progress?: number;
  budget?: number;
  spent?: number;
  due_date?: string;
}

export interface CreateTaskInput {
  project_id: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  due_date?: string;
  tags?: string[];
}

export interface UpdateTaskInput {
  task_id: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  due_date?: string;
  tags?: string[];
}

export interface MoveTaskInput {
  task_id: string;
  new_status: TaskStatus;
}

export interface SearchTasksInput {
  query: string;
  workspace_id?: string;
  project_id?: string;
  status?: TaskStatus;
  limit?: number;
}

export interface ListWorkspacesInput {
  limit?: number;
}

export interface GetWorkspaceInput {
  workspace_id: string;
}

// ============================================================================
// Tool Result Types
// ============================================================================

export interface ToolSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ToolError {
  success: false;
  error: string;
  code?: string;
}

export type ToolResult<T = unknown> = ToolSuccess<T> | ToolError;

// ============================================================================
// Configuration
// ============================================================================

export interface ServerConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  defaultWorkspaceId?: string;
}
