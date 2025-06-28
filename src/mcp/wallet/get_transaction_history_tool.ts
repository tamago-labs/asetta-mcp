import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { Address, formatEther } from "viem";
import { type NetworkType } from "../../config";

export const GetTransactionHistoryTool: McpTool = {
    name: "asetta_get_transaction_history",
    description: "Get recent transaction history for the wallet or specified address",
    schema: {
        account_address: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .optional()
            .describe("Address to check (optional, defaults to wallet address)"),
        limit: z.number()
            .min(1)
            .max(100)
            .default(20)
            .describe("Number of transactions to retrieve (max 100)"),
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
            const limit = input.limit || 20;
            const nativeCurrency = walletAgent.networkInfo.nativeCurrency;

            // Get current block number
            const currentBlock = await walletAgent.publicClient.getBlockNumber();
            const fromBlock = currentBlock - BigInt(10000); // Look back ~10k blocks

            // Get recent blocks to find transactions
            const recentTransactions = [];
            const blocksToCheck = Math.min(Number(limit * 5), 1000); // Check enough blocks to find transactions

            for (let i = 0; i < blocksToCheck && recentTransactions.length < limit; i++) {
                try {
                    const blockNumber = currentBlock - BigInt(i);
                    const block = await walletAgent.publicClient.getBlock({
                        blockNumber,
                        includeTransactions: true
                    });

                    // Find transactions involving our address
                    for (const tx of block.transactions) {
                        if (typeof tx === 'object') {
                            if ((tx.from?.toLowerCase() === targetAddress.toLowerCase() ||
                                tx.to?.toLowerCase() === targetAddress.toLowerCase()) &&
                                recentTransactions.length < limit) {

                                // Get transaction receipt for more details
                                try {
                                    const receipt = await walletAgent.publicClient.getTransactionReceipt({
                                        hash: tx.hash
                                    });

                                    recentTransactions.push({
                                        hash: tx.hash,
                                        block_number: block.number?.toString(),
                                        timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
                                        from: tx.from,
                                        to: tx.to,
                                        value: tx.value ? formatEther(tx.value) : '0',
                                        gas_used: receipt.gasUsed.toString(),
                                        gas_price: tx.gasPrice?.toString(),
                                        status: receipt.status === 'success' ? 'success' : 'failed',
                                        type: tx.from?.toLowerCase() === targetAddress.toLowerCase() ? 'sent' : 'received',
                                        is_contract_interaction: tx.to && tx.input !== '0x'
                                    });
                                } catch (receiptError) {
                                    // If we can't get receipt, add basic info
                                    recentTransactions.push({
                                        hash: tx.hash,
                                        block_number: block.number?.toString(),
                                        timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
                                        from: tx.from,
                                        to: tx.to,
                                        value: tx.value ? formatEther(tx.value) : '0',
                                        gas_used: 'N/A',
                                        gas_price: tx.gasPrice?.toString(),
                                        status: 'unknown',
                                        type: tx.from?.toLowerCase() === targetAddress.toLowerCase() ? 'sent' : 'received',
                                        is_contract_interaction: tx.to && tx.input !== '0x'
                                    });
                                }
                            }
                        }
                    }
                } catch (blockError) {
                    console.error(`Error fetching block ${currentBlock - BigInt(i)}:`, blockError);
                    continue;
                }
            }

            // Sort by block number (most recent first)
            recentTransactions.sort((a, b) => {
                const blockA = parseInt(a.block_number || '0');
                const blockB = parseInt(b.block_number || '0');
                return blockB - blockA;
            });

            // Calculate summary statistics
            const sentTransactions = recentTransactions.filter(tx => tx.type === 'sent');
            const receivedTransactions = recentTransactions.filter(tx => tx.type === 'received');
            const contractInteractions = recentTransactions.filter(tx => tx.is_contract_interaction);

            const totalSent = sentTransactions.reduce((sum, tx) => sum + parseFloat(tx.value), 0);
            const totalReceived = receivedTransactions.reduce((sum, tx) => sum + parseFloat(tx.value), 0);

            return {
                status: "success",
                message: `✅ Retrieved ${recentTransactions.length} recent transactions for ${targetAddress}`,
                account_info: {
                    address: targetAddress,
                    network: walletAgent.network,
                    is_own_wallet: targetAddress.toLowerCase() === walletAgent.account.address.toLowerCase(),
                    blocks_searched: blocksToCheck,
                    from_block: fromBlock.toString(),
                    to_block: currentBlock.toString()
                },
                transaction_summary: {
                    total_transactions: recentTransactions.length,
                    sent_transactions: sentTransactions.length,
                    received_transactions: receivedTransactions.length,
                    contract_interactions: contractInteractions.length,
                    total_eth_sent: `${totalSent.toFixed(6)} ${nativeCurrency}`,
                    total_eth_received: `${totalReceived.toFixed(6)} ${nativeCurrency}`,
                    net_eth_flow: `${(totalReceived - totalSent).toFixed(6)} ${nativeCurrency}`
                },
                transactions: recentTransactions.map(tx => ({
                    ...tx,
                    explorer_url: `${walletAgent.networkInfo.blockExplorer}/tx/${tx.hash}`,
                    age: tx.timestamp ? getTimeAgo(new Date(tx.timestamp)) : 'Unknown'
                })),
                network_info: {
                    network: walletAgent.network,
                    chain_id: walletAgent.networkInfo.chainId,
                    native_currency: nativeCurrency,
                    block_explorer: walletAgent.networkInfo.blockExplorer,
                    current_block: currentBlock.toString()
                },
                next_steps: recentTransactions.length === 0
                    ? [
                        "🔍 No recent transactions found",
                        `💡 Start by funding your wallet with ${nativeCurrency}`,
                        "🎨 Begin registering RWA assets on Asetta"
                    ]
                    : [
                        "✅ Transaction history retrieved successfully",
                        "🔍 Click explorer URLs to view detailed transaction info",
                        `📊 Found ${contractInteractions.length} smart contract interactions`,
                        "💎 Ready to analyze Asetta Protocol activity"
                    ]
            };
        } catch (error: any) {
            throw new Error(`Failed to get transaction history: ${error.message}`);
        } finally {
            await agent.disconnect();
        }
    }
};


const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}