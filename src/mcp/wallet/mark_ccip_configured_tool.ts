import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { type NetworkType, getContractAddresses } from "../../config";
import { parseEther } from "viem";
import RWAManagerABI from "../../contracts/abis/RWAManager.json";

export const MarkCCIPConfiguredTool: McpTool = {
    name: "asetta_mark_ccip_configured",
    description: "Mark CCIP as configured in RWAManager (Step 2 of RWA workflow)",
    schema: {
        project_id: z.string()
            .describe("Project ID from create RWA token"),
        total_supply: z.string()
            .describe("Total token supply across all chains (e.g., '1000000' for 1M tokens)"),
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
        const totalSupply = parseEther(input.total_supply);

        try {
            // Call markCCIPConfigured function
            const txHash = await walletAgent.walletClient.writeContract({
                address: contractAddresses.rwaManager as `0x${string}`,
                abi: RWAManagerABI.abi,
                functionName: 'markCCIPConfigured',
                args: [projectId, totalSupply],
            } as any);

            // Wait for transaction confirmation
            const receipt = await walletAgent.publicClient.waitForTransactionReceipt({
                hash: txHash
            });

            return {
                status: "success",
                message: "✅ CCIP Successfully Marked as Configured",
                transaction_hash: txHash,
                block_number: receipt.blockNumber.toString(),
                gas_used: receipt.gasUsed.toString(),
                details: {
                    project_id: input.project_id,
                    total_supply: input.total_supply,
                    network: walletAgent.network,
                    project_status: "CCIP_READY"
                },
                next_steps: [
                    "🎯 Project is now ready for primary sales registration",
                    "📈 Use asetta_register_primary_sales to setup pricing and sales parameters",
                    "💰 After registration, use asetta_activate_primary_sales to go live"
                ],
                workflow_progress: {
                    step: "2/4",
                    completed: ["Create RWA Token", "Mark CCIP Configured"],
                    next: "Register Primary Sales"
                }
            };

        } catch (error) {
            return {
                status: "error",
                message: "❌ Failed to mark CCIP as configured",
                error: error instanceof Error ? error.message : String(error),
                input_received: input,
                troubleshooting: [
                    "✓ Ensure you are the project creator",
                    "✓ Verify project is in CREATED status",
                    "✓ Check that total supply is greater than 0",
                    "✓ Make sure you have sufficient gas fees"
                ]
            };
        }
    }
};
