import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { type NetworkType } from "../../config";
import { CHAINLINK_NETWORKS } from "../../contracts/constants/chainlink-networks";
import { encodeAbiParameters, parseAbiParameters, formatEther } from "viem";

// CCIP Router ABI (simplified - only the functions we need)
const CCIP_ROUTER_ABI = [
  {
    "inputs": [
      {
        "name": "destinationChainSelector",
        "type": "uint64"
      },
      {
        "name": "message",
        "type": "tuple",
        "components": [
          {"name": "receiver", "type": "bytes"},
          {"name": "data", "type": "bytes"},
          {"name": "tokenAmounts", "type": "tuple[]", "components": [
            {"name": "token", "type": "address"},
            {"name": "amount", "type": "uint256"}
          ]},
          {"name": "feeToken", "type": "address"},
          {"name": "extraArgs", "type": "bytes"}
        ]
      }
    ],
    "name": "getFee",
    "outputs": [{"name": "fee", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const GetCrossChainFeeTool: McpTool = {
    name: "asetta_get_cross_chain_fee",
    description: "Get estimated fee for cross-chain RWA token transfer using CCIP",
    schema: {
        token_address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid token address")
            .describe("RWA token contract address"),
        amount: z.number().positive("Amount must be positive")
            .describe("Amount of tokens to transfer"),
        destination_account: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid recipient address")
            .describe("Recipient address on destination chain"),
        destination_chain_selector: z.string().min(1, "Destination chain selector required")
            .describe("CCIP chain selector for destination"),
        use_native_fee: z.boolean().optional().default(true)
            .describe("Use native token (AVAX/ETH) for fees instead of LINK (default: true)"),
        fee_token_address: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional()
            .describe("Custom fee token address (optional, overrides use_native_fee)"),
        gas_limit: z.number().min(0).optional().default(0)
            .describe("Gas limit for destination chain execution (optional, 0 for auto)"),
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
                destination_account,
                destination_chain_selector,
                use_native_fee = true,
                fee_token_address,
                gas_limit = 0
            } = input;

            const chainConfig = CHAINLINK_NETWORKS[walletAgent.network];
            const amountWei = BigInt(Math.floor(amount * 1e18));

            // Determine fee token: custom > native > LINK
            let feeToken: string;
            let feeTokenName: string;

            if (fee_token_address) {
                feeToken = fee_token_address;
                feeTokenName = "Custom Token";
            } else if (use_native_fee) {
                feeToken = "0x0000000000000000000000000000000000000000"; // Address(0) for native token
                feeTokenName = walletAgent.networkInfo.nativeCurrency;
            } else {
                feeToken = chainConfig.linkAddress; // Use LINK
                feeTokenName = "LINK";
            }

            // Encode extraArgs with proper CCIP tag (following Client._argsToBytes pattern)
            // Use EVMExtraArgsV1 tag for most EVM testnets
            const TAG_EVM_EXTRA_ARGS_V1 = '0x97a657c9';
            
            let extraArgs: `0x${string}`;
            if (gas_limit === 0) {
                // For default gas limit, use empty extraArgs (router uses 200k default)
                extraArgs = '0x';
            } else {
                // EVMExtraArgsV1 = bytes4 tag || uint256 gasLimit || bool strict
                extraArgs = encodeAbiParameters(
                    parseAbiParameters('bytes4,uint256,bool'),
                    [TAG_EVM_EXTRA_ARGS_V1 as `0x${string}`, BigInt(gas_limit), false] // strict = false
                ) as `0x${string}`;
            }

            // Prepare CCIP message following the working test pattern
            const message = {
                receiver: encodeAbiParameters(
                    parseAbiParameters("address"),
                    [destination_account as `0x${string}`]
                ), // Encode receiver address like abi.encode(address(alice))
                data: "0x" as `0x${string}`,
                tokenAmounts: [{
                    token: token_address as `0x${string}`,
                    amount: amountWei
                }],
                feeToken: feeToken as `0x${string}`,
                extraArgs: extraArgs as `0x${string}` // Properly encoded gas limit
            };

            // Get fee estimate using contract call
            const fee = await walletAgent.publicClient.readContract({
                address: chainConfig.routerAddress as `0x${string}`,
                abi: CCIP_ROUTER_ABI,
                functionName: "getFee",
                args: [BigInt(destination_chain_selector), message]
            });
 
            const feeFormatted = formatEther(fee as bigint);

            return {
                status: "success",
                message: `Cross-chain transfer fee estimated successfully`,
                fee_details: {
                    fee_wei: (fee as bigint).toString(),
                    fee_formatted: `${feeFormatted} ${feeTokenName}`,
                    fee_token_address: feeToken,
                    fee_token_name: feeTokenName,
                    payment_method: use_native_fee ? "Native Token" : feeTokenName,
                    network: walletAgent.network,
                    destination_chain_selector
                },
                transfer_info: {
                    token_address,
                    amount_to_transfer: amount,
                    destination_account,
                    gas_limit,
                    estimated_total_cost: `${feeFormatted} ${feeTokenName}`
                },
                ccip_config: {
                    router_address: chainConfig.routerAddress,
                    link_address: chainConfig.linkAddress,
                    extra_args_encoded: extraArgs,
                    receiver_encoded: message.receiver,
                    supports_native_fees: true,
                    supports_link_fees: true
                }
            };

        } catch (error: any) {
            console.error("CCIP Fee Estimation Error:", error);
            throw new Error(`Failed to get cross-chain fee: ${error.message || error}`);
        } finally {
            await agent.disconnect();
        }
    }
};
