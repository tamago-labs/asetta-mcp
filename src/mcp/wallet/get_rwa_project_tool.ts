import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";

const COORDINATOR_ADDRESS = "0x3a45eE7f3A7e81624DDac9b413D5541a0934E263";

const COORDINATOR_ABI = [
    {
        "inputs": [
            { "internalType": "uint256", "name": "projectId", "type": "uint256" }
        ],
        "name": "getProject",
        "outputs": [
            {
                "components": [
                    { "internalType": "address", "name": "rwaToken", "type": "address" },
                    { "internalType": "address", "name": "primarySales", "type": "address" },
                    { "internalType": "address", "name": "rfq", "type": "address" },
                    { "internalType": "address", "name": "vault", "type": "address" },
                    { "internalType": "address", "name": "creator", "type": "address" },
                    { "internalType": "bool", "name": "isActive", "type": "bool" },
                    { "internalType": "uint256", "name": "createdAt", "type": "uint256" }
                ],
                "internalType": "struct RWACoordinator.RWAProject",
                "name": "project",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

export const GetRwaProjectTool: McpTool = {
    name: "asetta_get_rwa_project",
    description: "Get RWA project details from Avalanche smart contract",
    schema: {
        projectId: z.string()
            .describe("Project ID to retrieve from smart contract")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            await agent.connect();
            
            const projectId = BigInt(input.projectId);
            
            console.error(`Retrieving project details for ID: ${input.projectId}`);
            
            // Read project from contract
            const project = await agent.publicClient.readContract({
                address: COORDINATOR_ADDRESS as `0x${string}`,
                abi: COORDINATOR_ABI,
                functionName: 'getProject',
                args: [projectId]
            }) as any;
            
            // Check if project exists
            if (!project || project.creator === '0x0000000000000000000000000000000000000000') {
                throw new Error(`Project with ID ${input.projectId} not found`);
            }
            
            const result = {
                status: "success",
                message: "✅ RWA Project details retrieved successfully",
                project_id: input.projectId,
                project_details: {
                    rwa_token: project.rwaToken,
                    primary_sales: project.primarySales,
                    rfq: project.rfq,
                    vault: project.vault,
                    creator: project.creator,
                    is_active: project.isActive,
                    created_at: project.createdAt.toString(),
                    created_date: new Date(Number(project.createdAt) * 1000).toISOString()
                },
                explorer_links: {
                    token: `https://testnet.snowtrace.io/address/${project.rwaToken}`,
                    primary_sales: `https://testnet.snowtrace.io/address/${project.primarySales}`,
                    rfq: `https://testnet.snowtrace.io/address/${project.rfq}`,
                    vault: `https://testnet.snowtrace.io/address/${project.vault}`
                },
                contract_addresses: {
                    coordinator: COORDINATOR_ADDRESS
                }
            };
            
            return result;
            
        } catch (error: any) {
            throw new Error(`Failed to get RWA project: ${error.message}`);
        } finally {
            await agent.disconnect();
        }
    }
};

export async function handleGetRwaProject(args: any) {
    const agent = new WalletAgent();
    return await GetRwaProjectTool.handler(agent, args);
}
