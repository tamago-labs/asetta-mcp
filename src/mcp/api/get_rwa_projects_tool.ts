import { z } from "zod";
import { ApiAgent } from "../../agent/api";
import { type McpTool } from "../../types";
import { accessKey } from "../../config";

export const GetRwaProjectsTool: McpTool = {
    name: "asetta_get_rwa_projects",
    description: "Get RWA projects from Asetta platform - either all user projects or a specific project by ID",
    schema: {
        access_key: z.string()
            .optional()
            .describe("Access key for API authentication (optional, uses default from config if not provided)"),
        project_id: z.string()
            .optional()
            .describe("Specific project ID to retrieve (optional, if not provided returns all user projects)")
    },
    handler: async (agent: ApiAgent, input: Record<string, any>) => {
        try {
            // Use provided access_key or fall back to config
            const apiAccessKey = input.access_key || accessKey;
            
            if (!apiAccessKey) {
                throw new Error("Access key is required. Provide it as parameter or set --access_key when starting the agent.");
            }

            const params = new URLSearchParams({
                access_key: apiAccessKey
            });

            if (input.project_id) {
                params.append('project_id', input.project_id);
            }

            const apiUrl = `https://asetta.xyz/api/project?${params.toString()}`;
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData: any = await response.json();
                throw new Error(`API request failed with status ${response.status}: ${errorData.error || response.statusText}`);
            }

            const data: any = await response.json();
            
            return {
                status: "success",
                message: input.project_id 
                    ? "✅ RWA Project retrieved successfully" 
                    : "✅ RWA Projects retrieved successfully",
                projects_data: data.data,
                total_projects: Array.isArray(data.data) ? data.data.length : 1,
                api_endpoint: apiUrl
            };

        } catch (error: any) {
            throw new Error(`Failed to get RWA projects: ${error.message}`);
        }
    }
};

export async function handleGetRwaProjects(args: any) {
    const agent = new ApiAgent();
    return await GetRwaProjectsTool.handler(agent, args);
}
