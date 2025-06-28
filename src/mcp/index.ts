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
import { GetProfileTool } from "./api/get_profile_tool";
import { CreateRwaProjectTool } from "./api/create_rwa_project_tool";
import { GetRwaProjectsTool } from "./api/get_rwa_projects_tool";
import { UpdateProjectStatusTool } from "./api/update_project_status_tool"; 

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
    "CreateRwaTokenTool" : CreateRwaTokenTool,                 // Create RWA token (new architecture)
};

export const AsettaApiTools = {
    "GetProfileTool": GetProfileTool,
    "CreateRwaProjectTool": CreateRwaProjectTool, // Create RWA token and complete project on blockchain
    "GetRwaProjectsTool": GetRwaProjectsTool, // Get RWA project details from smart contract
    "UpdateProjectStatusTool": UpdateProjectStatusTool 
} 