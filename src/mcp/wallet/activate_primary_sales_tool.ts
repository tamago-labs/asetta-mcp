import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { type NetworkType, getContractAddresses } from "../../config";
import RWAManagerABI from "../../contracts/abis/RWAManager.json";

export const ActivatePrimarySalesTool: McpTool = {
    name: "asetta_activate_primary_sales",
    description: "Activate primary sales for public RWA token purchases (Final step of RWA workflow)",
    schema: {
        project_id: z.string()
            .describe("Project ID from create RWA token"),
        network: z.enum(['avalancheFuji', 'ethereumSepolia', 'arbitrumSepolia'])
            .optional()
            .describe("Network to use (optional, defaults to configured network)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        const networkType = input.network as NetworkType;
        const walletAgent = networkType ? new WalletAgent(networkType) : agent;
        
        await walletAgent.connect();

        const contractAddresses = getContractAddresses(walletAgent.network);
        const projectId = BigInt(input.project_id);

        try {
            // Call activatePrimarySales function
            const txHash = await walletAgent.walletClient.writeContract({
                address: contractAddresses.rwaManager as `0x${string}`,
                abi: RWAManagerABI.abi,
                functionName: 'activatePrimarySales',
                args: [projectId],
            } as any);

            // Wait for transaction confirmation
            const receipt = await walletAgent.publicClient.waitForTransactionReceipt({
                hash: txHash
            });

            return {
                status: "success",
                message: "🚀 Primary Sales Successfully Activated!",
                transaction_hash: txHash,
                block_number: receipt.blockNumber.toString(),
                gas_used: receipt.gasUsed.toString(),
                details: {
                    project_id: input.project_id,
                    network: walletAgent.network,
                    project_status: "ACTIVE"
                },
                sales_now_live: {
                    description: "🎉 Your RWA tokens are now available for public purchase!",
                    what_happens_now: [
                        "💰 Users can purchase tokens with USDC",
                        "🔄 USDC payments go to your project treasury",
                        "🎫 RWA tokens are transferred to buyers",
                        "🌐 Cross-chain transfers enabled (if CCIP configured)"
                    ]
                },
                user_purchase_flow: [
                    "1. 👤 Users approve USDC spending to PrimaryDistribution contract",
                    "2. 💳 Users call PrimaryDistribution.purchaseTokens() with USDC amount",
                    "3. 💸 USDC is transferred to your project wallet",
                    "4. 🎫 RWA tokens are transferred to the user",
                    "5. 🌍 Users can transfer tokens cross-chain via CCIP (if configured)"
                ],
                contract_addresses: {
                    rwa_manager: contractAddresses.rwaManager,
                    primary_distribution: contractAddresses.primaryDistribution
                },
                workflow_progress: {
                    step: "4/4",
                    completed: ["Create RWA Token", "Configure CCIP", "Register Primary Sales", "Activate Primary Sales"],
                    status: "🎊 WORKFLOW COMPLETE! 🎊"
                },
                monitoring: {
                    description: "Track your project's sales progress",
                    methods: [
                        "📈 Monitor TokensPurchased events on the blockchain",
                        "🔍 Check PrimaryDistribution contract for sales data",
                        "💰 Track USDC balance in your project treasury",
                        "📊 Use block explorers to view transaction activity"
                    ]
                }
            };

        } catch (error) {
            return {
                status: "error",
                message: "❌ Failed to activate primary sales",
                error: error instanceof Error ? error.message : String(error),
                input_received: input,
                troubleshooting: [
                    "✓ Ensure you are the project creator",
                    "✓ Verify project is in REGISTERED status", 
                    "✓ Check that sales allocation tokens are transferred to PrimaryDistribution",
                    "✓ Verify project allocation tokens are transferred to project wallet",
                    "✓ Make sure you have sufficient gas fees"
                ]
            };
        }
    }
};
