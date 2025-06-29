import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { type NetworkType } from "../../config";
import { CHAINLINK_NETWORKS } from "../../contracts/constants/chainlink-networks";

// Standard ERC20 ABI for approve function
const ERC20_ABI = [
  {
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const ApproveRouterTool: McpTool = {
    name: "asetta_approve_ccip_router", 
    description: "Approve CCIP router to spend RWA tokens for cross-chain transfers",
    schema: {
        token_address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid token address")
            .describe("RWA token contract address"),
        amount: z.number().positive("Amount must be positive")
            .describe("Amount of tokens to approve"),
        approve_link_for_fees: z.boolean().optional().default(false)
            .describe("Also approve LINK tokens for CCIP fees (optional, only if not using native fees)"),
        link_fee_amount: z.number().positive().optional().default(100)
            .describe("Amount of LINK to approve for fees (default: 100 LINK)"),
        network: z.enum(["avalancheFuji", "ethereumSepolia", "arbitrumSepolia"]).optional()
            .describe("Network to use (optional, defaults to configured network)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            const networkType = input.network as NetworkType;
            const walletAgent = networkType ? new WalletAgent(networkType) : agent;
            await walletAgent.connect();

            const { 
                token_address, 
                amount, 
                approve_link_for_fees = false,
                link_fee_amount = 100
            } = input;

            const chainConfig = CHAINLINK_NETWORKS[walletAgent.network];
            const amountWei = BigInt(Math.floor(amount * 1e18));
            const linkAmountWei = BigInt(Math.floor(link_fee_amount * 1e18));

            const approvals = [];

            // 1. Approve RWA token for router  
            const tokenTxHash = await walletAgent.walletClient.writeContract({
                address: token_address as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [chainConfig.routerAddress as `0x${string}`, amountWei]
            } as any);

            const tokenTxReceipt = await walletAgent.publicClient.waitForTransactionReceipt({
                hash: tokenTxHash
            });

            approvals.push({
                type: "RWA Token Approval",
                token_address,
                amount_approved: amount,
                tx_hash: tokenTxHash,
                gas_used: tokenTxReceipt.gasUsed.toString(),
                status: "success"
            });

            // 2. Approve LINK token for fees (if requested)
            if (approve_link_for_fees) {
                try { 

                    const linkTxHash = await walletAgent.walletClient.writeContract({
                        address: chainConfig.linkAddress as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [chainConfig.routerAddress as `0x${string}`, linkAmountWei]
                    } as any);
                    const linkTxReceipt = await walletAgent.publicClient.waitForTransactionReceipt({
                        hash: linkTxHash
                    });

                    approvals.push({
                        type: "LINK Token Approval",
                        token_address: chainConfig.linkAddress,
                        amount_approved: `${link_fee_amount}`,
                        tx_hash: linkTxHash,
                        gas_used: linkTxReceipt.gasUsed.toString(),
                        status: "success"
                    });

                } catch (linkError: any) {
                    console.warn("LINK approval failed (may not have LINK tokens):", linkError.message);
                    approvals.push({
                        type: "LINK Token Approval",
                        status: "failed",
                        error: linkError.message,
                        note: "LINK approval failed - you can still use native tokens for fees"
                    });
                }
            }

            const explorerUrl = chainConfig.chainId === 43113 
                ? `https://testnet.snowtrace.io/tx/${tokenTxHash}`
                : chainConfig.chainId === 11155111
                ? `https://sepolia.etherscan.io/tx/${tokenTxHash}`
                : `https://sepolia.arbiscan.io/tx/${tokenTxHash}`;

            return {
                status: "success",
                message: `Successfully approved CCIP router for RWA token transfers`,
                primary_transaction: {
                    hash: tokenTxHash,
                    explorer_url: explorerUrl,
                    network: walletAgent.network
                },
                approvals,
                router_details: {
                    router_address: chainConfig.routerAddress,
                    link_address: chainConfig.linkAddress,
                    approved_for_rwa_tokens: true,
                    approved_for_link_fees: approve_link_for_fees && approvals.some(a => a.type === "LINK Token Approval" && a.status === "success")
                },
                fee_payment_options: {
                    native_token: `Use native ${walletAgent.networkInfo.nativeCurrency} (recommended, no approval needed)`,
                    link_token: approve_link_for_fees ? "LINK token approved for fees" : "LINK token not approved (use approve_link_for_fees: true)",
                    recommendation: `Use native ${walletAgent.networkInfo.nativeCurrency} for simplicity`
                }
            };

        } catch (error: any) {
            throw new Error(`Failed to approve CCIP router: ${error.message || error}`);
        } finally {
            await agent.disconnect();
        }
    }
};
