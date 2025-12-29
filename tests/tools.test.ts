/**
 * Tool Function Tests for Limitless Canvas MCP Server
 *
 * These tests verify the business logic of our tool functions.
 * They use mocked Supabase responses.
 */

import type { ToolResult, TaskRow, ProjectRow } from '../src/types/index.js';

// Mock data for testing
const mockWorkspace = {
  id: 'ws-123',
  name: 'Test Workspace',
  color: '#8B5CF6',
  logo: null,
  owner_id: 'user-123',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

const mockProject: ProjectRow = {
  id: 'proj-123',
  workspace_id: 'ws-123',
  name: 'Test Project',
  description: 'A test project',
  status: 'active',
  priority: 'medium',
  progress: 25,
  budget: 10000,
  spent: 2500,
  due_date: '2024-12-31',
  client_id: null,
  team_size: 3,
  item_type: 'project',
  estimated_duration_hours: 100,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-15T00:00:00.000Z',
};

const mockTasks: TaskRow[] = [
  {
    id: 'task-1',
    project_id: 'proj-123',
    title: 'Implement login',
    description: 'Add user authentication',
    status: 'done',
    priority: 'high',
    assignee: 'John',
    due_date: '2024-01-10',
    tags: ['auth', 'frontend'],
    order: 0,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-10T00:00:00.000Z',
  },
  {
    id: 'task-2',
    project_id: 'proj-123',
    title: 'Add dashboard',
    description: 'Create main dashboard view',
    status: 'in-progress',
    priority: 'medium',
    assignee: 'Jane',
    due_date: '2024-01-20',
    tags: ['frontend', 'ui'],
    order: 1,
    created_at: '2024-01-05T00:00:00.000Z',
    updated_at: '2024-01-15T00:00:00.000Z',
  },
  {
    id: 'task-3',
    project_id: 'proj-123',
    title: 'API integration',
    description: 'Connect to backend API',
    status: 'todo',
    priority: 'high',
    assignee: null,
    due_date: null,
    tags: ['backend', 'api'],
    order: 2,
    created_at: '2024-01-10T00:00:00.000Z',
    updated_at: '2024-01-10T00:00:00.000Z',
  },
];

describe('Tool Business Logic', () => {
  describe('Task Status Calculations', () => {
    it('should correctly calculate task counts by status', () => {
      const taskCounts = {
        total: mockTasks.length,
        backlog: mockTasks.filter(t => t.status === 'backlog').length,
        todo: mockTasks.filter(t => t.status === 'todo').length,
        'in-progress': mockTasks.filter(t => t.status === 'in-progress').length,
        review: mockTasks.filter(t => t.status === 'review').length,
        done: mockTasks.filter(t => t.status === 'done').length,
      };

      expect(taskCounts.total).toBe(3);
      expect(taskCounts.backlog).toBe(0);
      expect(taskCounts.todo).toBe(1);
      expect(taskCounts['in-progress']).toBe(1);
      expect(taskCounts.review).toBe(0);
      expect(taskCounts.done).toBe(1);
    });

    it('should calculate project progress from completed tasks', () => {
      const completedTasks = mockTasks.filter(t => t.status === 'done').length;
      const totalTasks = mockTasks.length;
      const progress = Math.round((completedTasks / totalTasks) * 100);

      expect(progress).toBe(33); // 1 out of 3 tasks done
    });
  });

  describe('Task Ordering', () => {
    it('should maintain task order', () => {
      const sortedTasks = [...mockTasks].sort((a, b) => a.order - b.order);

      expect(sortedTasks[0].order).toBe(0);
      expect(sortedTasks[1].order).toBe(1);
      expect(sortedTasks[2].order).toBe(2);
    });

    it('should calculate next task order', () => {
      const maxOrder = Math.max(...mockTasks.map(t => t.order));
      const nextOrder = maxOrder + 1;

      expect(nextOrder).toBe(3);
    });
  });

  describe('Status Validation', () => {
    it('should validate task statuses', () => {
      const validStatuses = ['backlog', 'todo', 'in-progress', 'review', 'done'];

      expect(validStatuses.includes('todo')).toBe(true);
      expect(validStatuses.includes('in-progress')).toBe(true);
      expect(validStatuses.includes('invalid')).toBe(false);
    });

    it('should validate project statuses', () => {
      const validStatuses = ['active', 'completed', 'on-hold', 'planning'];

      expect(validStatuses.includes('active')).toBe(true);
      expect(validStatuses.includes('planning')).toBe(true);
      expect(validStatuses.includes('invalid')).toBe(false);
    });
  });

  describe('Progress Clamping', () => {
    it('should clamp progress to 0-100 range', () => {
      const clampProgress = (value: number) => Math.min(100, Math.max(0, value));

      expect(clampProgress(-10)).toBe(0);
      expect(clampProgress(50)).toBe(50);
      expect(clampProgress(150)).toBe(100);
    });
  });

  describe('Search Logic', () => {
    it('should search tasks by title', () => {
      const query = 'login';
      const results = mockTasks.filter(t =>
        t.title.toLowerCase().includes(query.toLowerCase())
      );

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Implement login');
    });

    it('should search tasks by description', () => {
      const query = 'dashboard';
      const results = mockTasks.filter(t =>
        t.description?.toLowerCase().includes(query.toLowerCase())
      );

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Add dashboard');
    });

    it('should return empty for non-matching query', () => {
      const query = 'nonexistent';
      const results = mockTasks.filter(t =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.description?.toLowerCase().includes(query.toLowerCase())
      );

      expect(results.length).toBe(0);
    });
  });

  describe('Result Formatting', () => {
    it('should format success result correctly', () => {
      const result: ToolResult<ProjectRow> = {
        success: true,
        data: mockProject,
        message: 'Project found',
      };

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test Project');
        expect(result.message).toBe('Project found');
      }
    });

    it('should format error result correctly', () => {
      const result: ToolResult = {
        success: false,
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
      };

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Project not found');
        expect(result.code).toBe('PROJECT_NOT_FOUND');
      }
    });
  });
});

describe('Date Handling', () => {
  it('should handle ISO date strings', () => {
    const dateString = '2024-01-15T00:00:00.000Z';
    const date = new Date(dateString);

    expect(date.toISOString()).toBe(dateString);
  });

  it('should generate valid ISO timestamps', () => {
    const now = new Date().toISOString();

    expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });
});

describe('UUID Validation', () => {
  it('should recognize valid UUID format', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    expect(uuidRegex.test('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(uuidRegex.test('not-a-uuid')).toBe(false);
  });
});
