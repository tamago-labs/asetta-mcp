import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";

export const GetWalletInfoTool: McpTool = {
    name: "asetta_get_wallet_info",
    description: "Get wallet address and basic account information",
    schema: {},
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            await agent.connect();
 
            const balance = await agent.publicClient.getBalance({
                address: agent.account.address
            });

            const balanceInETH = Number(balance) / 1e18;

            return {
                status: "success",
                message: "✅ Wallet information retrieved successfully",
                wallet_details: {
                    address: agent.account.address,
                    network: agent.network,
                    balance: `${balanceInETH.toFixed(6)} AVAX`,
                    balance_in_wei: balance.toString(),
                    chain_id: await agent.publicClient.getChainId(),
                    block_explorer: agent.networkInfo.blockExplorer
                },
                account_status: {
                    activated: true,
                    minimum_balance_required: "0.01 AVAX",
                    can_register_rwa: balanceInETH >= 0.01,
                    ready_for_operations: balanceInETH >= 0.001
                },
                recommendations: balanceInETH < 0.01
                    ? [
                        "⚠️ Low AVAX balance detected",
                        "Fund wallet with at least 0.01 AVAX for RWA registration",
                        "Gas fees required for all Asetta Protocol operations",
                        `Current balance: ${balanceInETH.toFixed(6)} AVAX`
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