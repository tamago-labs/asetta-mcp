import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { formatEther, Address } from "viem";

export const GetAccountBalancesTool: McpTool = {
    name: "asetta_get_account_balances",
    description: "Get all token balances including AVAX tokens and more",
    schema: {
        account_address: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .optional()
            .describe("Ethereum address to check (optional, defaults to wallet address)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            await agent.connect();

            const targetAddress = (input.account_address || agent.account.address) as Address;

            // Get AVAX balance
            const ethBalance = await agent.publicClient.getBalance({
                address: targetAddress
            });

            return {
                status: "success",
                message: `✅ Account balances retrieved for ${targetAddress}`,
                account_info: {
                    address: targetAddress,
                    network: agent.network,
                    is_own_wallet: targetAddress.toLowerCase() === agent.account.address.toLowerCase()
                },
                native_balance: {
                    symbol: "AVAX",
                    balance: formatEther(ethBalance),
                    balance_wei: ethBalance.toString(),
                    usd_value: "N/A" // Could integrate price feeds later
                },
                portfolio_summary: {
                    total_avax_balance: formatEther(ethBalance),
                    can_pay_gas: Number(formatEther(ethBalance)) > 0.001,
                    ready_for_operations: Number(formatEther(ethBalance)) > 0.001
                },
                next_steps: Number(formatEther(ethBalance)) < 0.001
                    ? [
                        "🔋 Fund wallet with AVAX for gas fees",
                        "🎨 Ready to tokenization once funded"
                    ]
                    : [
                        "✅ Sufficient AVAX for gas fees",
                        "🎫 Ready to tokenization the RWA project"
                    ]
            };
        } catch (error: any) {
            throw new Error(`Failed to get account balances: ${error.message}`);
        } finally {
            await agent.disconnect();
        }
    }
};