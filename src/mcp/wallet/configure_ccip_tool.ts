import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { type NetworkType } from "../../config";

export const ConfigureCCIPTool: McpTool = {
    name: "asetta_configure_ccip",
    description: "Provides step-by-step instructions for configuring Chainlink CCIP cross-chain transfers",
    schema: {
        project_id: z.string()
            .optional()
            .describe("Project ID from create RWA token (optional for guidance)"),
        source_chain: z.enum(['avalancheFuji', 'ethereumSepolia', 'arbitrumSepolia'])
            .optional()
            .describe("Source chain for CCIP configuration (optional for guidance)"),
        destination_chains: z.array(z.enum(['avalancheFuji', 'ethereumSepolia', 'arbitrumSepolia']))
            .optional()
            .describe("Target chains for cross-chain transfers (optional for guidance)"),
        network: z.enum(['avalancheFuji', 'ethereumSepolia', 'arbitrumSepolia'])
            .optional()
            .describe("Network to use (optional, defaults to configured network)")
    },
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        const networkType = input.network as NetworkType;
        const walletAgent = networkType ? new WalletAgent(networkType) : agent;
        
        await walletAgent.connect();

        return {
            status: "instructions",
            message: "🔗 CCIP Configuration Guide - Complete Instructions Available",
            description: "Use the new CCIP tools to configure cross-chain RWA token transfers following Chainlink CCIP standards",
            
            overview: {
                purpose: "Enable cross-chain RWA token transfers using Chainlink CCIP",
                mechanism: "Burn tokens on source chain, mint on destination chain",
                security: "Chainlink decentralized oracle network validation",
                supported_chains: ["Ethereum Sepolia", "Arbitrum Sepolia", "Avalanche Fuji"]
            },

            prerequisites: {
                required: [
                    "✅ RWA tokens deployed on each target network",
                    "✅ Same token name/symbol across all networks",
                    "✅ Sufficient native tokens for gas fees on each network",
                    "✅ Admin/owner privileges on all RWA token contracts"
                ],
                recommendations: [
                    "💡 Start with 2 networks before adding more",
                    "🔍 Test with small amounts first",
                    "📊 Keep track of addresses from each step"
                ]
            },

            step_by_step_guide: {
                "step_1_deploy_pools": {
                    title: "🏗️ Step 1: Deploy BurnMintTokenPool on Each Network",
                    description: "Deploy CCIP pools for each RWA token on each network",
                    tools_to_use: ["asetta_deploy_ccip_pool"],
                    example_usage: [
                        "# Deploy pool on Ethereum Sepolia",
                        "asetta_deploy_ccip_pool --rwaTokenAddress=0x... --network=ethereumSepolia",
                        "",
                        "# Deploy pool on Arbitrum Sepolia", 
                        "asetta_deploy_ccip_pool --rwaTokenAddress=0x... --network=arbitrumSepolia",
                        "",
                        "# Deploy pool on Avalanche Fuji",
                        "asetta_deploy_ccip_pool --rwaTokenAddress=0x... --network=avalancheFuji"
                    ],
                    important_notes: [
                        "📝 Save each pool address - you'll need them for step 3",
                        "⚡ Each deployment requires gas fees on respective network",
                        "🔍 Verify deployment success before proceeding"
                    ]
                },

                "step_2_configure_roles": {
                    title: "🔐 Step 2: Configure Roles and Admin Settings",
                    description: "Grant necessary permissions and register with Chainlink registry",
                    tools_to_use: ["asetta_configure_ccip_roles"],
                    example_usage: [
                        "# Configure roles on Ethereum Sepolia",
                        "asetta_configure_ccip_roles --rwaTokenAddress=0x... --poolAddress=0x... --network=ethereumSepolia",
                        "",
                        "# Configure roles on Arbitrum Sepolia",
                        "asetta_configure_ccip_roles --rwaTokenAddress=0x... --poolAddress=0x... --network=arbitrumSepolia",
                        "",
                        "# Configure roles on Avalanche Fuji", 
                        "asetta_configure_ccip_roles --rwaTokenAddress=0x... --poolAddress=0x... --network=avalancheFuji"
                    ],
                    what_this_does: [
                        "🔑 Grants MINTER_ROLE to pool (allows minting on destination)",
                        "🔥 Grants BURNER_ROLE to pool (allows burning on source)",
                        "📋 Registers admin with Chainlink TokenAdminRegistry",
                        "✅ Links token to pool in Chainlink system",
                        "🔗 Accepts admin role for CCIP operations"
                    ]
                },

                "step_3_connect_chains": {
                    title: "🌐 Step 3: Connect Chains Together",
                    description: "Configure cross-chain connections between pools",
                    tools_to_use: ["asetta_connect_ccip_chains"],
                    example_usage: [
                        "# Connect Ethereum Sepolia to Arbitrum & Avalanche",
                        `asetta_connect_ccip_chains --sourceChain=ethereumSepolia --targetChains=["arbitrumSepolia","avalancheFuji"] --poolAddresses='{"ethereumSepolia":"0x...","arbitrumSepolia":"0x...","avalancheFuji":"0x..."}' --tokenAddresses='{"ethereumSepolia":"0x...","arbitrumSepolia":"0x...","avalancheFuji":"0x..."}'`,
                        "",
                        "# Repeat for each source chain",
                        "# This creates bidirectional connections"
                    ],
                    important_notes: [
                        "🔄 Run this for EACH network as source to connect to others",
                        "📊 Requires all pool and token addresses from previous steps",
                        "⚡ Sets up rate limiting for security (100,000 capacity, 167 rate)",
                        "🔗 Creates bidirectional connections between networks"
                    ]
                },

                "step_4_validate_setup": {
                    title: "✅ Step 4: Validate Complete Setup",
                    description: "Verify all CCIP configurations are correct",
                    tools_to_use: ["asetta_validate_ccip_setup"],
                    example_usage: [
                        "# Validate setup on each network",
                        `asetta_validate_ccip_setup --rwaTokenAddress=0x... --poolAddress=0x... --network=ethereumSepolia --expectedRemoteChains=["arbitrumSepolia","avalancheFuji"]`,
                        "",
                        "# Check all networks are properly configured",
                        "# This ensures cross-chain transfers will work"
                    ],
                    validation_checks: [
                        "🔑 Pool has MINTER_ROLE on token",
                        "🔥 Pool has BURNER_ROLE on token", 
                        "📋 Token is linked to pool in registry",
                        "⚙️ Pool is configured with correct router",
                        "🌐 Expected remote chains are connected",
                        "🔗 All cross-chain configurations are valid"
                    ]
                }
            },

            example_complete_flow: {
                description: "Complete example for 3-chain setup (Ethereum, Arbitrum, Avalanche)",
                assuming: {
                    ethereum_token: "0x1234...abcd",
                    arbitrum_token: "0x5678...efgh", 
                    avalanche_token: "0x9abc...def0"
                },
                commands: [
                    "# 1. Deploy pools",
                    "asetta_deploy_ccip_pool --rwaTokenAddress=0x1234...abcd --network=ethereumSepolia",
                    "asetta_deploy_ccip_pool --rwaTokenAddress=0x5678...efgh --network=arbitrumSepolia", 
                    "asetta_deploy_ccip_pool --rwaTokenAddress=0x9abc...def0 --network=avalancheFuji",
                    "",
                    "# 2. Configure roles (using pool addresses from step 1)",
                    "asetta_configure_ccip_roles --rwaTokenAddress=0x1234...abcd --poolAddress=0x... --network=ethereumSepolia",
                    "asetta_configure_ccip_roles --rwaTokenAddress=0x5678...efgh --poolAddress=0x... --network=arbitrumSepolia",
                    "asetta_configure_ccip_roles --rwaTokenAddress=0x9abc...def0 --poolAddress=0x... --network=avalancheFuji",
                    "",
                    "# 3. Connect chains (run from each network)",
                    "# Connect Ethereum to Arbitrum + Avalanche",
                    "# Connect Arbitrum to Ethereum + Avalanche", 
                    "# Connect Avalanche to Ethereum + Arbitrum",
                    "",
                    "# 4. Validate each setup",
                    "asetta_validate_ccip_setup --rwaTokenAddress=0x... --poolAddress=0x... --network=ethereumSepolia",
                    "asetta_validate_ccip_setup --rwaTokenAddress=0x... --poolAddress=0x... --network=arbitrumSepolia",
                    "asetta_validate_ccip_setup --rwaTokenAddress=0x... --poolAddress=0x... --network=avalancheFuji"
                ]
            },

            input_received: input.project_id ? {
                project_id: input.project_id,
                source_chain: input.source_chain,
                destination_chains: input.destination_chains
            } : null,

            troubleshooting: {
                common_issues: [
                    "❌ Pool deployment fails → Check token address and network",
                    "❌ Role configuration fails → Ensure you're token admin/owner",
                    "❌ Chain connection fails → Verify all addresses are correct",
                    "❌ Validation fails → Re-run previous steps, check error details"
                ],
                tips: [
                    "💡 Deploy on testnets first (Sepolia, Fuji)",
                    "💡 Keep a spreadsheet of all addresses",
                    "💡 Test transfers with small amounts initially",
                    "💡 Use block explorers to verify transactions"
                ]
            },

            after_ccip_setup: [
                "🎯 Mark CCIP as configured using asetta_mark_ccip_configured",
                "📈 Register for primary sales distribution",
                "💰 Activate primary sales for public token purchases",
                "🚀 Your RWA token is now ready for cross-chain transfers!"
            ]
        };
    }
};
