import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { type NetworkType } from "../../config";

export const GetWalletInfoTool: McpTool = {
    name: "asetta_get_wallet_info",
    description: "Get wallet address and basic account information",
    schema: {
        network: z.enum(['avalancheFuji', 'ethereumSepolia', 'arbitrumSepolia'])
            .optional()
            .describe("Network to check (optional, defaults to configured network)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            const networkType = input.network as NetworkType;
            const walletAgent = networkType ? new WalletAgent(networkType) : agent;
            
            await walletAgent.connect();
 
            const balance = await walletAgent.publicClient.getBalance({
                address: walletAgent.account.address
            });

            const balanceInNative = Number(balance) / 1e18;
            const nativeCurrency = walletAgent.networkInfo.nativeCurrency;

            return {
                status: "success",
                message: "✅ Wallet information retrieved successfully",
                wallet_details: {
                    address: walletAgent.account.address,
                    network: walletAgent.network,
                    balance: `${balanceInNative.toFixed(6)} ${nativeCurrency}`,
                    balance_in_wei: balance.toString(),
                    chain_id: await walletAgent.publicClient.getChainId(),
                    block_explorer: walletAgent.networkInfo.blockExplorer,
                    native_currency: nativeCurrency
                },
                account_status: {
                    activated: true,
                    minimum_balance_required: `0.01 ${nativeCurrency}`,
                    can_register_rwa: balanceInNative >= 0.01,
                    ready_for_operations: balanceInNative >= 0.001
                },
                recommendations: balanceInNative < 0.01
                    ? [
                        `⚠️ Low ${nativeCurrency} balance detected`,
                        `Fund wallet with at least 0.01 ${nativeCurrency} for RWA registration`,
                        "Gas fees required for all Asetta Protocol operations",
                        `Current balance: ${balanceInNative.toFixed(6)} ${nativeCurrency}`
                    ]
                    : [
                        "✅ Wallet has sufficient balance for operations",
                        "Ready to register RWA assets",
                        "Ready to create vaults and issue tokens"
                    ]
            };
        } catch (error: any) {
            throw new Error(`Failed to get wallet info: ${error.message}`);
        } finally {
            await agent.disconnect();
        }
    }
};
