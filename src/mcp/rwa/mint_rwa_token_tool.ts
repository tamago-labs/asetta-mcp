import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { type NetworkType } from "../../config";
import { CHAINLINK_NETWORKS } from "../../contracts/constants/chainlink-networks";
import RWATokenABI from "../../contracts/abis/RWAToken.json";

export const MintRwaTokenTool: McpTool = {
    name: "asetta_mint_rwa_token",
    description: "Mint RWA tokens to a specified address",
    schema: {
        token_address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid token address")
            .describe("RWA token contract address"),
        to: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid recipient address")
            .describe("Recipient address"),
        amount: z.number().positive("Amount must be positive")
            .describe("Amount of tokens to mint"),
        network: z.enum(["avalancheFuji", "ethereumSepolia", "arbitrumSepolia"]).optional()
            .describe("Network to use (optional, defaults to configured network)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            const networkType = input.network as NetworkType;
            const walletAgent = networkType ? new WalletAgent(networkType) : agent;
            await walletAgent.connect();

            const { token_address, to, amount } = input;
            const chainConfig = CHAINLINK_NETWORKS[walletAgent.network];
            
            // Convert amount to wei (18 decimals)
            const amountWei = BigInt(Math.floor(amount * 1e18));

            // Call mint function on RWA token 
            const txHash = await walletAgent.walletClient.writeContract({
                address: token_address as `0x${string}`,
                abi: RWATokenABI.abi,
                functionName: "mint",
                args: [to, amountWei]
            } as any);

            const explorerUrl = chainConfig.chainId === 43113 
                ? `https://testnet.snowtrace.io/tx/${txHash}`
                : chainConfig.chainId === 11155111
                ? `https://sepolia.etherscan.io/tx/${txHash}`
                : `https://sepolia.arbiscan.io/tx/${txHash}`;

            return {
                status: "success",
                message: `Successfully minted ${amount} RWA tokens to ${to}`,
                transaction: {
                    hash: `${txHash}`,
                    explorer_url: explorerUrl,
                    network: walletAgent.network
                },
                details: {
                    token_address,
                    recipient: to,
                    amount_minted: `${amount}`,
                    amount_wei: amountWei.toString()
                }
            };

        } catch (error: any) {
            throw new Error(`Failed to mint RWA tokens: ${error.message || error}`);
        } finally {
            await agent.disconnect();
        }
    }
};
