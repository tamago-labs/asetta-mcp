import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { 
  getContract,
  getAddress
} from 'viem';
import { CHAINLINK_NETWORKS, type ChainlinkNetwork } from '../../contracts/constants/chainlink-networks.js';
import RegistryModuleOwnerCustomABI from '../../contracts/abis/RegistryModuleOwnerCustom.json'
import TokenAdminRegistryABI from '../../contracts/abis/TokenAdminRegistry.json' 
import RWATokenABI from "../../contracts/abis/RWAManager.json"
import { keccak256, toBytes } from 'viem'; 

export const ConfigureCCIPRolesTool: McpTool = {
    name: "asetta_configure_ccip_roles",
    description: "Configure all necessary roles and admin settings for CCIP pool to work with RWA token",
    schema: {
        rwaTokenAddress: z.string()
            .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
            .describe("Address of the RWA token"),
        poolAddress: z.string()
            .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
            .describe("Address of the deployed BurnMintTokenPool"),
        network: z.enum(['ethereumSepolia', 'arbitrumSepolia', 'avalancheFuji'])
            .describe("Network where the contracts are deployed")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            const { rwaTokenAddress, poolAddress, network } = input;
            
            const networkConfig = CHAINLINK_NETWORKS[network as ChainlinkNetwork];
            if (!networkConfig) {
                throw new Error(`Unsupported network: ${network}`);
            }
            
            // Use the provided network or switch if needed
            const walletAgent = network !== agent.network ? new WalletAgent(network) : agent;
            await walletAgent.connect();
            
            const result = {
                minter_role_granted: false,
                burner_role_granted: false,
                admin_registered: false,
                admin_accepted: false,
                pool_linked: false,
                transaction_hashes: [] as string[]
            };
            
            // Get RWA Token contract
            const rwaToken = getContract({
                address: getAddress(rwaTokenAddress),
                abi: RWATokenABI.abi,
                client: walletAgent.walletClient
            });
            
            // Get Chainlink contracts
            const registryModuleOwnerCustom = getContract({
                address: getAddress(networkConfig.registryModuleOwnerCustomAddress),
                abi: RegistryModuleOwnerCustomABI.abi,
                client: walletAgent.walletClient
            });
            
            const tokenAdminRegistry = getContract({
                address: getAddress(networkConfig.tokenAdminRegistryAddress),
                abi: TokenAdminRegistryABI.abi,
                client: walletAgent.walletClient
            });
            
            try {
                // Step 1: Grant MINTER_ROLE to pool
                const MINTER_ROLE: `0x${string}` = keccak256(toBytes('MINTER_ROLE')) 
                const minterHash = await rwaToken.write.grantRole([MINTER_ROLE, getAddress(poolAddress)]);
                await walletAgent.publicClient.waitForTransactionReceipt({ hash: minterHash });
                result.minter_role_granted = true;
                result.transaction_hashes.push(minterHash);
            } catch (error) {
                console.error('Failed to grant MINTER_ROLE:', error);
            }
 
            
            try {
                // Step 2: Grant BURNER_ROLE to pool 
                const BURNER_ROLE: `0x${string}` = keccak256(toBytes('BURNER_ROLE')) 
                const burnerHash = await rwaToken.write.grantRole([BURNER_ROLE, getAddress(poolAddress)]);
                await walletAgent.publicClient.waitForTransactionReceipt({ hash: burnerHash });
                result.burner_role_granted = true;
                result.transaction_hashes.push(burnerHash);
            } catch (error) {
                console.error('Failed to grant BURNER_ROLE:', error);
            }
 
            
            try {
                // Step 3: Register admin via getCCIPAdmin
                const registerHash = await registryModuleOwnerCustom.write.registerAdminViaGetCCIPAdmin([getAddress(rwaTokenAddress)]);
                await walletAgent.publicClient.waitForTransactionReceipt({ hash: registerHash });
                result.admin_registered = true;
                result.transaction_hashes.push(registerHash);
            } catch (error) {
                console.error('Failed to register admin:', error);
            }
 
            
            try {
                // Step 4: Accept admin role
                const acceptHash = await tokenAdminRegistry.write.acceptAdminRole([getAddress(rwaTokenAddress)]);
                await walletAgent.publicClient.waitForTransactionReceipt({ hash: acceptHash });
                result.admin_accepted = true;
                result.transaction_hashes.push(acceptHash);
            } catch (error) {
                console.error('Failed to accept admin role:', error);
            }
 
            
            try {
                // Step 5: Link token to pool
                const linkHash = await tokenAdminRegistry.write.setPool([getAddress(rwaTokenAddress), getAddress(poolAddress)]);
                await walletAgent.publicClient.waitForTransactionReceipt({ hash: linkHash });
                result.pool_linked = true;
                result.transaction_hashes.push(linkHash);
            } catch (error) {
                console.error('Failed to link pool:', error);
            }

            console.error("Link token passed")
            
            const allConfigured = result.minter_role_granted && result.burner_role_granted && 
                                  result.admin_registered && result.admin_accepted && result.pool_linked;
            
            return {
                status: allConfigured ? "success" : "partial",
                message: allConfigured 
                    ? "✅ All CCIP roles and admin settings configured successfully" 
                    : "⚠️ Some CCIP configurations failed",
                configuration_results: {
                    minter_role_granted: result.minter_role_granted,
                    burner_role_granted: result.burner_role_granted,
                    admin_registered: result.admin_registered,
                    admin_accepted: result.admin_accepted,
                    pool_linked: result.pool_linked,
                    total_transactions: result.transaction_hashes.length,
                    transaction_hashes: result.transaction_hashes
                },
                setup_summary: {
                    rwa_token: `${rwaTokenAddress}`,
                    pool_address: `${poolAddress}`,
                    network: `${network}`,
                    chainlink_registry: networkConfig.tokenAdminRegistryAddress,
                    all_roles_configured: `${allConfigured}`
                },
                next_steps: allConfigured ? [
                    "✅ All roles configured successfully",
                    "⏭️ Next: Connect to other chains using asetta_connect_ccip_chains",
                    "⏭️ Then: Validate setup using asetta_validate_ccip_setup"
                ] : [
                    "⚠️ Some configurations failed - check logs",
                    "🔄 Retry failed operations",
                    "🛠️ Verify contract permissions and wallet balance"
                ]
            };
            
        } catch (error: any) {
            return {
                status: "error",
                message: "❌ Failed to configure CCIP roles",
                error: error.message,
                troubleshooting: [
                    "Check that both token and pool addresses are valid",
                    "Ensure wallet has admin permissions on the RWA token",
                    "Verify sufficient balance for gas fees",
                    "Check network connectivity"
                ]
            };
        } finally {
            await agent.disconnect();
        }
    }
};
