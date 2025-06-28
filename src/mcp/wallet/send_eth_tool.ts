import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { parseEther, Address } from "viem";
import { type NetworkType } from "../../config";

export const SendETHTool: McpTool = {
    name: "asetta_send_native_ip",
    description: "Send native IP token to another address for gas fees or payments",
    schema: {
        destination: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .describe("Recipient's Ethereum address"),
        amount: z.number()
            .positive()
            .describe("Amount of native token to send"),
        memo: z.string()
            .optional()
            .describe("Optional memo for the transaction"),
        network: z.enum(['avalancheFuji', 'ethereumSepolia', 'arbitrumSepolia'])
            .optional()
            .describe("Network to use (optional, defaults to configured network)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            const networkType = input.network as NetworkType;
            const walletAgent = networkType ? new WalletAgent(networkType) : agent;
            
            await walletAgent.connect();

            const destination = input.destination as Address;
            const amount = parseEther(input.amount.toString());
            const nativeCurrency = walletAgent.networkInfo.nativeCurrency;
            
            // Check sender balance
            const balance = await walletAgent.publicClient.getBalance({
                address: walletAgent.account.address
            });

            if (balance < amount) {
                throw new Error(`Insufficient balance. Available: ${Number(balance) / 1e18} ${nativeCurrency}, Required: ${input.amount} ${nativeCurrency}`);
            }

            // Simulate transaction first to get accurate gas estimate and catch errors
            let gasEstimate: bigint;
            try {
                // For native transfers, we use estimateGas directly since it's not a contract call
                gasEstimate = await walletAgent.publicClient.estimateGas({
                    account: walletAgent.account.address,
                    to: destination,
                    value: amount
                });
            } catch (error: any) {
                throw new Error(`Transaction simulation failed: ${error.message}. Check recipient address and amount.`);
            }

            // Get gas price for cost calculation
            const gasPrice = await walletAgent.publicClient.getGasPrice();
            const gasCost = gasEstimate * gasPrice;

            if (balance < amount + gasCost) {
                throw new Error(`Insufficient balance for transaction + gas. Total needed: ${Number(amount + gasCost) / 1e18} ${nativeCurrency}`);
            }

            console.error(`✅ Native ${nativeCurrency} transfer simulation successful. Gas estimate: ${gasEstimate.toString()}`);

            // Send transaction
            const txHash = await walletAgent.walletClient.sendTransaction({
                account: walletAgent.account,
                to: destination,
                value: amount,
                gas: gasEstimate
            } as any);

            // Wait for confirmation
            const receipt = await walletAgent.publicClient.waitForTransactionReceipt({
                hash: txHash,
                confirmations: 1
            });

            return {
                status: "success",
                message: `✅ Successfully sent ${input.amount} ${nativeCurrency} to ${destination}`,
                transaction_details: {
                    transaction_hash: txHash,
                    from: walletAgent.account.address,
                    to: destination,
                    amount: `${input.amount} ${nativeCurrency}`,
                    amount_wei: amount.toString(),
                    gas_used: receipt.gasUsed.toString(),
                    gas_price: gasPrice.toString(),
                    total_cost: `${Number(amount + (receipt.gasUsed * gasPrice)) / 1e18} ${nativeCurrency}`,
                    block_number: receipt.blockNumber.toString(),
                    confirmations: 1,
                    memo: input.memo || "N/A"
                },
                network_info: {
                    network: walletAgent.network,
                    chain_id: walletAgent.networkInfo.chainId,
                    native_currency: nativeCurrency,
                    explorer_url: `${walletAgent.networkInfo.blockExplorer}/tx/${txHash}`
                },
                next_steps: [
                    "✅ Transaction confirmed on blockchain",
                    "🔍 View transaction details on block explorer",
                    `💰 Recipient can now use ${nativeCurrency} for Asetta operations`
                ]
            };
        } catch (error: any) {
            throw new Error(`Failed to send ${agent.networkInfo?.nativeCurrency || 'native token'}: ${error.message}`);
        } finally {
            await agent.disconnect();
        }
    }
};
