import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { 
  getContract,
  getAddress,
  encodeAbiParameters
} from 'viem';
import { CHAINLINK_NETWORKS, type ChainlinkNetwork, DEFAULT_RATE_LIMIT_CONFIG } from '../../contracts/constants/chainlink-networks.js';
import BurnMintTokenPoolABI from '../../contracts/abis/BurnMintTokenPool.json' assert { type: 'json' };

interface ChainConnection {
    source_chain: string;
    target_chain: string;
    connected: boolean;
    transaction_hash?: string;
    error?: string;
}

export const ConnectCCIPChainsTool: McpTool = {
    name: "asetta_connect_ccip_chains",
    description: "Configure cross-chain connections between CCIP pools on different networks",
    schema: {
        sourceChain: z.enum(['ethereumSepolia', 'arbitrumSepolia', 'avalancheFuji'])
            .describe("Source chain to configure connections from"),
        targetChains: z.array(z.enum(['ethereumSepolia', 'arbitrumSepolia', 'avalancheFuji']))
            .describe("Target chains to connect to"),
        poolAddresses: z.record(z.string().regex(/^0x[a-fA-F0-9]{40}$/))
            .describe("Pool addresses for each network (network -> poolAddress)"),
        tokenAddresses: z.record(z.string().regex(/^0x[a-fA-F0-9]{40}$/))
            .describe("RWA token addresses for each network (network -> tokenAddress)"),
        rateLimitConfig: z.object({
            capacity: z.number().positive().describe("Maximum capacity for rate limiter"),
            rate: z.number().positive().describe("Rate of token refill per second")
        }).optional().describe("Rate limiting configuration (optional, uses defaults)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            const { 
                sourceChain, 
                targetChains, 
                poolAddresses, 
                tokenAddresses, 
                rateLimitConfig 
            } = input;
            
            const rateLimits = rateLimitConfig || DEFAULT_RATE_LIMIT_CONFIG;
            const sourceNetworkConfig = CHAINLINK_NETWORKS[sourceChain as ChainlinkNetwork];
            
            if (!sourceNetworkConfig) {
                throw new Error(`Unsupported source chain: ${sourceChain}`);
            }
            
            // Use the source network
            const walletAgent = sourceChain !== agent.network ? new WalletAgent(sourceChain) : agent;
            await walletAgent.connect();
            
            const connections: ChainConnection[] = [];
            
            // Get source pool contract
            const sourcePoolAddress = poolAddresses[sourceChain];
            if (!sourcePoolAddress) {
                throw new Error(`Pool address not provided for source chain: ${sourceChain}`);
            }
            
            const sourcePool = getContract({
                address: getAddress(sourcePoolAddress),
                abi: BurnMintTokenPoolABI.abi,
                client: walletAgent.walletClient
            });
            
            // Build chain updates for all target chains
            const chainUpdates = [];
            
            for (const targetChain of targetChains) {
                if (targetChain === sourceChain) {
                    connections.push({
                        source_chain: sourceChain,
                        target_chain: targetChain,
                        connected: false,
                        error: 'Cannot connect chain to itself'
                    });
                    continue;
                }
                
                const targetNetworkConfig = CHAINLINK_NETWORKS[targetChain as ChainlinkNetwork];
                const targetPoolAddress = poolAddresses[targetChain];
                const targetTokenAddress = tokenAddresses[targetChain];
                
                if (!targetNetworkConfig) {
                    connections.push({
                        source_chain: sourceChain,
                        target_chain: targetChain,
                        connected: false,
                        error: `Unsupported target chain: ${targetChain}`
                    });
                    continue;
                }
                
                if (!targetPoolAddress || !targetTokenAddress) {
                    connections.push({
                        source_chain: sourceChain,
                        target_chain: targetChain,
                        connected: false,
                        error: `Missing pool or token address for ${targetChain}`
                    });
                    continue;
                }
                
                try {
                    // Encode remote pool address as bytes
                    const remotePoolAddresses = [
                        encodeAbiParameters(
                            [{ type: 'address' }],
                            [getAddress(targetPoolAddress)]
                        )
                    ];
                    
                    // Encode remote token address as bytes
                    const remoteTokenAddress = encodeAbiParameters(
                        [{ type: 'address' }],
                        [getAddress(targetTokenAddress)]
                    );
                    
                    const chainUpdate = {
                        remoteChainSelector: BigInt(targetNetworkConfig.chainSelector),
                        remotePoolAddresses,
                        remoteTokenAddress,
                        outboundRateLimiterConfig: {
                            isEnabled: rateLimits.isEnabled,
                            capacity: BigInt(rateLimits.capacity),
                            rate: BigInt(rateLimits.rate)
                        },
                        inboundRateLimiterConfig: {
                            isEnabled: rateLimits.isEnabled,
                            capacity: BigInt(rateLimits.capacity),
                            rate: BigInt(rateLimits.rate)
                        }
                    };
                    
                    chainUpdates.push(chainUpdate);
                    
                } catch (error) {
                    connections.push({
                        source_chain: sourceChain,
                        target_chain: targetChain,
                        connected: false,
                        error: `Failed to prepare chain update: ${error instanceof Error ? error.message : 'Unknown error'}`
                    });
                }
            }
            
            // Apply chain updates if we have any valid ones
            if (chainUpdates.length > 0) {
                try {
                    const hash = await sourcePool.write.applyChainUpdates([[], chainUpdates]);
                    const receipt = await walletAgent.publicClient.waitForTransactionReceipt({ hash });
                    
                    if (receipt.status === 'success') {
                        // Mark successful connections
                        let updateIndex = 0;
                        for (const targetChain of targetChains) {
                            if (targetChain !== sourceChain && poolAddresses[targetChain] && tokenAddresses[targetChain]) {
                                connections.push({
                                    source_chain: sourceChain,
                                    target_chain: targetChain,
                                    connected: true,
                                    transaction_hash: hash
                                });
                                updateIndex++;
                            }
                        }
                    } else {
                        // Mark all as failed
                        for (const targetChain of targetChains) {
                            if (targetChain !== sourceChain) {
                                connections.push({
                                    source_chain: sourceChain,
                                    target_chain: targetChain,
                                    connected: false,
                                    error: 'Chain update transaction failed'
                                });
                            }
                        }
                    }
                } catch (error) {
                    // Mark all as failed
                    for (const targetChain of targetChains) {
                        if (targetChain !== sourceChain) {
                            connections.push({
                                source_chain: sourceChain,
                                target_chain: targetChain,
                                connected: false,
                                error: `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                            });
                        }
                    }
                }
            }
            
            const successfulConnections = connections.filter(conn => conn.connected);
            const failedConnections = connections.filter(conn => !conn.connected);
            
            return {
                status: failedConnections.length === 0 ? "success" : "partial",
                message: failedConnections.length === 0 
                    ? "✅ All CCIP chain connections configured successfully" 
                    : `⚠️ ${successfulConnections.length}/${connections.length} connections successful`,
                connection_results: {
                    source_chain: sourceChain,
                    total_connections: connections.length,
                    successful_connections: successfulConnections.length,
                    failed_connections: failedConnections.length,
                    connections: connections
                },
                rate_limit_config: {
                    capacity: rateLimits.capacity,
                    rate: rateLimits.rate,
                    enabled: rateLimits.isEnabled
                },
                next_steps: failedConnections.length === 0 ? [
                    "✅ All chain connections configured",
                    "⏭️ Next: Validate complete setup using asetta_validate_ccip_setup",
                    "🎉 Ready for cross-chain transfers!"
                ] : [
                    "⚠️ Some connections failed - check error details",
                    "🔄 Retry failed connections",
                    "🛠️ Verify all addresses and permissions"
                ]
            };
            
        } catch (error: any) {
            return {
                status: "error",
                message: "❌ Failed to connect CCIP chains",
                error: error.message,
                troubleshooting: [
                    "Check that all pool and token addresses are valid",
                    "Ensure source chain pool is properly deployed",
                    "Verify wallet has sufficient balance for gas",
                    "Check that target chains are supported"
                ]
            };
        } finally {
            await agent.disconnect();
        }
    }
};
