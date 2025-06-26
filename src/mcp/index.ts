import { GetWalletInfoTool } from "./wallet/get_wallet_info_tool";
import { GetAccountBalancesTool } from "./wallet/get_account_balances_tool";
import { SendETHTool } from "./wallet/send_eth_tool";
import { SendTokenTool } from "./wallet/send_token_tool";
import { ApproveTokenTool } from "./wallet/approve_token_tool";
import { CheckAllowanceTool } from "./wallet/check_allowance_tool";
import { GetTokenInfoTool } from "./wallet/get_token_info_tool";
import { GetTransactionHistoryTool } from "./wallet/get_transaction_history_tool";
import { GetProfileTool } from "./api/get_profile_tool";
import { CreateRwaProjectTool } from "./api/create_rwa_project_tool";
import { GetRwaProjectsTool } from "./api/get_rwa_projects_tool"; 

export const AsettaWalletTools = {

    // Basic wallet information and account management
    "GetWalletInfoTool": GetWalletInfoTool,                    // Get wallet address, balance, network info
    "GetAccountBalancesTool": GetAccountBalancesTool,          // Get current balances 
    "GetTransactionHistoryTool": GetTransactionHistoryTool,    // View recent transaction history

    // Token and ETH operations
    "SendETHTool": SendETHTool,                                // Send AVAX 
    "SendTokenTool": SendTokenTool,                            // Send other tokens

    // EVM-specific token operations
    "ApproveTokenTool": ApproveTokenTool,                      // Approve tokens for Story Protocol contracts
    "CheckAllowanceTool": CheckAllowanceTool,                  // Check token allowances for contracts
    "GetTokenInfoTool": GetTokenInfoTool,                      // Get comprehensive ERC20 token information

    // // IP Registration & Management
    // "RegisterIPTool": RegisterIPTool,                       // ✅ Register IP from URLs or metadata
    // "GetIPInfoTool": GetIPInfoTool,                         // ✅ Get IP asset details and metadata
    // // "MintAndRegisterIPTool": MintAndRegisterIPTool,         // Mint NFT + register IP in one tx
    // // "BatchRegisterTool": BatchRegisterTool,                 // Register multiple IP assets

    // // License Terms & Management  
    // "CreateLicenseTermsTool": CreateLicenseTermsTool,       // ✅ AI-powered license term creation
    // "AttachLicenseTool": AttachLicenseTool,                 // ✅ Attach license terms to IP
    // // "GetLicenseTermsTool": GetLicenseTermsTool,             // View available license terms

    // // License Token Operations
    // "MintLicenseTool": MintLicenseTool,                     // ✅ Mint license tokens for purchase 

};

export const AsettaApiTools = {
    "GetProfileTool": GetProfileTool,
    "CreateRwaProjectTool": CreateRwaProjectTool,
    "GetRwaProjectsTool": GetRwaProjectsTool
} 