import { z } from "zod";
import { ApiAgent } from "../../agent/api";
import { type McpTool } from "../../types";
import { accessKey } from "../../config";

export const CreateRwaProjectTool: McpTool = {
    name: "asetta_create_rwa_project",
    description: "Create a new RWA (Real World Asset) project on Asetta platform",
    schema: {
        access_key: z.string()
            .optional()
            .describe("Access key for API authentication (optional, uses default from config if not provided)"),
        // Required fields
        name: z.string()
            .describe("Project name (e.g., 'Tokyo Shibuya Prime Office Tower')"),
        type: z.string()
            .describe("Asset type (e.g., 'Commercial Office Building')"),
        category: z.enum([
            "COMMERCIAL", "RESIDENTIAL", "MIXED_USE", "INDUSTRIAL", "RETAIL",
            "TREASURY", "CORPORATE_BOND", "MUNICIPAL_BOND", "GOVERNMENT_BOND",
            "PRECIOUS_METALS", "ENERGY", "AGRICULTURE", "INDUSTRIAL_METALS"
        ]).describe("Asset category"),
        location: z.string()
            .describe("Asset location (e.g., 'Shibuya District, Tokyo, Japan')"),
        totalAssetValue: z.string()
            .describe("Total asset value in USD (e.g., '12500000')"),
        tokenPrice: z.string()
            .describe("Price per token in USD (e.g., '100')"),
        totalTokens: z.string()
            .describe("Total number of tokens (e.g., '125000')"),
        minimumInvestment: z.string()
            .describe("Minimum investment amount in USD (e.g., '1000')"),
        
        // Optional fields
        status: z.enum(["PREPARE", "ACTIVE", "LAUNCHING_SOON", "COMPLETED", "PAUSED", "CANCELLED"])
            .optional()
            .describe("Project status"),
        buildingSize: z.string()
            .optional()
            .describe("Building size (e.g., '8 floors, 15,000 sq ft total')"),
        yearBuilt: z.string()
            .optional()
            .describe("Year built (e.g., '2018')"),
        occupancyRate: z.string()
            .optional()
            .describe("Occupancy rate percentage (e.g., '95%')"),
        monthlyRentalIncome: z.string()
            .optional()
            .describe("Monthly rental income in USD (e.g., '85000')"),
        keyTenants: z.string()
            .optional()
            .describe("Key tenants description (e.g., 'Tech startups, consulting firms, creative agencies')"),
        previewImage: z.string()
            .optional()
            .describe("Preview image URL"),
        images: z.array(z.string())
            .optional()
            .describe("Array of image URLs")
    },
    handler: async (agent: ApiAgent, input: Record<string, any>) => {
        try { 
            // Use provided access_key or fall back to config
            const apiAccessKey = input.access_key || accessKey;
            
            if (!apiAccessKey) {
                throw new Error("Access key is required. Provide it as parameter or set --access_key when starting the agent.");
            }

            const apiUrl = "https://www.asetta.xyz/api/project";  
            
            const requestBody = {
                accessKey: apiAccessKey,
                ...input
            };
 
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData: any = await response.json();
                throw new Error(`API request failed with status ${response.status}: ${errorData.error || response.statusText}`);
            }

            const data: any = await response.json();
            
            return {
                status: "success",
                message: "✅ RWA Project created successfully",
                project_data: data.project,
                api_endpoint: apiUrl,
                next_steps: [
                    "📋 Project created in AWS Amplify database with status 'PREPARE'",
                    "🔄 Next: Switch to tokenization agent to deploy smart contracts",
                    "⚡ Run: asetta_create_rwa_token with blockchain parameters",
                    "📊 Then: Use asetta_update_project_status to link contracts and set status to 'ACTIVE'",
                    "🎯 Finally: Your RWA project will be fully tokenized and ready for investors"
                ]
            };

        } catch (error: any) {
            throw new Error(`Failed to create RWA project: ${error.message}`);
        }
    }
};

export async function handleCreateRwaProject(args: any) {
    const agent = new ApiAgent();
    return await CreateRwaProjectTool.handler(agent, args);
}
