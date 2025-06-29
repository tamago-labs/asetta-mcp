import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { type NetworkType, getContractAddresses } from "../../config";
import { decodeEventLog, parseAbiItem } from 'viem';

const RWA_MANAGER_ABI = [
    {
        "type": "function",
        "name": "createRWAToken",
        "inputs": [
            {
                "name": "name",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "symbol",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "metadata",
                "type": "tuple",
                "internalType": "struct RWAToken.AssetMetadata",
                "components": [
                    {
                        "name": "assetType",
                        "type": "string",
                        "internalType": "string"
                    },
                    {
                        "name": "description",
                        "type": "string",
                        "internalType": "string"
                    },
                    {
                        "name": "totalValue",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "url",
                        "type": "string",
                        "internalType": "string"
                    },
                    {
                        "name": "createdAt",
                        "type": "uint256",
                        "internalType": "uint256"
                    }
                ]
            }
        ],
        "outputs": [
            {
                "name": "projectId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "ProjectCreated",
        "inputs": [
            {
                "name": "projectId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "creator",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "tokenAddress",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "name",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "symbol",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
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
                url: input.url || "",
                createdAt: BigInt(0) // Will be set by contract
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
                    const { eventName, args } = decodeEventLog({
                        abi: RWA_MANAGER_ABI,
                        data: log.data,
                        topics: log.topics,
                    });

                    if (eventName === 'ProjectCreated') {
                        projectId = args.projectId as bigint;
                        tokenAddress = args.tokenAddress as `0x${string}`;
                        break;
                    }
                } catch {/* not this event */ }
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
                    "🔗 Step 2: For multi-chain support, deploy on other networks:",
                    "   • Use asetta_create_rwa_token on each target network",
                    "   • Recommended: ethereumSepolia, arbitrumSepolia, avalancheFuji",
                    "🌐 Step 3: Configure CCIP for cross-chain transfers:",
                    "   • Use asetta_deploy_ccip_pool on each network",
                    "   • Use asetta_configure_ccip_roles on each network",
                    "   • Use asetta_connect_ccip_chains to link networks",
                    "   • Use asetta_validate_ccip_setup to verify configuration",
                    "📊 Step 4: Mark CCIP as configured in RWAManager",
                    "🎯 Step 5: Register for primary sales distribution",
                    "💰 Step 6: Activate primary sales for public purchases"
                ],
                important_notes: [
                    "⚠️ Multi-chain setup requires deploying on each target network",
                    "📝 Save the project ID and token address for CCIP configuration",
                    "🔗 CCIP tools are now available for cross-chain setup",
                    "💡 Follow the exact sequence: Deploy → Pool → Roles → Connect → Validate",
                    "🌐 Each network needs its own pool deployment and role configuration"
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
