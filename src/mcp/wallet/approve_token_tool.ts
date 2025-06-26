import { z } from "zod";
import { WalletAgent } from "../../agent/wallet"
import { type McpTool } from "../../types";
import { parseEther, Address, formatEther, maxUint256 } from "viem";

export const ApproveTokenTool: McpTool = {
    name: "asetta_approve_token",
    description: "Approve smart contracts to spend your tokens",
    schema: {
        token_address: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .describe("Token contract address"),
        spender: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .describe("Contract address to approve"),
        amount: z.number()
            .positive()
            .optional()
            .describe("Amount to approve (optional, defaults to unlimited)"),
        unlimited: z.boolean()
            .default(true)
            .describe("Set unlimited approval (recommended for convenience)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            await agent.connect();

            let tokenAddress = input.token_address as Address;
            const spender = input.spender as Address;
            
            const amount = input.unlimited || !input.amount 
                ? maxUint256 
                : parseEther(input.amount.toString());

            // ERC20 ABI for approval operations
            const erc20Abi = [
                {
                    name: 'approve',
                    type: 'function',
                    stateMutability: 'nonpayable',
                    inputs: [
                        { name: 'spender', type: 'address' },
                        { name: 'amount', type: 'uint256' }
                    ],
                    outputs: [{ name: '', type: 'bool' }],
                },
                {
                    name: 'allowance',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [
                        { name: 'owner', type: 'address' },
                        { name: 'spender', type: 'address' }
                    ],
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
                    name: 'balanceOf',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'account', type: 'address' }],
                    outputs: [{ name: '', type: 'uint256' }],
                }
            ];

            // Get current allowance and token info
            const [currentAllowance, symbol, balance] = await Promise.all([
                agent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'allowance',
                    args: [agent.account.address, spender]
                }) as Promise<bigint>,
                agent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'symbol'
                }) as Promise<string>,
                agent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [agent.account.address]
                }) as Promise<bigint>
            ]);

            // Check if approval is needed
            if (currentAllowance >= amount && amount !== maxUint256) {
                return {
                    status: "success",
                    message: `✅ Sufficient approval already exists for ${symbol}`,
                    approval_details: {
                        token_address: tokenAddress,
                        token_symbol: symbol,
                        spender: spender,
                        current_allowance: input.unlimited ? "Unlimited" : formatEther(currentAllowance),
                        requested_amount: input.unlimited ? "Unlimited" : input.amount?.toString(),
                        approval_needed: false
                    },
                    wallet_info: {
                        balance: formatEther(balance),
                        address: agent.account.address
                    },
                    next_steps: [
                        "✅ Approval already sufficient",
                        "🎨 Ready to proceed with on-chain operations",
                        "💡 No additional transaction needed"
                    ]
                };
            }

            // Simulate approval first to catch errors and get accurate gas estimate
            const { request, result } = await agent.publicClient.simulateContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'approve',
                args: [spender, amount],
                account: agent.account.address
            });

            console.error(`✅ Approval simulation successful. Proceeding with transaction...`);

            // Send approval transaction using the simulated request
            const txHash = await agent.walletClient.writeContract(request);

            // Wait for confirmation
            const receipt = await agent.publicClient.waitForTransactionReceipt({
                hash: txHash,
                confirmations: 1
            });

            // Get new allowance
            const newAllowance = await agent.publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'allowance',
                args: [agent.account.address, spender]
            }) as bigint;

            return {
                status: "success",
                message: `✅ Successfully approved ${symbol} spending for smart contract`,
                transaction_details: {
                    transaction_hash: txHash,
                    from: agent.account.address,
                    token_address: tokenAddress,
                    token_symbol: symbol,
                    spender: spender,
                    approved_amount: input.unlimited ? "Unlimited" : input.amount?.toString(),
                    gas_used: receipt.gasUsed.toString(),
                    block_number: receipt.blockNumber.toString(),
                    confirmations: 1
                },
                approval_details: {
                    previous_allowance: formatEther(currentAllowance),
                    new_allowance: amount === maxUint256 ? "Unlimited" : formatEther(newAllowance),
                    is_unlimited: amount === maxUint256,
                    spender_contract: spender
                },
                wallet_info: {
                    balance: formatEther(balance),
                    address: agent.account.address
                },
                network_info: {
                    network: agent.network,
                    explorer_url: `${agent.networkInfo.blockExplorer}/tx/${txHash}`
                },
                next_steps: [
                    "✅ Token approval confirmed on blockchain", 
                    "💎 Smart contracts can now spend your tokens",
                    "🔍 View transaction details on block explorer"
                ]
            };
        } catch (error: any) {
            throw new Error(`Failed to approve tokens: ${error.message}`);
        } finally {
            await agent.disconnect();
        }
    }
};