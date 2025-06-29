import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { 
  getContract,
  getAddress
} from 'viem';
import { CHAINLINK_NETWORKS, type ChainlinkNetwork } from '../../contracts/constants/chainlink-networks.js';
import BurnMintTokenPoolABI from '../../contracts/abis/BurnMintTokenPool.json'
import TokenAdminRegistryABI from '../../contracts/abis/TokenAdminRegistry.json'

// RWA Token ABI functions we need for validation
const RWA_TOKEN_ABI = [
    {
        name: 'hasRole',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'role', type: 'bytes32' },
            { name: 'account', type: 'address' }
        ],
        outputs: [{ name: '', type: 'bool' }]
    },
    {
        name: 'MINTER_ROLE',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bytes32' }]
    },
    {
        name: 'BURNER_ROLE',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bytes32' }]
    }
] as const;

interface ValidationResult {
    check: string;
    passed: boolean;
    details?: string;
    error?: string;
}

export const ValidateCCIPSetupTool: McpTool = {
    name: "asetta_validate_ccip_setup",
    description: "Validate that CCIP setup is correctly configured and ready for cross-chain transfers",
    schema: {
        rwaTokenAddress: z.string()
            .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
            .describe("Address of the RWA token"),
        poolAddress: z.string()
            .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
            .describe("Address of the BurnMintTokenPool"),
        network: z.enum(['ethereumSepolia', 'arbitrumSepolia', 'avalancheFuji'])
            .describe("Network to validate"),
        expectedRemoteChains: z.array(z.enum(['ethereumSepolia', 'arbitrumSepolia', 'avalancheFuji']))
            .optional()
            .describe("Expected remote chains that should be connected (optional)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            const { rwaTokenAddress, poolAddress, network, expectedRemoteChains } = input;
            
            const networkConfig = CHAINLINK_NETWORKS[network as ChainlinkNetwork];
            if (!networkConfig) {
                throw new Error(`Unsupported network: ${network}`);
            }
            
            // Use the provided network or switch if needed
            const walletAgent = network !== agent.network ? new WalletAgent(network) : agent;
            await walletAgent.connect();
            
            const validations: ValidationResult[] = [];
            
            // Get contracts
            const rwaToken = getContract({
                address: getAddress(rwaTokenAddress),
                abi: RWA_TOKEN_ABI,
                client: walletAgent.publicClient
            });
            
            const pool = getContract({
                address: getAddress(poolAddress),
                abi: BurnMintTokenPoolABI.abi,
                client: walletAgent.publicClient
            });
            
            const tokenAdminRegistry = getContract({
                address: getAddress(networkConfig.tokenAdminRegistryAddress),
                abi: TokenAdminRegistryABI.abi,
                client: walletAgent.publicClient
            });
            
            // Validation 1: Check if pool has MINTER_ROLE
            try {
                const minterRole = await rwaToken.read.MINTER_ROLE();
                const hasMinterRole = await rwaToken.read.hasRole([minterRole, getAddress(poolAddress)]);
                validations.push({
                    check: 'Pool has MINTER_ROLE',
                    passed: hasMinterRole,
                    details: hasMinterRole ? 'Pool can mint tokens for cross-chain transfers' : 'Pool cannot mint tokens'
                });
            } catch (error) {
                validations.push({
                    check: 'Pool has MINTER_ROLE',
                    passed: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
            
            // Validation 2: Check if pool has BURNER_ROLE
            try {
                const burnerRole = await rwaToken.read.BURNER_ROLE();
                const hasBurnerRole = await rwaToken.read.hasRole([burnerRole, getAddress(poolAddress)]);
                validations.push({
                    check: 'Pool has BURNER_ROLE',
                    passed: hasBurnerRole,
                    details: hasBurnerRole ? 'Pool can burn tokens for cross-chain transfers' : 'Pool cannot burn tokens'
                });
            } catch (error) {
                validations.push({
                    check: 'Pool has BURNER_ROLE',
                    passed: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
            
            // Validation 3: Check if token is linked to pool in TokenAdminRegistry
            try {
                const registeredPool = await tokenAdminRegistry.read.getPool([getAddress(rwaTokenAddress)]);
                const isLinked = registeredPool.toLowerCase() === poolAddress.toLowerCase();
                validations.push({
                    check: 'Token linked to pool in registry',
                    passed: isLinked,
                    details: isLinked ? 'Token is correctly linked to pool' : `Token linked to different pool: ${registeredPool}`
                });
            } catch (error) {
                validations.push({
                    check: 'Token linked to pool in registry',
                    passed: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
            
            // Validation 4: Check pool token configuration
            try {
                const poolToken = await pool.read.getToken();
                const isCorrectToken = poolToken.toLowerCase() === rwaTokenAddress.toLowerCase();
                validations.push({
                    check: 'Pool configured with correct token',
                    passed: isCorrectToken,
                    details: isCorrectToken ? 'Pool is configured with the correct RWA token' : `Pool configured with different token: ${poolToken}`
                });
            } catch (error) {
                validations.push({
                    check: 'Pool configured with correct token',
                    passed: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
            
            // Validation 5: Check supported chains (if expectedRemoteChains provided)
            if (expectedRemoteChains && expectedRemoteChains.length > 0) {
                try {
                    const supportedChains = await pool.read.getSupportedChains();
                    const expectedSelectors = expectedRemoteChains
                        .filter(chain => chain !== network)
                        .map(chain => BigInt(CHAINLINK_NETWORKS[chain as ChainlinkNetwork].chainSelector));
                    
                    const missingSelectorCount = expectedSelectors.filter(
                        selector => !supportedChains.some(supported => BigInt(supported) === selector)
                    ).length;
                    
                    const allSupportedChainsConnected = missingSelectorCount === 0;
                    validations.push({
                        check: 'Expected remote chains connected',
                        passed: allSupportedChainsConnected,
                        details: allSupportedChainsConnected 
                            ? `All ${expectedSelectors.length} expected chains are connected`
                            : `${missingSelectorCount} expected chains are missing connections`
                    });
                } catch (error) {
                    validations.push({
                        check: 'Expected remote chains connected',
                        passed: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }
            
            // Validation 6: Check pool ownership and basic functionality
            try {
                const router = await pool.read.getRouter();
                const expectedRouter = networkConfig.routerAddress;
                const isCorrectRouter = router.toLowerCase() === expectedRouter.toLowerCase();
                validations.push({
                    check: 'Pool configured with correct router',
                    passed: isCorrectRouter,
                    details: isCorrectRouter ? 'Pool is using the correct CCIP router' : `Pool using different router: ${router}`
                });
            } catch (error) {
                validations.push({
                    check: 'Pool configured with correct router',
                    passed: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
            
            const passedChecks = validations.filter(v => v.passed).length;
            const totalChecks = validations.length;
            const failedChecks = totalChecks - passedChecks;
            const allChecksPassed = failedChecks === 0;
            
            return {
                status: allChecksPassed ? "success" : "warning",
                message: allChecksPassed 
                    ? "✅ CCIP setup validation completed - all checks passed!" 
                    : `⚠️ CCIP setup validation completed - ${passedChecks}/${totalChecks} checks passed`,
                validation_summary: {
                    network: network,
                    rwa_token: rwaTokenAddress,
                    pool_address: poolAddress,
                    total_checks: totalChecks,
                    passed_checks: passedChecks,
                    failed_checks: failedChecks,
                    setup_ready: allChecksPassed
                },
                validation_details: validations,
                network_config: {
                    chain_selector: networkConfig.chainSelector,
                    router_address: networkConfig.routerAddress,
                    token_admin_registry: networkConfig.tokenAdminRegistryAddress,
                    rmn_proxy: networkConfig.rmnProxyAddress
                },
                recommendations: allChecksPassed ? [
                    "🎉 CCIP setup is fully configured and ready!",
                    "✅ Cross-chain transfers should work properly",
                    "📊 You can now test with small amounts first",
                    "🔄 Monitor transactions on both source and destination chains"
                ] : [
                    "🔧 Fix failed validations before attempting transfers",
                    "⚠️ Review role permissions and registry settings",
                    "🔄 Re-run validation after making corrections",
                    "📞 Contact support if issues persist"
                ],
                next_steps: allChecksPassed ? {
                    workflow_progress: "CCIP validation complete - ready for RWA workflow continuation",
                    immediate_actions: [
                        "🏷️ Mark CCIP as configured using asetta_mark_ccip_configured",
                        "📝 Specify total token supply across all chains",
                        "✅ This will update project status to CCIP_READY"
                    ], 
                    after_marking_ccip: [
                        "📈 Register for primary sales with asetta_register_primary_sales",
                        "🚀 Activate sales with asetta_activate_primary_sales",
                        "💰 Your RWA tokens will be ready for public purchase!"
                    ]
                } : {
                    required_fixes: "Fix validation failures before proceeding",
                    cannot_proceed: "Must resolve all CCIP setup issues first",
                    get_help: "Use asetta_configure_ccip for detailed setup instructions"
                }
            };
            
        } catch (error: any) {
            return {
                status: "error",
                message: "❌ Failed to validate CCIP setup",
                error: error.message,
                troubleshooting: [
                    "Check that token and pool addresses are valid",
                    "Ensure contracts are deployed on the specified network",
                    "Verify network connectivity",
                    "Check that wallet has read permissions"
                ]
            };
        } finally {
            await agent.disconnect();
        }
    }
};
