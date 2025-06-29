import { z } from "zod";
import { WalletAgent } from "../../agent/wallet";
import { type McpTool } from "../../types";
import { CHAINLINK_NETWORKS } from "../../contracts/constants/chainlink-networks";

export const GetChainSelectorsTool: McpTool = {
    name: "asetta_get_chain_selectors",
    description: "Get CCIP chain selectors for supported networks",
    schema: {},
    handler: async (agent: WalletAgent, input: Record<string, any>) => {
        try {
            const chainSelectors = Object.entries(CHAINLINK_NETWORKS).map(([network, config]) => ({
                network,
                chain_id: config.chainId,
                chain_selector: config.chainSelector,
                router_address: config.routerAddress,
                link_address: config.linkAddress
            }));

            return {
                status: "success",
                message: "Chain selectors retrieved successfully",
                supported_networks: chainSelectors,
                usage_examples: [
                    {
                        description: "Transfer from Avalanche Fuji to Ethereum Sepolia",
                        source_network: "avalancheFuji",
                        destination_chain_selector: "16015286601757825753"
                    },
                    {
                        description: "Transfer from Ethereum Sepolia to Arbitrum Sepolia", 
                        source_network: "ethereumSepolia",
                        destination_chain_selector: "3478487238524512106"
                    },
                    {
                        description: "Transfer from Arbitrum Sepolia to Avalanche Fuji",
                        source_network: "arbitrumSepolia", 
                        destination_chain_selector: "14767482510784806043"
                    }
                ]
            };

        } catch (error: any) {
            throw new Error(`Failed to get chain selectors: ${error.message || error}`);
        }
    }
};
