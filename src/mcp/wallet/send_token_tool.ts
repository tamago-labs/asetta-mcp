import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { parseEther, Address, formatEther } from "viem"; 
import { type NetworkType } from "../../config";

export const SendTokenTool: McpTool = {
    name: "asetta_send_token",
    description: "Send ERC-20 tokens to another address",
    schema: {
        token_address: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .describe("Token contract address"),
        destination: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .describe("Recipient's Ethereum address"),
        amount: z.number()
            .positive()
            .describe("Amount of tokens to send"),
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
            let tokenAddress = input.token_address as Address;
            
            const amount = parseEther(input.amount.toString());

            // ERC20 ABI for token operations
            const erc20Abi = [
                {
                    name: 'transfer',
                    type: 'function',
                    stateMutability: 'nonpayable',
                    inputs: [
                        { name: 'to', type: 'address' },
                        { name: 'amount', type: 'uint256' }
                    ],
                    outputs: [{ name: '', type: 'bool' }],
                },
                {
                    name: 'balanceOf',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'account', type: 'address' }],
                    outputs: [{ name: '', type: 'uint256' }],
                },
                {
                    name: 'symbol',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [],
                    outputs: [{ name: '', type: 'string' }],
                },
                {
                    name: 'decimals',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [],
                    outputs: [{ name: '', type: 'uint8' }],
                }
            ];

            // Get token info
            const [balance, symbol, decimals] = await Promise.all([
                walletAgent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [walletAgent.account.address]
                }) as Promise<bigint>,
                walletAgent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'symbol'
                }) as Promise<string>,
                walletAgent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'decimals'
                }) as Promise<number>
            ]);

            if (balance < amount) {
                throw new Error(`Insufficient ${symbol} balance. Available: ${formatEther(balance)}, Required: ${input.amount}`);
            }

            // Simulate token transfer first to catch errors and get accurate gas estimate
            const { request, result } = await walletAgent.publicClient.simulateContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'transfer',
                args: [destination, amount],
                account: walletAgent.account.address
            });

            console.error(`✅ Transfer simulation successful. Proceeding with transaction...`);

            // Send token transfer transaction using the simulated request
            const txHash = await walletAgent.walletClient.writeContract(request);

            // Wait for confirmation
            const receipt = await walletAgent.publicClient.waitForTransactionReceipt({
                hash: txHash,
                confirmations: 1
            });

            return {
                status: "success",
                message: `✅ Successfully sent ${input.amount} ${symbol} to ${destination}`,
                transaction_details: {
                    transaction_hash: txHash,
                    from: walletAgent.account.address,
                    to: destination,
                    token_address: tokenAddress,
                    token_symbol: symbol,
                    amount: `${input.amount} ${symbol}`,
                    amount_wei: amount.toString(),
                    decimals: decimals,
                    gas_used: receipt.gasUsed.toString(),
                    block_number: receipt.blockNumber.toString(),
                    confirmations: 1,
                    memo: input.memo || "N/A"
                },
                token_info: {
                    contract_address: tokenAddress,
                    symbol: symbol,
                    decimals: decimals
                },
                network_info: {
                    network: walletAgent.network,
                    chain_id: walletAgent.networkInfo.chainId,
                    native_currency: walletAgent.networkInfo.nativeCurrency,
                    explorer_url: `${walletAgent.networkInfo.blockExplorer}/tx/${txHash}`
                },
                next_steps: [
                    "✅ Token transfer confirmed on blockchain",
                    "🔍 View transaction details on block explorer",
                    `💎 Recipient can now use ${symbol} tokens for on-chain operations`
                ]
            };
        } catch (error: any) {
            throw new Error(`Failed to send tokens: ${error.message}`);
        } finally {
            await agent.disconnect();
        }
    }
};
