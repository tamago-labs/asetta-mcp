import { GetWalletInfoTool } from "./wallet/get_wallet_info_tool";
import { GetAccountBalancesTool } from "./wallet/get_account_balances_tool";
import { SendETHTool } from "./wallet/send_eth_tool";
import { SendTokenTool } from "./wallet/send_token_tool";
import { ApproveTokenTool } from "./wallet/approve_token_tool";
import { CheckAllowanceTool } from "./wallet/check_allowance_tool";
import { GetTokenInfoTool } from "./wallet/get_token_info_tool";
import { GetTransactionHistoryTool } from "./wallet/get_transaction_history_tool";
import { CreateRwaTokenTool } from "./wallet/create_rwa_token_tool";
import { GetRwaProjectTool } from "./wallet/get_rwa_project_tool";
import { MintUSDCTool } from "./wallet/mint_usdc_tool";
import { GetUSDCBalanceTool } from "./wallet/get_usdc_balance_tool";
import { ConfigureCCIPTool } from "./wallet/configure_ccip_tool";
import { MarkCCIPConfiguredTool } from "./wallet/mark_ccip_configured_tool";
import { RegisterPrimarySalesTool } from "./wallet/register_primary_sales_tool";
import { ActivatePrimarySalesTool } from "./wallet/activate_primary_sales_tool";
import { GetProfileTool } from "./api/get_profile_tool";
import { CreateRwaProjectTool } from "./api/create_rwa_project_tool";
import { GetRwaProjectsTool } from "./api/get_rwa_projects_tool";
import { UpdateProjectStatusTool } from "./api/update_project_status_tool";

// CCIP Tools
import { DeployCCIPPoolTool } from "./ccip/deploy_ccip_pool_tool";
import { ConfigureCCIPRolesTool } from "./ccip/configure_ccip_roles_tool";
import { ConnectCCIPChainsTool } from "./ccip/connect_ccip_chains_tool";
import { ValidateCCIPSetupTool } from "./ccip/validate_ccip_setup_tool";

// RWA Token Tools
import { MintRwaTokenTool } from "./rwa/mint_rwa_token_tool";
import { TransferRwaTokenCrossChainTool } from "./rwa/transfer_rwa_cross_chain_tool";
import { GetCrossChainFeeTool } from "./rwa/get_cross_chain_fee_tool";
import { ApproveRouterTool } from "./rwa/approve_router_tool";
import { GetChainSelectorsTool } from "./rwa/get_chain_selectors_tool";

export const AsettaWalletTools = {

    // Basic wallet information and account management
    "GetWalletInfoTool": GetWalletInfoTool,                    // Get wallet address, balance, network info
    "GetAccountBalancesTool": GetAccountBalancesTool,          // Get current balances including USDC
    "GetTransactionHistoryTool": GetTransactionHistoryTool,    // View recent transaction history

    // Token and ETH operations
    "SendETHTool": SendETHTool,                                // Send native tokens (AVAX/ETH)
    "SendTokenTool": SendTokenTool,                            // Send other tokens

    // EVM-specific token operations
    "ApproveTokenTool": ApproveTokenTool,                      // Approve tokens for contracts
    "CheckAllowanceTool": CheckAllowanceTool,                  // Check token allowances for contracts
    "GetTokenInfoTool": GetTokenInfoTool,                      // Get comprehensive ERC20 token information

    // USDC-specific operations
    "MintUSDCTool": MintUSDCTool,                              // Mint mock USDC for testing
    "GetUSDCBalanceTool": GetUSDCBalanceTool,                  // Get USDC balance (shortcut)

    // RWA Token Operations
    "GetRwaProjectTool": GetRwaProjectTool,                    // Get RWA project details
    "UpdateProjectStatusTool": UpdateProjectStatusTool,        // Update project status
    "CreateRwaTokenTool": CreateRwaTokenTool,                 // Create RWA token (new architecture)

    // RWA Workflow Tools (Multi-step process)
    "ConfigureCCIPTool": ConfigureCCIPTool,                    // Configure CCIP cross-chain (Coming Soon)
    "MarkCCIPConfiguredTool": MarkCCIPConfiguredTool,          // Mark CCIP as ready (Coming Soon)
    "RegisterPrimarySalesTool": RegisterPrimarySalesTool,      // Register for sales (Coming Soon)
    "ActivatePrimarySalesTool": ActivatePrimarySalesTool,      // Activate public sales (Coming Soon)

    // Setup CCIP
    "DeployCCIPPoolTool": DeployCCIPPoolTool,                 // Deploy BurnMintTokenPool on a network
    "ConfigureCCIPRolesTool": ConfigureCCIPRolesTool,         // Configure roles and admin for CCIP
    "ConnectCCIPChainsTool": ConnectCCIPChainsTool,           // Connect pools across chains
    "ValidateCCIPSetupTool": ValidateCCIPSetupTool,           // Validate CCIP configuration

    // RWA Token Operations
    "MintRwaTokenTool": MintRwaTokenTool,                     // Mint RWA tokens
    "TransferRwaTokenCrossChainTool": TransferRwaTokenCrossChainTool, // Cross-chain RWA token transfer
    "GetCrossChainFeeTool": GetCrossChainFeeTool,             // Get cross-chain transfer fee
    "ApproveRouterTool": ApproveRouterTool,                   // Approve CCIP router for transfers
    "GetChainSelectorsTool": GetChainSelectorsTool            // Get CCIP chain selectors
};

export const AsettaApiTools = {
    "GetProfileTool": GetProfileTool,
    "CreateRwaProjectTool": CreateRwaProjectTool, // Create RWA token and complete project on blockchain
    "GetRwaProjectsTool": GetRwaProjectsTool, // Get RWA project details from smart contract
    "UpdateProjectStatusTool": UpdateProjectStatusTool
};

