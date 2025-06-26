import { z } from "zod";
import { ApiAgent } from "../../agent/api";
import { type McpTool } from "../../types";
import { accessKey } from "../../config";

const CreateRwaProjectSchema = z.object({
    access_key: z.string().optional().describe("Access key for API authentication (optional, uses default from config if not provided)"),
    // Required fields
    name: z.string().describe("Project name"),
    type: z.string().describe("Asset type (e.g., 'Commercial Real Estate', 'Treasury Bond', 'Gold Commodity')"),
    location: z.string().describe("Asset location"),
    value: z.string().describe("Asset value"),
    tokenPrice: z.string().describe("Price per token"),
    category: z.enum([
        "COMMERCIAL", "RESIDENTIAL", "MIXED_USE", "INDUSTRIAL", "RETAIL",
        "TREASURY", "CORPORATE_BOND", "MUNICIPAL_BOND", "GOVERNMENT_BOND",
        "PRECIOUS_METALS", "ENERGY", "AGRICULTURE", "INDUSTRIAL_METALS"
    ]).describe("Asset category"),
    // Optional fields
    status: z.enum(["PREPARE", "ACTIVE", "LAUNCHING_SOON", "COMPLETED", "PAUSED", "CANCELLED"]).optional().describe("Project status"),
    yieldRate: z.string().optional().describe("Expected yield rate"),
    occupancy: z.string().optional().describe("Occupancy rate (for real estate)"),
    totalTokens: z.string().optional().describe("Total number of tokens"),
    previewImage: z.string().optional().describe("Preview image URL"),
    images: z.array(z.string()).optional().describe("Array of image URLs"),
    // Asset-specific fields
    yearBuilt: z.string().optional().describe("Year built (for real estate)"),
    squareFootage: z.string().optional().describe("Square footage (for real estate)"),
    maturityDate: z.string().optional().describe("Maturity date (for bonds)"),
    couponRate: z.number().optional().describe("Coupon rate (for bonds)"),
    creditRating: z.string().optional().describe("Credit rating (for bonds)"),
    commodityGrade: z.string().optional().describe("Commodity grade"),
    storageLocation: z.string().optional().describe("Storage location (for physical commodities)"),
    // Metadata and requirements
    assetMetadata: z.record(z.any()).optional().describe("Additional asset metadata"),
    kycRequirements: z.record(z.any()).optional().describe("KYC requirements"),
    requiredKycLevel: z.enum(["BASIC", "ENHANCED", "INSTITUTIONAL"]).optional().describe("Required KYC level"),
    jurisdiction: z.string().optional().describe("Legal jurisdiction"),
    regulatoryFramework: z.string().optional().describe("Regulatory framework"),
    minimumInvestment: z.string().optional().describe("Minimum investment amount"),
    maximumInvestment: z.string().optional().describe("Maximum investment amount"),
    investorRestrictions: z.array(z.string()).optional().describe("Investor restrictions")
});

export const CreateRwaProjectTool: McpTool = {
    name: "asetta_create_rwa_project",
    description: "Create a new RWA (Real World Asset) project on Asetta platform",
    schema: {
        type: "object",
        properties: {
            access_key: {
                type: "string",
                description: "Access key for API authentication (optional, uses default from config if not provided)"
            },
            name: {
                type: "string",
                description: "Project name"
            },
            type: {
                type: "string",
                description: "Asset type (e.g., 'Commercial Real Estate', 'Treasury Bond', 'Gold Commodity')"
            },
            location: {
                type: "string",
                description: "Asset location"
            },
            value: {
                type: "string",
                description: "Asset value"
            },
            tokenPrice: {
                type: "string",
                description: "Price per token"
            },
            category: {
                type: "string",
                enum: [
                    "COMMERCIAL", "RESIDENTIAL", "MIXED_USE", "INDUSTRIAL", "RETAIL",
                    "TREASURY", "CORPORATE_BOND", "MUNICIPAL_BOND", "GOVERNMENT_BOND",
                    "PRECIOUS_METALS", "ENERGY", "AGRICULTURE", "INDUSTRIAL_METALS"
                ],
                description: "Asset category"
            },
            status: {
                type: "string",
                enum: ["PREPARE", "ACTIVE", "LAUNCHING_SOON", "COMPLETED", "PAUSED", "CANCELLED"],
                description: "Project status"
            },
            yieldRate: {
                type: "string",
                description: "Expected yield rate"
            },
            occupancy: {
                type: "string",
                description: "Occupancy rate (for real estate)"
            },
            totalTokens: {
                type: "string",
                description: "Total number of tokens"
            },
            previewImage: {
                type: "string",
                description: "Preview image URL"
            },
            images: {
                type: "array",
                items: { type: "string" },
                description: "Array of image URLs"
            },
            yearBuilt: {
                type: "string",
                description: "Year built (for real estate)"
            },
            squareFootage: {
                type: "string",
                description: "Square footage (for real estate)"
            },
            maturityDate: {
                type: "string",
                description: "Maturity date (for bonds)"
            },
            couponRate: {
                type: "number",
                description: "Coupon rate (for bonds)"
            },
            creditRating: {
                type: "string",
                description: "Credit rating (for bonds)"
            },
            commodityGrade: {
                type: "string",
                description: "Commodity grade"
            },
            storageLocation: {
                type: "string",
                description: "Storage location (for physical commodities)"
            },
            assetMetadata: {
                type: "object",
                description: "Additional asset metadata"
            },
            kycRequirements: {
                type: "object",
                description: "KYC requirements"
            },
            requiredKycLevel: {
                type: "string",
                enum: ["BASIC", "ENHANCED", "INSTITUTIONAL"],
                description: "Required KYC level"
            },
            jurisdiction: {
                type: "string",
                description: "Legal jurisdiction"
            },
            regulatoryFramework: {
                type: "string",
                description: "Regulatory framework"
            },
            minimumInvestment: {
                type: "string",
                description: "Minimum investment amount"
            },
            maximumInvestment: {
                type: "string",
                description: "Maximum investment amount"
            },
            investorRestrictions: {
                type: "array",
                items: { type: "string" },
                description: "Investor restrictions"
            }
        },
        required: ["name", "type", "location", "value", "tokenPrice", "category"]
    },
    handler: async (agent: ApiAgent, input: Record<string, any>) => {
        try {
            const parsed = CreateRwaProjectSchema.parse(input);
            
            // Use provided access_key or fall back to config
            const apiAccessKey = parsed.access_key || accessKey;
            
            if (!apiAccessKey) {
                throw new Error("Access key is required. Provide it as parameter or set --access_key when starting the agent.");
            }

            const apiUrl = "https://asetta.xyz/api/project";
            
            const requestBody = {
                accessKey: apiAccessKey,
                ...parsed
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
                api_endpoint: apiUrl
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
