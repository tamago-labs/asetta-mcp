import { z } from "zod";
import { ApiAgent } from "../../agent/api";
import { type McpTool } from "../../types";
import { accessKey } from "../../config";

export const GetProfileTool: McpTool = {
    name: "asetta_get_profile",
    description: "Get user profile information from Asetta API",
    schema: {
        access_key: z.string()
            .optional()
            .describe("Access key for API authentication (optional, uses default from config if not provided)")
    },
    handler: async (agent: ApiAgent, input: Record<string, any>) => {
        try {
            // Use provided access_key or fall back to config
            const apiAccessKey = input.access_key || accessKey;

            if (!apiAccessKey) {
                throw new Error("Access key is required. Provide it as parameter or set --access_key when starting the agent.");
            }

            const apiUrl = `https://www.asetta.xyz/api/profile?access_key=${apiAccessKey}`;

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            return {
                status: "success",
                message: "✅ Profile information retrieved successfully",
                profile_data: data,
                api_endpoint: apiUrl
            };

        } catch (error: any) {
            throw new Error(`Failed to get profile: ${error.message}`);
        }
    }
};

export async function handleGetProfile(args: any) {
    const agent = new ApiAgent();
    return await GetProfileTool.handler(agent, args);
}
