/**
 * Type Tests for Limitless Canvas MCP Server
 *
 * These tests verify that our type definitions are correct and
 * match the expected Supabase schema.
 */

import type {
  TaskStatus,
  TaskPriority,
  ProjectStatus,
  ProjectPriority,
  TaskRow,
  ProjectRow,
  WorkspaceRow,
  ToolSuccess,
  ToolError,
  ToolResult,
} from '../src/types/index.js';

describe('Type Definitions', () => {
  describe('TaskStatus', () => {
    it('should have valid task status values', () => {
      const validStatuses: TaskStatus[] = ['backlog', 'todo', 'in-progress', 'review', 'done'];
      expect(validStatuses).toHaveLength(5);
    });
  });

  describe('TaskPriority', () => {
    it('should have valid task priority values', () => {
      const validPriorities: TaskPriority[] = ['low', 'medium', 'high', 'critical'];
      expect(validPriorities).toHaveLength(4);
    });
  });

  describe('ProjectStatus', () => {
    it('should have valid project status values', () => {
      const validStatuses: ProjectStatus[] = ['active', 'completed', 'on-hold', 'planning'];
      expect(validStatuses).toHaveLength(4);
    });
  });

  describe('ProjectPriority', () => {
    it('should have valid project priority values', () => {
      const validPriorities: ProjectPriority[] = ['low', 'medium', 'high', 'critical'];
      expect(validPriorities).toHaveLength(4);
    });
  });

  describe('TaskRow', () => {
    it('should have required properties', () => {
      const task: TaskRow = {
        id: 'test-id',
        project_id: 'project-id',
        title: 'Test Task',
        description: null,
        status: 'todo',
        priority: 'medium',
        assignee: null,
        due_date: null,
        tags: null,
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(task.id).toBeDefined();
      expect(task.project_id).toBeDefined();
      expect(task.title).toBeDefined();
      expect(task.status).toBeDefined();
      expect(task.priority).toBeDefined();
    });
  });

  describe('ProjectRow', () => {
    it('should have required properties', () => {
      const project: ProjectRow = {
        id: 'test-id',
        workspace_id: 'workspace-id',
        name: 'Test Project',
        description: null,
        status: 'active',
        priority: 'medium',
        progress: 0,
        budget: null,
        spent: null,
        due_date: null,
        client_id: null,
        team_size: null,
        item_type: 'project',
        estimated_duration_hours: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(project.id).toBeDefined();
      expect(project.workspace_id).toBeDefined();
      expect(project.name).toBeDefined();
      expect(project.status).toBeDefined();
      expect(project.progress).toBeDefined();
    });
  });

  describe('WorkspaceRow', () => {
    it('should have required properties', () => {
      const workspace: WorkspaceRow = {
        id: 'test-id',
        name: 'Test Workspace',
        color: '#8B5CF6',
        logo: null,
        owner_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(workspace.id).toBeDefined();
      expect(workspace.name).toBeDefined();
      expect(workspace.color).toBeDefined();
    });
  });

  describe('ToolResult', () => {
    it('should handle success results', () => {
      const success: ToolSuccess<string> = {
        success: true,
        data: 'test data',
        message: 'Success message',
      };

      expect(success.success).toBe(true);
      expect(success.data).toBe('test data');
    });

    it('should handle error results', () => {
      const error: ToolError = {
        success: false,
        error: 'Something went wrong',
        code: 'TEST_ERROR',
      };

      expect(error.success).toBe(false);
      expect(error.error).toBe('Something went wrong');
      expect(error.code).toBe('TEST_ERROR');
    });

    it('should be a union type for success', () => {
      const result: ToolResult<string> = {
        success: true,
        data: 'test',
      };

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test');
      }
    });

    it('should be a union type for error', () => {
      const result: ToolResult<string> = {
        success: false,
        error: 'Test error',
        code: 'TEST_ERROR',
      };

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Test error');
      }
    });
  });
});
