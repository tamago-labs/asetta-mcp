import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { Address, formatEther } from "viem";
import { type NetworkType } from "../../config";

export const GetTokenInfoTool: McpTool = {
    name: "asetta_get_token_info",
    description: "Get comprehensive information about ERC20 tokens including metadata and user balances",
    schema: {
        token_address: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .describe("Token contract address (use 'WIP' for WIP token shortcut)"),
        account_address: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .optional()
            .describe("Address to check balance for (optional, defaults to wallet address)"),
        network: z.enum(['avalancheFuji', 'ethereumSepolia', 'arbitrumSepolia'])
            .optional()
            .describe("Network to check (optional, defaults to configured network)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            const networkType = input.network as NetworkType;
            const walletAgent = networkType ? new WalletAgent(networkType) : agent;
            
            await walletAgent.connect();

            let tokenAddress = input.token_address as Address;
            const accountAddress = (input.account_address || walletAgent.account.address) as Address;

            // Extended ERC20 ABI for comprehensive token info
            const erc20Abi = [
                {
                    name: 'name',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [],
                    outputs: [{ name: '', type: 'string' }],
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
                    name: 'totalSupply',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [],
                    outputs: [{ name: '', type: 'uint256' }],
                },
                {
                    name: 'balanceOf',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'account', type: 'address' }],
                    outputs: [{ name: '', type: 'uint256' }],
                }
            ];

            // Get basic token information
            const [name, symbol, decimals, totalSupply, balance] = await Promise.all([
                walletAgent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'name'
                }) as Promise<string>,
                walletAgent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'symbol'
                }) as Promise<string>,
                walletAgent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'decimals'
                }) as Promise<number>,
                walletAgent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'totalSupply'
                }) as Promise<bigint>,
                walletAgent.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [accountAddress]
                }) as Promise<bigint>
            ]);

            // Get contract bytecode to verify it's a contract
            const bytecode = await walletAgent.publicClient.getBytecode({
                address: tokenAddress
            });

            const isContract = !!(bytecode && bytecode !== '0x');

            // Calculate formatted values
            const totalSupplyFormatted = formatEther(totalSupply);
            const balanceFormatted = formatEther(balance);
            const balancePercentage = totalSupply > 0 ? (Number(balance) / Number(totalSupply)) * 100 : 0;

            // Determine token type and purpose
            const getTokenInfo = () => {
                return {
                    type: "erc20_token",
                    category: "custom",
                    purpose: "Custom ERC20 token - verify legitimacy before use"
                };
            };

            const tokenInfo = getTokenInfo();

            return {
                status: "success",
                message: `✅ Token information retrieved for ${symbol}`,
                token_metadata: {
                    contract_address: tokenAddress,
                    name: name,
                    symbol: symbol,
                    decimals: decimals,
                    total_supply: totalSupplyFormatted,
                    total_supply_wei: totalSupply.toString(),
                    is_contract: isContract,
                    ...tokenInfo
                },
                account_balance: {
                    address: accountAddress,
                    balance: balanceFormatted,
                    balance_wei: balance.toString(),
                    percentage_of_supply: balancePercentage.toFixed(6) + "%",
                    is_holder: balance > 0,
                    is_own_wallet: accountAddress.toLowerCase() === walletAgent.account.address.toLowerCase()
                },
                supply_analysis: {
                    total_supply_formatted: totalSupplyFormatted,
                    user_balance_formatted: balanceFormatted,
                    supply_concentration: balancePercentage > 1 ? "significant_holder" :
                        balancePercentage > 0.1 ? "moderate_holder" :
                            balancePercentage > 0 ? "small_holder" : "non_holder"
                },
                network_info: {
                    network: walletAgent.network,
                    chain_id: walletAgent.networkInfo.chainId,
                    native_currency: walletAgent.networkInfo.nativeCurrency,
                    block_explorer: walletAgent.networkInfo.blockExplorer,
                    token_explorer_url: `${walletAgent.networkInfo.blockExplorer}/token/${tokenAddress}`,
                    account_explorer_url: `${walletAgent.networkInfo.blockExplorer}/token/${tokenAddress}?a=${accountAddress}`
                },
                operational_status: {
                    has_balance: balance > 0,
                    can_transfer: balance > 0
                },
                next_steps: balance === BigInt(0)
                    ? [
                        `💰 Acquire ${symbol} tokens to use for RWA tokenization`,
                        "⚠️ Verify token legitimacy before using",
                        `🔍 View token details on ${walletAgent.networkInfo.blockExplorer}`,
                        "💡 Use asetta_send_token to receive tokens from others"
                    ]
                    : [
                        `✅ You have ${balanceFormatted} ${symbol} tokens`,
                        "⚠️ Verify token legitimacy before using",
                        "💎 Use asetta_approve_token to enable contract spending",
                        "🔄 Use asetta_send_token to transfer to others"
                    ]
            };
        } catch (error: any) {
            throw new Error(`Failed to get token info: ${error.message}`);
        } finally {
            await agent.disconnect();
        }
    }
};
