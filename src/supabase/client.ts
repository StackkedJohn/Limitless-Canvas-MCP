/**
 * Supabase Client for MCP Server
 *
 * Uses service role key for full database access.
 * This is safe because the MCP server runs locally and
 * only Claude Code has access to it.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ServerConfig } from '../types/index.js';

let supabaseInstance: SupabaseClient | null = null;
let currentConfig: ServerConfig | null = null;

/**
 * Initialize the Supabase client with the provided configuration.
 * Must be called before any database operations.
 */
export function initializeSupabase(config: ServerConfig): SupabaseClient {
  if (!config.supabaseUrl) {
    throw new Error('SUPABASE_URL is required');
  }
  if (!config.supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  supabaseInstance = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  currentConfig = config;
  return supabaseInstance;
}

/**
 * Get the initialized Supabase client.
 * Throws if client hasn't been initialized.
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    throw new Error('Supabase client not initialized. Call initializeSupabase() first.');
  }
  return supabaseInstance;
}

/**
 * Get the current server configuration.
 */
export function getConfig(): ServerConfig | null {
  return currentConfig;
}

/**
 * Get the default workspace ID from config.
 */
export function getDefaultWorkspaceId(): string | undefined {
  return currentConfig?.defaultWorkspaceId;
}

/**
 * Check if a workspace ID is valid (exists in database).
 */
export async function validateWorkspaceId(workspaceId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .single();

  return !error && !!data;
}

/**
 * Check if a project ID is valid (exists in database).
 */
export async function validateProjectId(projectId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();

  return !error && !!data;
}

/**
 * Check if a task ID is valid (exists in database).
 */
export async function validateTaskId(taskId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .single();

  return !error && !!data;
}
