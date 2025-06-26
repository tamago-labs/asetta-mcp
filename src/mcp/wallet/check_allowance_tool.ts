import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { Address, formatEther } from "viem"; 

export const CheckAllowanceTool: McpTool = {
    name: "asetta_check_allowance",
    description: "Check token allowance for smart contracts and other spenders",
    schema: {
        token_address: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .describe("Token contract address"),
        owner: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .optional()
            .describe("Token owner address (optional, defaults to wallet address)"),
        spender: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .describe("Spender contract address to check allowance for")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            await agent.connect();

            let tokenAddress = input.token_address as Address;
            const owner = (input.owner || agent.account.address) as Address;
            const spender = input.spender as Address;
            
            // ERC20 ABI for allowance operations
            const erc20Abi = [
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
                },
                {
                    name: 'name',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [],
                    outputs: [{ name: '', type: 'string' }],
                }
            ];

            // Get token info and allowance
            const [allowance, balance, symbol, decimals, name] = await Promise.all([
                agent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'allowance',
                    args: [owner, spender]
                }) as Promise<bigint>,
                agent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [owner]
                }) as Promise<bigint>,
                agent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'symbol'
                }) as Promise<string>,
                agent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'decimals'
                }) as Promise<number>,
                agent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'name'
                }) as Promise<string>
            ]);

            // Check if allowance is unlimited (max uint256)
            const maxUint256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
            const isUnlimited = allowance >= maxUint256 / BigInt(2); // Close to max value

            // Calculate allowance status
            const allowanceFormatted = isUnlimited ? "Unlimited" : formatEther(allowance);
            const balanceFormatted = formatEther(balance);
            const canSpendBalance = allowance >= balance;
            const needsApproval = allowance === BigInt(0);

            // Determine approval recommendations
            const getRecommendations = () => {
                if (needsApproval) {
                    return [
                        "⚠️ No allowance set - approval required",
                        `Use asetta_approve_token to approve ${symbol} spending`,
                        "Recommend setting unlimited approval for convenience"
                    ];
                } else if (!canSpendBalance && !isUnlimited) {
                    return [
                        "⚠️ Allowance is less than current balance",
                        `Current allowance: ${allowanceFormatted} ${symbol}`,
                        `Current balance: ${balanceFormatted} ${symbol}`,
                        "Consider increasing allowance for full balance access"
                    ];
                } else if (isUnlimited) {
                    return [
                        "✅ Unlimited allowance set",
                        "No further approvals needed for this token",
                        "Ready for all on-chain operations"
                    ];
                } else {
                    return [
                        "✅ Sufficient allowance for current balance",
                        `Can spend up to ${allowanceFormatted} ${symbol}`,
                        "Ready for on-chain operations"
                    ];
                }
            };

            return {
                status: "success",
                message: `✅ Allowance checked for ${symbol} token`,
                allowance_details: {
                    token_address: tokenAddress,
                    token_name: name,
                    token_symbol: symbol,
                    token_decimals: decimals,
                    owner: owner,
                    spender: spender,
                    allowance: allowanceFormatted,
                    allowance_wei: allowance.toString(),
                    is_unlimited: isUnlimited,
                    is_zero: allowance === BigInt(0)
                },
                balance_comparison: {
                    owner_balance: balanceFormatted,
                    owner_balance_wei: balance.toString(),
                    can_spend_full_balance: canSpendBalance,
                    allowance_vs_balance: allowance >= balance ? "sufficient" : "insufficient"
                },
                contract_info: { 
                    spender_contract: spender,
                    is_own_wallet: owner.toLowerCase() === agent.account.address.toLowerCase()
                },
                operational_status: {
                    needs_approval: needsApproval,
                    ready_for_operations: !needsApproval,
                    can_spend_tokens: allowance > 0,
                    approval_sufficient: canSpendBalance || isUnlimited
                },
                network_info: {
                    network: agent.network,
                    block_explorer: agent.networkInfo.blockExplorer,
                    token_explorer_url: `${agent.networkInfo.blockExplorer}/token/${tokenAddress}`
                },
                recommendations: getRecommendations(),
                next_steps: needsApproval 
                    ? [
                        `🔧 Run: asetta_approve_token with token_address=${tokenAddress}`,
                        `📄 Specify spender=${spender}`,
                        "💡 Consider unlimited approval for convenience",
                        "🎨 Then proceed with on-chain operations"
                    ]
                    : [
                        "✅ Allowance is properly configured",
                        "🎨 Ready to proceed with on-chain operations",
                        `💎 Can spend ${canSpendBalance ? 'full balance' : 'partial balance'} of ${symbol}`,
                        "🔍 View token details on block explorer"
                    ]
            };
        } catch (error: any) {
            throw new Error(`Failed to check allowance: ${error.message}`);
        } finally {
            await agent.disconnect();
        }
    }
};