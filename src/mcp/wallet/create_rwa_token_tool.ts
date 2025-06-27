import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { parseEther } from "viem";

const COORDINATOR_ADDRESS = "0x3a45eE7f3A7e81624DDac9b413D5541a0934E263";

const COORDINATOR_ABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "name", "type": "string" },
            { "internalType": "string", "name": "symbol", "type": "string" },
            {
                "components": [
                    { "internalType": "string", "name": "assetType", "type": "string" },
                    { "internalType": "string", "name": "description", "type": "string" },
                    { "internalType": "uint256", "name": "totalValue", "type": "uint256" },
                    { "internalType": "string", "name": "url", "type": "string" },
                    { "internalType": "uint256", "name": "createdAt", "type": "uint256" }
                ],
                "internalType": "struct RWAToken.AssetMetadata",
                "name": "metadata",
                "type": "tuple"
            },
            { "internalType": "address", "name": "projectWallet", "type": "address" },
            { "internalType": "uint256", "name": "projectAllocationPercent", "type": "uint256" },
            { "internalType": "uint256", "name": "pricePerTokenETH", "type": "uint256" }
        ],
        "name": "createRWAProject",
        "outputs": [
            { "internalType": "uint256", "name": "projectId", "type": "uint256" }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

export const CreateRwaTokenTool: McpTool = {
    name: "asetta_create_rwa_token",
    description: "Create RWA token and complete project on Avalanche using Asetta's smart contracts",
    schema: {
        name: z.string()
            .describe("Token name (e.g., 'Tokyo Shibuya Prime Office Tower')"),
        symbol: z.string()
            .describe("Token symbol (e.g., 'TSOT')"),
        assetType: z.string()
            .describe("Asset type (e.g., 'real-estate')"),
        description: z.string()
            .describe("Asset description"),
        totalValue: z.string()
            .describe("Total asset value in USD (e.g., '12500000' for $12.5M)"),
        url: z.string()
            .optional()
            .describe("URL to asset documentation/images"),
        projectWallet: z.string()
            .describe("Project wallet address"),
        projectAllocationPercent: z.number()
            .min(0)
            .max(100)
            .describe("Percentage allocated to project (0-100)"),
        pricePerTokenAVAX: z.string()
            .describe("Price per token in AVAX (e.g., '0.01')")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            await agent.connect();

            // Convert values
            const totalValueWithDecimals = BigInt(input.totalValue) * BigInt(10 ** 8); // 8 decimals for USD
            const pricePerToken = parseEther(input.pricePerTokenAVAX);

            // Prepare metadata
            const metadata = {
                assetType: input.assetType,
                description: input.description,
                totalValue: totalValueWithDecimals,
                url: input.url || "",
                createdAt: BigInt(0) // Will be set by contract
            };

            console.error(`Creating RWA project: ${input.name} (${input.symbol})`);
            console.error(`Asset Value: $${input.totalValue}`);
            console.error(`Token Price: ${input.pricePerTokenAVAX} AVAX`);
            console.error(`Project Allocation: ${input.projectAllocationPercent}%`);

            // Execute transaction
            const txHash = await agent.walletClient.writeContract({
                address: COORDINATOR_ADDRESS as `0x${string}`,
                abi: COORDINATOR_ABI,
                functionName: 'createRWAProject',
                args: [
                    input.name,
                    input.symbol,
                    metadata,
                    input.projectWallet as `0x${string}`,
                    BigInt(input.projectAllocationPercent),
                    pricePerToken
                ]
            } as any);

            console.error(`Transaction submitted: ${txHash}`);

            // Wait for confirmation
            const receipt = await agent.publicClient.waitForTransactionReceipt({
                hash: txHash,
                confirmations: 2
            });

            console.error(`Transaction confirmed in block ${receipt.blockNumber}`);

            // Find ProjectCreated event to get smart contract ID
            let smartContractId: bigint | undefined;

            for (const log of receipt.logs) {
                try {
                    if (log.topics[0] === '0x' + '808c10407f796034c5da8d075c2de0412dfad2b0a3ab5b9b2c5d1b7c8eee1c2') { // ProjectCreated event signature
                        // Extract project ID from event data (first 32 bytes)
                        const projectIdHex = log.data.slice(0, 66); // 0x + 64 chars
                        smartContractId = BigInt(projectIdHex);
                        break;
                    }
                } catch (e) {
                    // Continue searching
                }
            }

            const result = {
                status: "success",
                message: "✅ RWA Token and project created successfully on Avalanche",
                transaction_hash: txHash,
                block_number: receipt.blockNumber.toString(),
                smart_contract_id: smartContractId?.toString() || "Check transaction logs",
                contract_addresses: {
                    coordinator: COORDINATOR_ADDRESS,
                    explorer_link: `https://testnet.snowtrace.io/tx/${txHash}`
                },
                token_details: {
                    name: input.name,
                    symbol: input.symbol,
                    total_value_usd: input.totalValue,
                    token_price_avax: input.pricePerTokenAVAX,
                    project_allocation_percent: input.projectAllocationPercent
                },
                gas_used: receipt.gasUsed.toString(),
                next_steps: [
                    "✅ RWA Token and complete project deployed successfully on Avalanche",
                    "📊 Next: Update project status",
                    "⚡ Run: asetta_update_project_status to link contracts to AWS Amplify project",
                    "🎯 Set status to 'ACTIVE' to make project available for investors",
                    "💰 Investors can now purchase tokens through Primary Sales contract"
                ]
            };

            return result;

        } catch (error: any) {
            throw new Error(`Failed to create RWA token: ${error.message}`);
        } finally {
            await agent.disconnect();
        }
    }
};

export async function handleCreateRwaToken(args: any) {
    const agent = new WalletAgent();
    return await CreateRwaTokenTool.handler(agent, args);
}
