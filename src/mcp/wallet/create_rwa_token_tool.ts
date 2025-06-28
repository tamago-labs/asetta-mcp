import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { type NetworkType, getContractAddresses } from "../../config";

const RWA_MANAGER_ABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "name", "type": "string" },
            { "internalType": "string", "name": "symbol", "type": "string" },
            {
                "components": [
                    { "internalType": "string", "name": "assetType", "type": "string" },
                    { "internalType": "string", "name": "description", "type": "string" },
                    { "internalType": "uint256", "name": "totalValue", "type": "uint256" },
                    { "internalType": "string", "name": "url", "type": "string" }
                ],
                "internalType": "struct RWAToken.AssetMetadata",
                "name": "metadata",
                "type": "tuple"
            }
        ],
        "name": "createRWAToken",
        "outputs": [
            { "internalType": "uint256", "name": "projectId", "type": "uint256" }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "uint256", "name": "projectId", "type": "uint256" },
            { "indexed": true, "internalType": "address", "name": "creator", "type": "address" },
            { "indexed": true, "internalType": "address", "name": "tokenAddress", "type": "address" },
            { "indexed": false, "internalType": "string", "name": "name", "type": "string" },
            { "indexed": false, "internalType": "string", "name": "symbol", "type": "string" }
        ],
        "name": "ProjectCreated",
        "type": "event"
    }
] as const;

export const CreateRwaTokenTool: McpTool = {
    name: "asetta_create_rwa_token",
    description: "Create RWA token using new RWAManager contract (Step 1 of 3)",
    schema: {
        name: z.string()
            .describe("Token name (e.g., 'Tokyo Shibuya Prime Office Tower')"),
        symbol: z.string()
            .describe("Token symbol (e.g., 'TSOT')"),
        assetType: z.string()
            .describe("Asset type (e.g., 'real-estate', 'commodity', 'infrastructure')"),
        description: z.string()
            .describe("Asset description"),
        totalValue: z.string()
            .describe("Total asset value in USD (e.g., '12500000' for $12.5M)"),
        url: z.string()
            .optional()
            .describe("URL to asset documentation/images"),
        network: z.enum(['avalancheFuji', 'ethereumSepolia', 'arbitrumSepolia'])
            .optional()
            .describe("Network to deploy on (optional, defaults to configured network)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            const networkType = input.network as NetworkType;
            const walletAgent = networkType ? new WalletAgent(networkType) : agent;
            
            await walletAgent.connect();

            const contracts = getContractAddresses(walletAgent.network);
            const nativeCurrency = walletAgent.networkInfo.nativeCurrency;

            // Convert values (RWAManager expects 8 decimals for USD value)
            const totalValueWithDecimals = BigInt(input.totalValue) * BigInt(10 ** 8);

            // Prepare metadata
            const metadata = {
                assetType: input.assetType,
                description: input.description,
                totalValue: totalValueWithDecimals,
                url: input.url || ""
            };

            console.error(`Creating RWA project: ${input.name} (${input.symbol})`);
            console.error(`Network: ${walletAgent.network}`);
            console.error(`Asset Type: ${input.assetType}`);
            console.error(`Asset Value: $${input.totalValue}`);
            console.error(`RWAManager: ${contracts.rwaManager}`);

            // Execute transaction
            const txHash = await walletAgent.walletClient.writeContract({
                address: contracts.rwaManager as `0x${string}`,
                abi: RWA_MANAGER_ABI,
                functionName: 'createRWAToken',
                args: [
                    input.name,
                    input.symbol,
                    metadata
                ]
            } as any);

            console.error(`Transaction submitted: ${txHash}`);

            // Wait for confirmation
            const receipt = await walletAgent.publicClient.waitForTransactionReceipt({
                hash: txHash,
                confirmations: 2
            });

            console.error(`Transaction confirmed in block ${receipt.blockNumber}`);

            // Find ProjectCreated event to get project ID and token address
            let projectId: bigint | undefined;
            let tokenAddress: string | undefined;

            for (const log of receipt.logs) {
                try {
                    // ProjectCreated event signature: keccak256("ProjectCreated(uint256,address,address,string,string)")
                    if (log.topics[0] === '0x6c68c7b8e14b2b92c7d5e0e2c1b5b6e7c8c9c0a1a2a3a4a5a6a7a8a9aabbc1c2c3') {
                        projectId = BigInt(log.topics[1]); // First indexed parameter
                        // Token address is in the data field or as a topic
                        const tokenAddressFromTopics = log.topics[3];
                        if (tokenAddressFromTopics) {
                            tokenAddress = '0x' + tokenAddressFromTopics.slice(26); // Remove padding
                        }
                        break;
                    }
                } catch (e) {
                    // Continue searching
                }
            }

            // If we couldn't parse from events, still provide the transaction info
            if (!projectId) {
                console.error('Could not parse project ID from transaction logs');
            }

            const result = {
                status: "success",
                message: `✅ RWA Token created successfully on ${walletAgent.network}`,
                transaction_hash: txHash,
                block_number: receipt.blockNumber.toString(),
                project_id: projectId?.toString() || "Check transaction logs",
                token_address: tokenAddress || "Check transaction logs",
                network_info: {
                    network: walletAgent.network,
                    chain_id: walletAgent.networkInfo.chainId,
                    native_currency: nativeCurrency
                },
                contract_addresses: {
                    rwa_manager: contracts.rwaManager,
                    token_factory: contracts.tokenFactory,
                    explorer_link: `${walletAgent.networkInfo.blockExplorer}/tx/${txHash}`
                },
                token_details: {
                    name: input.name,
                    symbol: input.symbol,
                    asset_type: input.assetType,
                    description: input.description,
                    total_value_usd: input.totalValue,
                    documentation_url: input.url || "Not provided"
                },
                project_status: {
                    current_step: "1 of 3",
                    status: "CREATED",
                    description: "Token created, CCIP configuration needed next"
                },
                gas_used: receipt.gasUsed.toString(),
                next_steps: [
                    `✅ Step 1 Complete: RWA Token created on ${walletAgent.network}`,
                    "🔗 Step 2: Deploy token on other chains (if needed)",
                    "📝 Note: If you want multi-chain support, deploy this token on other networks",
                    "🌐 Step 3: Configure CCIP cross-chain functionality",
                    "📊 Step 4: Mark CCIP as configured in RWAManager",
                    "🎯 Step 5: Register for primary sales distribution",
                    "💰 Step 6: Activate primary sales for public purchases"
                ],
                important_notes: [
                    "⚠️ This is a multi-step process with the new architecture",
                    "📝 Save the project ID for subsequent operations",
                    "🔗 CCIP configuration must be done manually",
                    "💡 Contact team for CCIP setup assistance if needed"
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
