import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { formatEther, Address } from "viem";
import { type NetworkType, getContractAddresses } from "../../config";

export const GetAccountBalancesTool: McpTool = {
    name: "asetta_get_account_balances",
    description: "Get all token balances including native tokens and USDC",
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
            const contracts = getContractAddresses(walletAgent.network);

            // Get native balance (ETH/AVAX)
            const nativeBalance = await walletAgent.publicClient.getBalance({
                address: targetAddress
            });

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
                    name: 'decimals',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [],
                    outputs: [{ name: '', type: 'uint8' }],
                }
            ];

            // Get USDC balance
            let usdcBalance = BigInt(0);
            let usdcDecimals = 6;
            try {
                [usdcBalance, usdcDecimals] = await Promise.all([
                    walletAgent.publicClient.readContract({
                        address: contracts.mockUSDC as Address,
                        abi: erc20Abi,
                        functionName: 'balanceOf',
                        args: [targetAddress]
                    }) as Promise<bigint>,
                    walletAgent.publicClient.readContract({
                        address: contracts.mockUSDC as Address,
                        abi: erc20Abi,
                        functionName: 'decimals'
                    }) as Promise<number>
                ]);
            } catch (error) {
                console.error('Failed to get USDC balance:', error);
            }

            // Format balances
            const nativeFormatted = formatEther(nativeBalance);
            const usdcFormatted = (Number(usdcBalance) / Math.pow(10, usdcDecimals)).toFixed(6);

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
                    balance: nativeFormatted,
                    balance_wei: nativeBalance.toString(),
                    usd_value: "N/A"
                },
                usdc_balance: {
                    symbol: "USDC",
                    balance: usdcFormatted,
                    balance_raw: usdcBalance.toString(),
                    decimals: usdcDecimals,
                    contract_address: contracts.mockUSDC,
                    usd_value: usdcFormatted // USDC is pegged to USD
                },
                portfolio_summary: {
                    total_native_balance: nativeFormatted,
                    total_usdc_balance: usdcFormatted,
                    can_pay_gas: Number(nativeFormatted) > 0.001,
                    ready_for_operations: Number(nativeFormatted) > 0.001,
                    has_usdc: Number(usdcFormatted) > 0
                },
                next_steps: Number(nativeFormatted) < 0.001
                    ? [
                        `🔋 Fund wallet with ${nativeCurrency} for gas fees`,
                        "🎨 Ready for tokenization once funded",
                        Number(usdcFormatted) === 0 ? "💰 Consider minting USDC for RWA purchases" : "✅ USDC balance available for RWA purchases"
                    ]
                    : [
                        `✅ Sufficient ${nativeCurrency} for gas fees`,
                        "🎫 Ready for RWA tokenization",
                        Number(usdcFormatted) === 0 ? "💰 Consider minting USDC for RWA purchases" : `💰 ${usdcFormatted} USDC available for RWA purchases`
                    ]
            };
        } catch (error: any) {
            throw new Error(`Failed to get account balances: ${error.message}`);
        } finally {
            await agent.disconnect();
        }
    }
};
