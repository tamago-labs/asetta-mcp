import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { Address } from "viem";
import { type NetworkType, getContractAddresses } from "../../config";

export const MintUSDCTool: McpTool = {
    name: "asetta_mint_usdc",
    description: "Mint mock USDC tokens for testing RWA purchases",
    schema: {
        amount: z.number()
            .positive()
            .describe("Amount of USDC to mint (e.g., 1000 for 1000 USDC)"),
        recipient: z.string()
            .regex(/^0x[0-9a-fA-F]{40}$/)
            .optional()
            .describe("Recipient address (optional, defaults to wallet address)"),
        network: z.enum(['avalancheFuji', 'ethereumSepolia', 'arbitrumSepolia'])
            .optional()
            .describe("Network to use (optional, defaults to configured network)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            const networkType = input.network as NetworkType;
            const walletAgent = networkType ? new WalletAgent(networkType) : agent;
            
            await walletAgent.connect();

            const contracts = getContractAddresses(walletAgent.network);
            const recipient = (input.recipient || walletAgent.account.address) as Address;
            
            // USDC uses 6 decimals
            const usdcDecimals = 6;
            const amount = BigInt(input.amount * Math.pow(10, usdcDecimals));

            // MockUSDC ABI
            const mockUSDCAbi = [
                {
                    name: 'mint',
                    type: 'function',
                    stateMutability: 'nonpayable',
                    inputs: [
                        { name: 'to', type: 'address' },
                        { name: 'amount', type: 'uint256' }
                    ],
                    outputs: [],
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
                }
            ];

            // Get current balance
            const [currentBalance, symbol] = await Promise.all([
                walletAgent.publicClient.readContract({
                    address: contracts.mockUSDC as Address,
                    abi: mockUSDCAbi,
                    functionName: 'balanceOf',
                    args: [recipient]
                }) as Promise<bigint>,
                walletAgent.publicClient.readContract({
                    address: contracts.mockUSDC as Address,
                    abi: mockUSDCAbi,
                    functionName: 'symbol'
                }) as Promise<string>
            ]);

            console.error(`💰 Minting ${input.amount} ${symbol} to ${recipient}`);
            console.error(`📍 Current balance: ${Number(currentBalance) / Math.pow(10, usdcDecimals)} ${symbol}`);

            // Simulate mint transaction first
            const { request } = await walletAgent.publicClient.simulateContract({
                address: contracts.mockUSDC as Address,
                abi: mockUSDCAbi,
                functionName: 'mint',
                args: [recipient, amount],
                account: walletAgent.account.address
            });

            console.error(`✅ Mint simulation successful. Proceeding with transaction...`);

            // Execute mint transaction
            const txHash = await walletAgent.walletClient.writeContract(request);

            // Wait for confirmation
            const receipt = await walletAgent.publicClient.waitForTransactionReceipt({
                hash: txHash,
                confirmations: 1
            });

            // Get new balance
            const newBalance = await walletAgent.publicClient.readContract({
                address: contracts.mockUSDC as Address,
                abi: mockUSDCAbi,
                functionName: 'balanceOf',
                args: [recipient]
            }) as bigint;

            const currentBalanceFormatted = (Number(currentBalance) / Math.pow(10, usdcDecimals)).toFixed(6);
            const newBalanceFormatted = (Number(newBalance) / Math.pow(10, usdcDecimals)).toFixed(6);
            const mintedAmount = (Number(newBalance - currentBalance) / Math.pow(10, usdcDecimals)).toFixed(6);

            return {
                status: "success",
                message: `✅ Successfully minted ${mintedAmount} ${symbol} to ${recipient}`,
                transaction_details: {
                    transaction_hash: txHash,
                    from: walletAgent.account.address,
                    to: recipient,
                    token_address: contracts.mockUSDC,
                    token_symbol: symbol,
                    amount_minted: `${mintedAmount} ${symbol}`,
                    amount_raw: amount.toString(),
                    decimals: usdcDecimals,
                    gas_used: receipt.gasUsed.toString(),
                    block_number: receipt.blockNumber.toString(),
                    confirmations: 1
                },
                balance_changes: {
                    previous_balance: `${currentBalanceFormatted} ${symbol}`,
                    new_balance: `${newBalanceFormatted} ${symbol}`,
                    increase: `+${mintedAmount} ${symbol}`,
                    recipient: recipient,
                    is_self_mint: recipient.toLowerCase() === walletAgent.account.address.toLowerCase()
                },
                token_info: {
                    contract_address: contracts.mockUSDC,
                    symbol: symbol,
                    decimals: usdcDecimals,
                    type: "Mock USDC",
                    purpose: "Testing token for RWA purchases"
                },
                network_info: {
                    network: walletAgent.network,
                    chain_id: walletAgent.networkInfo.chainId,
                    native_currency: walletAgent.networkInfo.nativeCurrency,
                    explorer_url: `${walletAgent.networkInfo.blockExplorer}/tx/${txHash}`
                },
                next_steps: [
                    "✅ USDC minting confirmed on blockchain",
                    "💎 Ready to use USDC for RWA token purchases",
                    "🔍 View transaction details on block explorer",
                    "🎫 Use asetta_create_rwa_token to create new RWA projects",
                    "💰 Use USDC to purchase RWA tokens through primary distribution"
                ]
            };
        } catch (error: any) {
            throw new Error(`Failed to mint USDC: ${error.message}`);
        } finally {
            await agent.disconnect();
        }
    }
};
