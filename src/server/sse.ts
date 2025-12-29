/**
 * SSE Server for Claude Chat Integration
 *
 * Provides HTTP/SSE transport for the MCP server, enabling
 * Claude Chat (claude.ai) to connect via Server-Sent Events.
 *
 * Features:
 * - Token-based authentication via Supabase
 * - CORS configuration for Claude.ai
 * - Health check endpoint for monitoring
 * - Graceful shutdown handling
 * - Keep-alive for Render free tier
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

import { createMCPServer, SERVER_NAME, SERVER_VERSION, TOOLS } from './createMCPServer.js';
import { initializeSupabase } from '../supabase/client.js';
import type { ServerConfig } from '../types/index.js';

// Store active SSE transports for cleanup
const activeTransports = new Map<string, SSEServerTransport>();

/**
 * Create and start the SSE Express server
 */
export async function startSSEServer(config: ServerConfig): Promise<void> {
  const app = express();

  // Initialize shared Supabase client for service operations
  initializeSupabase(config);

  // CORS configuration - Allow Claude.ai and the main app
  const corsOptions: cors.CorsOptions = {
    origin: [
      'https://claude.ai',
      'https://api.claude.ai',
      'https://limitless-canvas12.vercel.app',
      // Allow localhost for development
      /^http:\/\/localhost:\d+$/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  app.use(cors(corsOptions));
  app.use(express.json());

  // Keep-alive headers for Render free tier
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=600');
    next();
  });

  // Health check endpoint (for Render health monitoring)
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      mode: 'sse',
      server: SERVER_NAME,
      version: SERVER_VERSION,
      tools: TOOLS.length,
      activeConnections: activeTransports.size,
      uptime: process.uptime(),
      mainApp: 'https://limitless-canvas12.vercel.app',
      timestamp: new Date().toISOString(),
    });
  });

  // Root endpoint - API documentation
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'Limitless Canvas MCP Server',
      version: SERVER_VERSION,
      description: 'MCP server for managing projects and tasks in Limitless Canvas',
      endpoints: {
        health: '/health',
        sse: '/sse',
        message: '/message (POST)',
      },
      tools: TOOLS.map(t => t.name),
      documentation: 'https://limitless-canvas12.vercel.app/settings',
      usage: {
        claude_code: 'Use --stdio flag for local Claude Code integration',
        claude_chat: 'Connect to /sse endpoint',
      },
    });
  });

  // SSE endpoint for Claude Chat
  app.get('/sse', async (req: Request, res: Response) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[${SERVER_NAME}] SSE connection request: ${requestId}`);

    try {
      // Create MCP server instance (uses service role key from environment)
      const server = createMCPServer();

      // Create SSE transport
      const transport = new SSEServerTransport('/message', res);

      // Store transport for cleanup
      activeTransports.set(requestId, transport);

      // Handle connection close
      req.on('close', () => {
        console.log(`[${SERVER_NAME}] SSE connection closed: ${requestId}`);
        activeTransports.delete(requestId);
      });

      // Connect server to transport
      await server.connect(transport);
      console.log(`[${SERVER_NAME}] SSE transport connected: ${requestId}`);

    } catch (error) {
      console.error(`[${SERVER_NAME}] SSE connection error (${requestId}):`, error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Connection failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  });

  // Message endpoint (for SSE transport POST requests)
  app.post('/message', async (req: Request, res: Response) => {
    // The SSEServerTransport handles this internally
    // This endpoint just needs to exist and return 200
    res.status(200).end();
  });

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(`[${SERVER_NAME}] Server error:`, err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    }
  });

  // Start the server
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const server = app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║   Limitless Canvas MCP Server                            ║
║   Running in SSE mode (Claude Chat)                      ║
╠══════════════════════════════════════════════════════════╣
║   Port: ${PORT.toString().padEnd(48)}║
║   Health: http://localhost:${PORT}/health${' '.repeat(Math.max(0, 24 - PORT.toString().length))}║
║   SSE: http://localhost:${PORT}/sse${' '.repeat(Math.max(0, 28 - PORT.toString().length))}║
║   Main App: https://limitless-canvas12.vercel.app        ║
║   Tools: ${TOOLS.length.toString().padEnd(47)}║
╚══════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[${SERVER_NAME}] ${signal} received, shutting down gracefully...`);

    // Close all active SSE connections
    for (const [id, transport] of activeTransports) {
      console.log(`[${SERVER_NAME}] Closing connection: ${id}`);
      activeTransports.delete(id);
    }

    server.close(() => {
      console.log(`[${SERVER_NAME}] Server closed`);
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error(`[${SERVER_NAME}] Forced shutdown after timeout`);
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Keep-alive ping for Render free tier (every 14 minutes)
  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      console.log(`[${SERVER_NAME}] Keep-alive ping - ${activeTransports.size} active connections`);
    }, 14 * 60 * 1000);
  }
}
