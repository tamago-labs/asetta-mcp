import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { Address } from "viem";
import { type NetworkType, getContractAddresses } from "../../config";

export const GetUSDCBalanceTool: McpTool = {
    name: "asetta_get_usdc_balance",
    description: "Get USDC balance for wallet (shortcut for USDC-specific info)",
    schema: {
        account_address: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .optional()
            .describe("Address to check (optional, defaults to wallet address)"),
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
            const contracts = getContractAddresses(walletAgent.network);

            // ERC20 ABI for USDC
            const erc20Abi = [
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

            // Get USDC token info and balance
            const [balance, symbol, decimals, name] = await Promise.all([
                walletAgent.publicClient.readContract({
                    address: contracts.mockUSDC as Address,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [targetAddress]
                }) as Promise<bigint>,
                walletAgent.publicClient.readContract({
                    address: contracts.mockUSDC as Address,
                    abi: erc20Abi,
                    functionName: 'symbol'
                }) as Promise<string>,
                walletAgent.publicClient.readContract({
                    address: contracts.mockUSDC as Address,
                    abi: erc20Abi,
                    functionName: 'decimals'
                }) as Promise<number>,
                walletAgent.publicClient.readContract({
                    address: contracts.mockUSDC as Address,
                    abi: erc20Abi,
                    functionName: 'name'
                }) as Promise<string>
            ]);

            // Format balance
            const balanceFormatted = (Number(balance) / Math.pow(10, decimals)).toFixed(6);
            const hasBalance = Number(balanceFormatted) > 0;

            return {
                status: "success",
                message: `✅ USDC balance retrieved for ${targetAddress}`,
                account_info: {
                    address: targetAddress,
                    network: walletAgent.network,
                    chain_id: walletAgent.networkInfo.chainId,
                    is_own_wallet: targetAddress.toLowerCase() === walletAgent.account.address.toLowerCase()
                },
                usdc_details: {
                    contract_address: contracts.mockUSDC,
                    name: name,
                    symbol: symbol,
                    decimals: decimals,
                    balance: balanceFormatted,
                    balance_raw: balance.toString(),
                    usd_value: balanceFormatted, // USDC is pegged to USD
                    has_balance: hasBalance
                },
                usage_info: {
                    purpose: "Mock USDC for testing RWA purchases",
                    can_mint: true,
                    mint_command: "asetta_mint_usdc",
                    ready_for_rwa_purchases: hasBalance
                },
                network_info: {
                    network: walletAgent.network,
                    chain_id: walletAgent.networkInfo.chainId,
                    native_currency: walletAgent.networkInfo.nativeCurrency,
                    block_explorer: walletAgent.networkInfo.blockExplorer,
                    token_explorer_url: `${walletAgent.networkInfo.blockExplorer}/token/${contracts.mockUSDC}`
                },
                recommendations: hasBalance 
                    ? [
                        `✅ You have ${balanceFormatted} USDC available`,
                        "💎 Ready to purchase RWA tokens",
                        "🎫 Use for primary distribution purchases",
                        "🔄 Can transfer to other addresses if needed"
                    ]
                    : [
                        "💰 No USDC balance detected",
                        "🏭 Use asetta_mint_usdc to mint test USDC",
                        "💡 USDC needed for RWA token purchases",
                        "🎯 Mint recommended amount: 1000-10000 USDC"
                    ],
                quick_actions: hasBalance
                    ? [
                        `📊 Current balance: ${balanceFormatted} USDC`,
                        "🔄 Transfer: asetta_send_token",
                        "🎫 Create RWA: asetta_create_rwa_token",
                        "💎 Approve spending: asetta_approve_token"
                    ]
                    : [
                        "🏭 Mint USDC: asetta_mint_usdc",
                        "💡 Example: mint 5000 USDC",
                        "🎯 Then ready for RWA purchases"
                    ]
            };
        } catch (error: any) {
            throw new Error(`Failed to get USDC balance: ${error.message}`);
        } finally {
            await agent.disconnect();
        }
    }
};
