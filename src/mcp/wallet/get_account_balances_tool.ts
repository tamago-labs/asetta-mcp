import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { formatEther, Address } from "viem";
import { type NetworkType } from "../../config";

export const GetAccountBalancesTool: McpTool = {
    name: "asetta_get_account_balances",
    description: "Get all token balances including AVAX tokens and more",
    schema: {
        account_address: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .optional()
            .describe("Ethereum address to check (optional, defaults to wallet address)"),
        network: z.enum(['avalancheFuji', 'ethereumSepolia', 'arbitrumSepolia'])
            .optional()
            .describe("Network to check (optional, defaults to configured network)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            const networkType = input.network as NetworkType;
            const walletAgent = networkType ? new WalletAgent(networkType) : agent;
            
            await walletAgent.connect();

            const targetAddress = (input.account_address || walletAgent.account.address) as Address;
            const nativeCurrency = walletAgent.networkInfo.nativeCurrency;

            // Get native balance (ETH/AVAX)
            const nativeBalance = await walletAgent.publicClient.getBalance({
                address: targetAddress
            });

            return {
                status: "success",
                message: `✅ Account balances retrieved for ${targetAddress}`,
                account_info: {
                    address: targetAddress,
                    network: walletAgent.network,
                    chain_id: walletAgent.networkInfo.chainId,
                    native_currency: nativeCurrency,
                    is_own_wallet: targetAddress.toLowerCase() === walletAgent.account.address.toLowerCase()
                },
                native_balance: {
                    symbol: nativeCurrency,
                    balance: formatEther(nativeBalance),
                    balance_wei: nativeBalance.toString(),
                    usd_value: "N/A" // Could integrate price feeds later
                },
                portfolio_summary: {
                    total_native_balance: formatEther(nativeBalance),
                    can_pay_gas: Number(formatEther(nativeBalance)) > 0.001,
                    ready_for_operations: Number(formatEther(nativeBalance)) > 0.001
                },
                next_steps: Number(formatEther(nativeBalance)) < 0.001
                    ? [
                        `🔋 Fund wallet with ${nativeCurrency} for gas fees`,
                        "🎨 Ready to tokenization once funded"
                    ]
                    : [
                        `✅ Sufficient ${nativeCurrency} for gas fees`,
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
