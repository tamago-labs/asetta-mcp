#!/usr/bin/env node

import { validateEnvironment } from "./config"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WalletAgent } from "./agent/wallet"
import { ApiAgent } from "./agent/api"
import { AsettaWalletTools, AsettaApiTools } from "./mcp"
import { agentMode } from "./config"

/**
 * Creates an MCP server for RWA project creation on Asetta.xyz
 */
function createMcpServer(agent: WalletAgent | ApiAgent) {

    // Create MCP server instance
    const server = new McpServer({
        name: "asetta-mcp",
        version: "0.1.0"
    });

    const finalTools = agentMode === "tokenization" ? AsettaWalletTools : AsettaApiTools;

    // Register all tools
    for (const [_key, tool] of Object.entries(finalTools)) {
        server.tool(tool.name, tool.description, tool.schema, async (params: any): Promise<any> => {
            try {
                // Execute the handler with the params directly
                const result = await tool.handler(agent, params);

                // Format the result as MCP tool response
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            } catch (error) {
                console.error("Tool execution error:", error);
                // Handle errors in MCP format
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: error instanceof Error
                                ? error.message
                                : "Unknown error occurred",
                        },
                    ],
                };
            }
        });
    }

    return server;
}

async function main() {
    try {
        console.error("🎨 Starting Asetta MCP Server...");

        // Validate environment before proceeding
        validateEnvironment();

        // Create Asetta agent 
        const asettaAgent = agentMode === "tokenization" ? new WalletAgent() : new ApiAgent()

        // Create and start MCP server
        const server = createMcpServer(asettaAgent);
        const transport = new StdioServerTransport();
        await server.connect(transport);

        console.error("✅ Asetta MCP Server is running!");

    } catch (error) {
        console.error('❌ Error starting Asetta MCP server:', error);
        process.exit(1);
    }
}

main();