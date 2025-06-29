import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { 
  getContract,
  getAddress
} from 'viem';
import { CHAINLINK_NETWORKS, type ChainlinkNetwork } from '../../contracts/constants/chainlink-networks.js';
import BurnMintTokenPoolABI from '../../contracts/abis/BurnMintTokenPool.json'

export const DeployCCIPPoolTool: McpTool = {
    name: "asetta_deploy_ccip_pool",
    description: "Deploy BurnMintTokenPool for an RWA token on a specific network to enable CCIP cross-chain transfers",
    schema: {
        rwaTokenAddress: z.string()
            .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
            .describe("Address of the RWA token to create a pool for"),
        network: z.enum(['ethereumSepolia', 'arbitrumSepolia', 'avalancheFuji'])
            .describe("Network to deploy the pool on"),
        allowlist: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/))
            .optional()
            .default([])
            .describe("Optional array of addresses allowed to use the pool (empty for public access)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            const { rwaTokenAddress, network, allowlist = [] } = input;
            
            const networkConfig = CHAINLINK_NETWORKS[network as ChainlinkNetwork];
            if (!networkConfig) {
                throw new Error(`Unsupported network: ${network}`);
            }
            
            // Use the provided network or switch if needed
            const walletAgent = network !== agent.network ? new WalletAgent(network) : agent;
            await walletAgent.connect();
            
            console.error("before constructorArgs...")

            // Prepare constructor arguments
            const constructorArgs = [
                getAddress(rwaTokenAddress),     // IBurnMintERC20 token
                18,                              // uint8 localTokenDecimals
                allowlist.map((addr: string) => getAddress(addr)), // address[] allowlist
                getAddress(networkConfig.rmnProxyAddress),
                getAddress(networkConfig.routerAddress)
            ] as const;

            console.error("before deploy", constructorArgs)

            // Deploy BurnMintTokenPool
            const hash = await walletAgent.walletClient.deployContract({
                abi: BurnMintTokenPoolABI.abi,
                bytecode: BurnMintTokenPoolABI.bytecode.object as `0x${string}`,
                args: constructorArgs
            } as any);

            // Wait for deployment
            const receipt = await walletAgent.publicClient.waitForTransactionReceipt({ hash });
            
            console.error("after...")

            if (receipt.status !== 'success') {
                throw new Error('Pool deployment transaction failed');
            }
            
            const poolAddress = receipt.contractAddress;
            if (!poolAddress) {
                throw new Error('Failed to get deployed pool address');
            }
 
            return {
                status: "success",
                message: "✅ CCIP BurnMintTokenPool deployed successfully",
                deployment_details: {
                    pool_address: `${poolAddress}`,
                    transaction_hash: `${hash}`,
                    network: `${network}`,
                    rwa_token: `${rwaTokenAddress}`,
                    block_number: `${receipt?.blockNumber}`
                },
                network_config: {
                    chain_selector: networkConfig.chainSelector,
                    router_address: networkConfig.routerAddress,
                    rmn_proxy_address: networkConfig.rmnProxyAddress,
                    registry_address: networkConfig.tokenAdminRegistryAddress
                },
                next_steps: [
                    "✅ Pool deployed successfully",
                    "⏭️ Next: Configure CCIP roles using asetta_configure_ccip_roles",
                    "⏭️ Then: Connect to other chains using asetta_connect_ccip_chains",
                    "⏭️ Finally: Validate setup using asetta_validate_ccip_setup"
                ]
            };
            
        } catch (error: any) {
            return {
                status: "error",
                message: "❌ Failed to deploy CCIP pool",
                error: error.message,
                troubleshooting: [
                    "Check that the RWA token address is valid",
                    "Ensure wallet has sufficient balance for deployment",
                    "Verify network is supported",
                    "Check that you have the required permissions"
                ]
            };
        } finally {
            await agent.disconnect();
        }
    }
};
