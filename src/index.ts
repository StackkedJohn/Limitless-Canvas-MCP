#!/usr/bin/env node
/**
 * Limitless Canvas MCP Server
 *
 * A dual-transport MCP server that enables both Claude Code and Claude Chat
 * to interact with your Limitless Canvas project management system.
 *
 * Transport Modes:
 * - STDIO (default with --stdio flag): For Claude Code (local)
 * - SSE (default without flag): For Claude Chat (web) via HTTP/SSE
 *
 * Usage:
 *   STDIO mode (Claude Code):
 *     node build/index.js --stdio
 *
 *   SSE mode (Claude Chat):
 *     node build/index.js
 *     # Then connect via: https://your-server.onrender.com/sse?token=YOUR_TOKEN
 *
 * Environment Variables:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key
 *   DEFAULT_WORKSPACE_ID - (Optional) Default workspace to use
 *   PORT - (Optional) Port for SSE server (default: 3000)
 */

import 'dotenv/config';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initializeSupabase } from './supabase/client.js';
import { createMCPServer, SERVER_NAME, SERVER_VERSION, TOOLS } from './server/createMCPServer.js';
import { startSSEServer } from './server/sse.js';
import type { ServerConfig } from './types/index.js';

// ============================================================================
// Configuration
// ============================================================================

const config: ServerConfig = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  defaultWorkspaceId: process.env.DEFAULT_WORKSPACE_ID,
};

/**
 * Validate required environment variables
 */
function validateConfig(): boolean {
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    console.error(`[${SERVER_NAME}] Error: Missing required environment variables.`);
    console.error('');
    console.error('Required environment variables:');
    console.error('  SUPABASE_URL=https://your-project.supabase.co');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
    console.error('');
    console.error('Optional:');
    console.error('  DEFAULT_WORKSPACE_ID=your-workspace-id');
    console.error('  PORT=3000 (for SSE mode)');
    return false;
  }
  return true;
}

// ============================================================================
// STDIO Mode (Claude Code)
// ============================================================================

async function runStdioMode(): Promise<void> {
  console.error(`[${SERVER_NAME}] Starting in STDIO mode (Claude Code)...`);

  if (!validateConfig()) {
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
  const server = createMCPServer();

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[${SERVER_NAME}] MCP server running on stdio`);
  console.error(`[${SERVER_NAME}] Version: ${SERVER_VERSION}`);
  console.error(`[${SERVER_NAME}] ${TOOLS.length} tools available`);
  if (config.defaultWorkspaceId) {
    console.error(`[${SERVER_NAME}] Default workspace: ${config.defaultWorkspaceId}`);
  }
}

// ============================================================================
// SSE Mode (Claude Chat)
// ============================================================================

async function runSSEMode(): Promise<void> {
  console.error(`[${SERVER_NAME}] Starting in SSE mode (Claude Chat)...`);

  if (!validateConfig()) {
    process.exit(1);
  }

  // Start SSE server
  await startSSEServer(config);
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const isStdioMode = process.argv.includes('--stdio');

  if (isStdioMode) {
    await runStdioMode();
  } else {
    await runSSEMode();
  }
}

// Run the server
main().catch((error) => {
  console.error(`[${SERVER_NAME}] Fatal error:`, error);
  process.exit(1);
});
