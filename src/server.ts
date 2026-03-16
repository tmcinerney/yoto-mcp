import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { handleAccounts, handleAuth, handleAuthComplete } from './tools/auth.js';
import { handleCreateCard, handleDeleteCard, handleUpdateCard } from './tools/content.js';
import { handleListDevices } from './tools/devices.js';
import { handleListIcons } from './tools/icons.js';
import { handleGetCard, handleListCards } from './tools/library.js';
import { handleUploadAudio } from './tools/media.js';
import type { ToolContext } from './tools/shared.js';
import { toolError } from './tools/shared.js';

// AIDEV-NOTE: Zod shapes used as MCP inputSchema — each key becomes a tool parameter
const AccountParam = {
  account: z.string().optional().describe('Account ID (uses default if omitted)'),
};

export function createServer(ctx?: ToolContext): McpServer {
  const server = new McpServer({
    name: 'yoto-mcp',
    version: '0.1.0',
  });

  if (!ctx) return server;

  // --- Auth tools ---

  server.registerTool(
    'yoto_auth',
    {
      description:
        'Start device code flow for a Yoto account. Returns a verification URL and user code. After the user authorizes in their browser, call yoto_auth_complete with the user_code to finish.',
    },
    async () => {
      return handleAuth(ctx.store, ctx.authConfig);
    },
  );

  server.registerTool(
    'yoto_auth_complete',
    {
      description:
        'Complete the device code auth flow after the user has authorized in their browser. Requires the user_code from yoto_auth.',
      inputSchema: {
        userCode: z.string().describe('The user_code returned by yoto_auth'),
      },
    },
    async (args) => {
      return handleAuthComplete(ctx.store, ctx.authConfig, args);
    },
  );

  server.registerTool(
    'yoto_accounts',
    {
      description: 'List, switch default, or remove authenticated Yoto accounts.',
      inputSchema: {
        action: z.enum(['list', 'switch', 'remove']).describe('Action to perform'),
        accountId: z.string().optional().describe('Account ID (required for switch/remove)'),
      },
    },
    async (args) => {
      return handleAccounts(ctx.store, args);
    },
  );

  // --- Library tools ---

  server.registerTool(
    'yoto_list_cards',
    {
      description: 'List all MYO cards for the active Yoto account.',
      inputSchema: AccountParam,
    },
    async (args) => {
      const result = await ctx.getSdk(args.account);
      if ('error' in result) return toolError(result.error);
      return handleListCards(result.sdk);
    },
  );

  server.registerTool(
    'yoto_get_card',
    {
      description: 'Get full card details including chapters and tracks.',
      inputSchema: {
        cardId: z.string().describe('The card ID to retrieve'),
        ...AccountParam,
      },
    },
    async (args) => {
      const result = await ctx.getSdk(args.account);
      if ('error' in result) return toolError(result.error);
      return handleGetCard(result.sdk, args.cardId);
    },
  );

  // --- Content tools ---

  server.registerTool(
    'yoto_create_card',
    {
      description: 'Create a new MYO card with metadata.',
      inputSchema: {
        title: z.string().describe('Card title'),
        author: z.string().optional().describe('Card author'),
        category: z.string().optional().describe('Card category'),
        description: z.string().optional().describe('Card description'),
        ...AccountParam,
      },
    },
    async (args) => {
      const result = await ctx.getSdk(args.account);
      if ('error' in result) return toolError(result.error);
      return handleCreateCard(result.sdk, args);
    },
  );

  server.registerTool(
    'yoto_update_card',
    {
      description:
        'Update a MYO card content (add/remove/reorder tracks). Pass card as a JSON string.',
      inputSchema: {
        cardId: z.string().describe('The card ID to update'),
        cardJson: z.string().describe('Full YotoJson card object as a JSON string'),
        ...AccountParam,
      },
    },
    async (args) => {
      const result = await ctx.getSdk(args.account);
      if ('error' in result) return toolError(result.error);
      try {
        const card = JSON.parse(args.cardJson);
        return handleUpdateCard(result.sdk, { cardId: args.cardId, card });
      } catch {
        return toolError('Invalid JSON in cardJson parameter');
      }
    },
  );

  server.registerTool(
    'yoto_delete_card',
    {
      description: 'Delete a MYO card.',
      inputSchema: {
        cardId: z.string().describe('The card ID to delete'),
        ...AccountParam,
      },
      annotations: { destructiveHint: true },
    },
    async (args) => {
      const result = await ctx.getSdk(args.account);
      if ('error' in result) return toolError(result.error);
      return handleDeleteCard(result.sdk, args.cardId);
    },
  );

  // --- Media tools ---

  server.registerTool(
    'yoto_upload_audio',
    {
      description:
        'Upload an audio file to Yoto. Handles hash, presigned URL, upload, and transcode polling.',
      inputSchema: {
        filePath: z.string().describe('Absolute path to the audio file'),
        filename: z
          .string()
          .optional()
          .describe('Override filename (defaults to basename of filePath)'),
        ...AccountParam,
      },
    },
    async (args) => {
      const result = await ctx.getSdk(args.account);
      if ('error' in result) return toolError(result.error);
      return handleUploadAudio(result.sdk, args);
    },
  );

  // --- Device tools ---

  server.registerTool(
    'yoto_list_devices',
    {
      description: 'List Yoto player devices for the active account.',
      inputSchema: AccountParam,
    },
    async (args) => {
      const result = await ctx.getSdk(args.account);
      if ('error' in result) return toolError(result.error);
      return handleListDevices(result.sdk);
    },
  );

  // --- Icon tools ---

  server.registerTool(
    'yoto_list_icons',
    {
      description: 'List available display icons for Yoto cards.',
      inputSchema: AccountParam,
    },
    async (args) => {
      const result = await ctx.getSdk(args.account);
      if ('error' in result) return toolError(result.error);
      return handleListIcons(result.sdk);
    },
  );

  return server;
}
