import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { type NetworkType } from "../../config";
import { CHAINLINK_NETWORKS } from "../../contracts/constants/chainlink-networks";
import { encodeAbiParameters, parseAbiParameters } from "viem";

// CCIP Router ABI for ccipSend function
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
    "name": "ccipSend",
    "outputs": [{"name": "messageId", "type": "bytes32"}],
    "stateMutability": "payable", 
    "type": "function"
  },
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

export const TransferRwaTokenCrossChainTool: McpTool = {
    name: "asetta_transfer_rwa_cross_chain",
    description: "Transfer RWA tokens across chains using Chainlink CCIP",
    schema: {
        token_address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid token address")
            .describe("RWA token contract address"),
        to: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid recipient address")
            .describe("Recipient address on destination chain"),
        amount: z.number().positive("Amount must be positive")
            .describe("Amount of tokens to transfer"),
        destination_chain_selector: z.string().min(1, "Destination chain selector required")
            .describe("CCIP chain selector for destination (e.g., '16015286601757825753' for Ethereum Sepolia)"),
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
                to, 
                amount, 
                destination_chain_selector,
                use_native_fee = true,
                fee_token_address,
                gas_limit = 0
            } = input;

            const chainConfig = CHAINLINK_NETWORKS[walletAgent.network];
            const amountWei = BigInt(Math.floor(amount * 1e18));

            // Determine fee token: custom > native > LINK
            let feeToken: string;
            let useNativeForPayment = false;

            if (fee_token_address) {
                feeToken = fee_token_address;
            } else if (use_native_fee) {
                feeToken = "0x0000000000000000000000000000000000000000"; // Address(0) for native token
                useNativeForPayment = true;
            } else {
                feeToken = chainConfig.linkAddress; // Use LINK
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
                    [to as `0x${string}`]
                ), // Encode receiver address like abi.encode(address(alice))
                data: "0x" as `0x${string}`,
                tokenAmounts: [{
                    token: token_address as `0x${string}`,
                    amount: amountWei
                }],
                feeToken: feeToken as `0x${string}`,
                extraArgs: extraArgs as `0x${string}` // Properly encoded gas limit
            };

            // Get fee estimate first
            const fee = await walletAgent.publicClient.readContract({
                address: chainConfig.routerAddress as `0x${string}`,
                abi: CCIP_ROUTER_ABI,
                functionName: "getFee",
                args: [BigInt(destination_chain_selector), message]
            });

            console.error(`Estimated CCIP fee: ${fee} wei (${useNativeForPayment ? 'native token' : 'fee token'})`);

            // Execute the cross-chain transfer
   
            const txHash = await walletAgent.walletClient.writeContract({
                address: chainConfig.routerAddress as `0x${string}`,
                abi: CCIP_ROUTER_ABI,
                functionName: "ccipSend",
                args: [BigInt(destination_chain_selector), message], 
                value: useNativeForPayment ? fee as bigint : 0n // Pay with native token if specified
            } as any);

            // Wait for transaction receipt to get messageId from logs
            const txReceipt = await walletAgent.publicClient.waitForTransactionReceipt({
                hash: txHash
            });

            // Extract messageId from transaction logs (first log should contain the messageId)
            const messageId = txReceipt.logs.length > 0 ? txReceipt.logs[0].topics[1] : "0x";

            const explorerUrl = chainConfig.chainId === 43113 
                ? `https://testnet.snowtrace.io/tx/${txHash}`
                : chainConfig.chainId === 11155111
                ? `https://sepolia.etherscan.io/tx/${txHash}`
                : `https://sepolia.arbiscan.io/tx/${txHash}`;

            const feeTokenName = useNativeForPayment 
                ? walletAgent.networkInfo.nativeCurrency
                : fee_token_address 
                ? "Custom Token" 
                : "LINK";

            return {
                status: "success",
                message: `Successfully initiated cross-chain transfer of ${amount} RWA tokens to ${to}`,
                transaction: {
                    hash: txHash,
                    message_id: messageId,
                    explorer_url: explorerUrl,
                    network: walletAgent.network
                },
                transfer_details: {
                    token_address,
                    recipient: to,
                    amount_transferred: amount,
                    amount_wei: amountWei.toString(),
                    destination_chain_selector,
                    fee_paid: (fee as bigint).toString(),
                    fee_token: feeToken,
                    fee_token_name: feeTokenName,
                    gas_limit,
                    gas_used: txReceipt.gasUsed.toString(),
                    paid_with_native: useNativeForPayment
                },
                ccip_config: {
                    router_address: chainConfig.routerAddress,
                    link_address: chainConfig.linkAddress,
                    extra_args_encoded: extraArgs,
                    receiver_encoded: message.receiver,
                    fee_payment_method: useNativeForPayment ? "Native Token" : feeTokenName
                }
            };

        } catch (error: any) {
            console.error("CCIP Transfer Error:", error);
            throw new Error(`Failed to transfer RWA tokens cross-chain: ${error.message || error}`);
        } finally {
            await agent.disconnect();
        }
    }
};
