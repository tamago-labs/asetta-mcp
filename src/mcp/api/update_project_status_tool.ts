import { z } from "zod";
import { ApiAgent } from "../../agent/api";
import { type McpTool } from "../../types";
import { accessKey } from "../../config";

export const UpdateProjectStatusTool: McpTool = {
    name: "asetta_update_project_status",
    description: "Update RWA project status in AWS Amplify database",
    schema: {
        access_key: z.string()
            .optional()
            .describe("Access key for API authentication (optional, uses default from config if not provided)"),
        project_id: z.string()
            .describe("Project ID to update"),
        status: z.enum(["PREPARE", "ACTIVE", "LAUNCHING_SOON", "COMPLETED", "PAUSED", "CANCELLED"])
            .describe("New project status"),
        smart_contract_id: z.string()
            .optional()
            .describe("Smart contract project ID from blockchain"),
        token_address: z.string()
            .optional()
            .describe("RWA token contract address"),
        primary_sales_address: z.string()
            .optional()
            .describe("Primary sales contract address"),
        vault_address: z.string()
            .optional()
            .describe("Vault contract address"),
        rfq_address: z.string()
            .optional()
            .describe("RFQ contract address"),
        coordinator_address: z.string()
            .optional()
            .describe("Coordinator contract address"),
        network: z.string()
            .optional()
            .describe("Blockchain network (e.g., 'avalanche-fuji')"),
        blockchain_tx_hash: z.string()
            .optional()
            .describe("Transaction hash of creation"),
        block_number: z.string()
            .optional()
            .describe("Block number where project was created"),
        deployed_at: z.string()
            .optional()
            .describe("When contracts were deployed (ISO datetime)")
    },
    handler: async (agent: ApiAgent, input: Record<string, any>) => {
        try {
            // Use provided access_key or fall back to config
            const apiAccessKey = input.access_key || accessKey;
            
            if (!apiAccessKey) {
                throw new Error("Access key is required. Provide it as parameter or set --access_key when starting the agent.");
            }

            const apiUrl = `https://asetta.xyz/api/project/${input.project_id}`;
            
            const requestBody: any = {
                accessKey: apiAccessKey,
                status: input.status
            };

            // Add smart contract fields if provided
            if (input.smart_contract_id) {
                requestBody.smartContractId = input.smart_contract_id;
            }
            if (input.token_address) {
                requestBody.tokenAddress = input.token_address;
            }
            if (input.primary_sales_address) {
                requestBody.primarySalesAddress = input.primary_sales_address;
            }
            if (input.vault_address) {
                requestBody.vaultAddress = input.vault_address;
            }
            if (input.rfq_address) {
                requestBody.rfqAddress = input.rfq_address;
            }
            if (input.coordinator_address) {
                requestBody.coordinatorAddress = input.coordinator_address;
            }
            if (input.network) {
                requestBody.network = input.network;
            }
            if (input.blockchain_tx_hash) {
                requestBody.blockchainTxHash = input.blockchain_tx_hash;
            }
            if (input.block_number) {
                requestBody.blockNumber = input.block_number;
            }
            if (input.deployed_at) {
                requestBody.deployedAt = input.deployed_at;
            }

            const response = await fetch(apiUrl, {
                method: 'PUT',
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
                message: "✅ Project status updated successfully in AWS Amplify",
                project_id: input.project_id,
                new_status: input.status,
                updated_fields: Object.keys(requestBody).filter(key => key !== 'accessKey'),
                api_response: data,
                api_endpoint: apiUrl
            };

        } catch (error: any) {
            throw new Error(`Failed to update project status: ${error.message}`);
        }
    }
};

export async function handleUpdateProjectStatus(args: any) {
    const agent = new ApiAgent();
    return await UpdateProjectStatusTool.handler(agent, args);
}
