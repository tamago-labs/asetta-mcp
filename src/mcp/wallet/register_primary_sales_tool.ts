import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { type NetworkType, getContractAddresses } from "../../config";
import { parseUnits } from "viem";
import RWAManagerABI from "../../contracts/abis/RWAManager.json";

export const RegisterPrimarySalesTool: McpTool = {
    name: "asetta_register_primary_sales",
    description: "Register RWA project for primary sales distribution (Step 3 of RWA workflow)",
    schema: {
        project_id: z.string()
            .describe("Project ID from create RWA token"),
        project_wallet: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .describe("Project treasury wallet for receiving USDC payments"),
        project_allocation_percent: z.number()
            .min(0)
            .max(100)
            .describe("Percentage allocated to project team (0-100)"),
        price_per_token_usdc: z.string()
            .describe("Price per token in USDC (e.g., '1.50' for $1.50 per token)"),
        min_purchase_usdc: z.string()
            .describe("Minimum purchase amount in USDC (e.g., '100')"),
        max_purchase_usdc: z.string()
            .describe("Maximum purchase amount in USDC (e.g., '50000')"),
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
        const projectAllocationPercent = BigInt(input.project_allocation_percent);
        
        // Convert USDC amounts to proper format (6 decimals for USDC)
        const pricePerTokenUSDC = parseUnits(input.price_per_token_usdc, 6);
        const minPurchaseUSDC = parseUnits(input.min_purchase_usdc, 6);
        const maxPurchaseUSDC = parseUnits(input.max_purchase_usdc, 6);

        try {
            // Call registerForPrimarySales function
            const txHash = await walletAgent.walletClient.writeContract({
                address: contractAddresses.rwaManager as `0x${string}`,
                abi: RWAManagerABI.abi,
                functionName: 'registerForPrimarySales',
                args: [
                    projectId,
                    input.project_wallet as `0x${string}`,
                    projectAllocationPercent,
                    pricePerTokenUSDC,
                    minPurchaseUSDC,
                    maxPurchaseUSDC
                ],
            } as any);

            // Wait for transaction confirmation
            const receipt = await walletAgent.publicClient.waitForTransactionReceipt({
                hash: txHash
            });

            return {
                status: "success",
                message: "🎯 Primary Sales Successfully Registered",
                transaction_hash: txHash,
                block_number: receipt.blockNumber.toString(),
                gas_used: receipt.gasUsed.toString(),
                details: {
                    project_id: input.project_id,
                    project_wallet: input.project_wallet,
                    project_allocation_percent: input.project_allocation_percent,
                    price_per_token_usdc: input.price_per_token_usdc,
                    min_purchase_usdc: input.min_purchase_usdc,
                    max_purchase_usdc: input.max_purchase_usdc,
                    network: walletAgent.network,
                    project_status: "REGISTERED"
                },
                sales_calculation: {
                    project_allocation: `${input.project_allocation_percent}% of total supply`,
                    public_sales: `${100 - input.project_allocation_percent}% of total supply`,
                    token_price: `$${input.price_per_token_usdc} USDC per token`,
                    purchase_limits: `$${input.min_purchase_usdc} - $${input.max_purchase_usdc} USDC`
                },
                important_next_steps: [
                    "📦 Creator must transfer sales allocation tokens to PrimaryDistribution contract",
                    "👤 Creator must transfer project allocation tokens to project wallet",
                    "🚀 Use asetta_activate_primary_sales to start public sales",
                    "📊 Monitor sales through blockchain events"
                ],
                contract_addresses: {
                    rwa_manager: contractAddresses.rwaManager,
                    primary_distribution: contractAddresses.primaryDistribution
                },
                workflow_progress: {
                    step: "3/4",
                    completed: ["Create RWA Token", "Configure CCIP", "Register Primary Sales"],
                    next: "Activate Primary Sales"
                }
            };

        } catch (error) {
            return {
                status: "error",
                message: "❌ Failed to register primary sales",
                error: error instanceof Error ? error.message : String(error),
                input_received: input,
                troubleshooting: [
                    "✓ Ensure you are the project creator",
                    "✓ Verify project is in CCIP_READY status", 
                    "✓ Check project wallet address is valid",
                    "✓ Verify price and limits are reasonable",
                    "✓ Ensure allocation percentage is between 0-100",
                    "✓ Make sure you have sufficient gas fees"
                ]
            };
        }
    }
};
