/**
 * Example: MCP Server with paid tools on Sui testnet
 *
 * This demonstrates how to create an MCP server where tools require
 * x402 payment on Sui before execution.
 *
 * Usage:
 *   bun run examples/mcp-server.ts
 *
 * The server exposes a "search" tool that requires 0.01 USDC payment
 * on Sui testnet before returning results.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { z } from "zod";
import { registerExactSuiScheme } from "../src/exact/server/register.js";
import { createSuiPaymentWrapper } from "../src/mcp/server.js";

// --- Configuration ---
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:4020";
const PAY_TO_ADDRESS =
  process.env.PAY_TO_ADDRESS ??
  "0x0000000000000000000000000000000000000000000000000000000000000001";

async function main() {
  // 1. Set up the x402 resource server with Sui scheme
  const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
  const resourceServer = new x402ResourceServer(facilitator);
  registerExactSuiScheme(resourceServer, { networks: ["sui:testnet"] });
  await resourceServer.initialize();

  // 2. Create a payment wrapper for Sui testnet
  const paid = createSuiPaymentWrapper(resourceServer, {
    accepts: [
      {
        scheme: "exact",
        network: "sui:testnet",
        payTo: PAY_TO_ADDRESS,
        price: 0.01,
        description: "Premium search query",
      },
    ],
    resource: {
      url: "tool://search",
      description: "Premium search with AI-powered results",
      mimeType: "application/json",
    },
  });

  // 3. Create and configure the MCP server
  const mcpServer = new McpServer({
    name: "x402-sui-example",
    version: "1.0.0",
  });

  // 4. Register a paid tool
  mcpServer.tool(
    "search",
    "Premium AI-powered search (requires 0.01 USDC on Sui testnet)",
    { query: z.string().describe("Search query") },
    paid(async (args: { query: string }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            query: args.query,
            results: [
              { title: "Result 1", snippet: "First search result..." },
              { title: "Result 2", snippet: "Second search result..." },
            ],
          }),
        },
      ],
    })),
  );

  // 5. Register a free tool (no payment wrapper)
  mcpServer.tool("ping", "Health check (free)", {}, async () => ({
    content: [{ type: "text" as const, text: "pong" }],
  }));

  // 6. Connect via stdio transport
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

main().catch(console.error);
