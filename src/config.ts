import { Chain, createPublicClient, createWalletClient, http, WalletClient } from 'viem';
import { privateKeyToAccount, Address, Account, generatePrivateKey } from 'viem/accounts';
import { avalancheFuji, sepolia, arbitrumSepolia } from 'viem/chains'

type NetworkType = 'avalancheFuji' | 'ethereumSepolia' | 'arbitrumSepolia'

type AgentMode = 'legal' | 'tokenization';

interface NetworkConfig {
    rpcProviderUrl: string;
    blockExplorer: string;
    chain: Chain;
    chainId: number;
    nativeCurrency: string;
}

const getArgs = () =>
    process.argv.reduce((args: any, arg: any) => {
        // long arg
        if (arg.slice(0, 2) === "--") {
            const longArg = arg.split("=");
            const longArgFlag = longArg[0].slice(2);
            const longArgValue = longArg.length > 1 ? longArg[1] : true;
            args[longArgFlag] = longArgValue;
        }
        // flags
        else if (arg[0] === "-") {
            const flags = arg.slice(1).split("");
            flags.forEach((flag: any) => {
                args[flag] = true;
            });
        }
        return args;
    }, {});


// Contract addresses for different networks
const CONTRACT_ADDRESSES = {
    avalancheFuji: {
        mockUSDC: "0x5067e9a9154A2EA674DEf639de5e98F238824039",
        rwaManager: "0x6ee904a0Ff97b5682E80660Bf2Aca280D18aB5F3",
        tokenFactory: "0xEc5003E8451EC488ea1e1a7142A38e77a5082fCf",
        primaryDistribution: "0x9304F30b1AEfeCB43F86fd5841C6ea75BD0F2529",
        rfq: "0x307992307C89216b1079C7c5Cbc4F51005b1472D"
    },
    ethereumSepolia: {
        mockUSDC: "0xf2260B00250c772CB64606dBb88d9544F709308C",
        rwaManager: "0x9682DaBf26831523B21759A50b0a45832f82DBa3",
        tokenFactory: "0x6fdB032668F1F856fbC2e9F5Df348938aFBFBE17",
        primaryDistribution: "0xf309011fbf013C352849Cd4b5C85E71cC69a1EBF",
        rfq: "0x42209A0A2a3D80Ad48B7D25fC6a61ad355901484"
    },
    arbitrumSepolia: {
        mockUSDC: "0x16EE94e3C07B24EbA6067eb9394BA70178aAc4c0",
        rwaManager: "0x4fd5Ae48A869c5ec0214CB050D2D713433515D8d",
        tokenFactory: "0xe5209A4f622C6eD2C158dcCcdDB69B05f9D0E4E0",
        primaryDistribution: "0xA657b300009802Be7c88617128545534aCA12dbe",
        rfq: "0x61ad3Fe6B44Bfbbcec39c9FaD566538c894b6471"
    }
} as const;

// Network configurations
const networkConfigs: Record<NetworkType, NetworkConfig> = {
    avalancheFuji: {
        rpcProviderUrl: 'https://avalanche-fuji.drpc.org',
        blockExplorer: 'https://testnet.snowtrace.io',
        chain: avalancheFuji,
        chainId: 43113,
        nativeCurrency: 'AVAX'
    },
    ethereumSepolia: {
        rpcProviderUrl: 'https://sepolia.drpc.org',
        blockExplorer: 'https://sepolia.etherscan.io',
        chain: sepolia,
        chainId: 11155111,
        nativeCurrency: 'ETH'
    },
    arbitrumSepolia: {
        rpcProviderUrl: 'https://arbitrum-sepolia.drpc.org',
        blockExplorer: 'https://sepolia-explorer.arbitrum.io',
        chain: arbitrumSepolia,
        chainId: 421614,
        nativeCurrency: 'ETH'
    }
} as const;

const getNetwork = (): NetworkType => {
    const args = getArgs();
    const network = args.network as NetworkType;

    if (network && !(network in networkConfigs)) {
        throw new Error(`Invalid network: ${network}. Must be one of: ${Object.keys(networkConfigs).join(', ')}`);
    }
    return network || 'avalancheFuji';
};

const getAccount = (): Account => {

    const args = getArgs();
    const hasPrivateKey = !!(args?.wallet_private_key);

    if (!hasPrivateKey) {
        const privateKey = generatePrivateKey();
        return privateKeyToAccount(privateKey);
    } else {
        return privateKeyToAccount(`0x${(args?.wallet_private_key)}` as Address);
    }
}


// Initialize client configuration
export const network = getNetwork();

export const networkInfo = {
    ...networkConfigs[network],
    rpcProviderUrl: networkConfigs[network].rpcProviderUrl,
};

export const account: Account = getAccount()

const getMode = (): any => {
    const args = getArgs();
    return args.agent_mode
}

const getAccessKey = (): string | undefined => {
    const args = getArgs();
    return args.access_key;
}

export const agentMode: any = getMode()
export const accessKey: string | undefined = getAccessKey()

const baseConfig = {
    chain: networkInfo.chain,
    transport: http(networkInfo.rpcProviderUrl),
} as const;

export const publicClient = createPublicClient(baseConfig);

export const walletClient = createWalletClient({
    ...baseConfig,
    account,
}) as WalletClient;

// Multi-chain client factory
export function createClientForNetwork(networkType: NetworkType) {
    const config = networkConfigs[networkType];
    const baseConfig = {
        chain: config.chain,
        transport: http(config.rpcProviderUrl),
    };

    return {
        publicClient: createPublicClient(baseConfig),
        walletClient: createWalletClient({
            ...baseConfig,
            account,
        }) as WalletClient,
        networkInfo: config
    };
}

// Get contract addresses for a network
export function getContractAddresses(networkType: NetworkType) {
    return CONTRACT_ADDRESSES[networkType];
}

export function validateEnvironment(): void {
    try {

        const args = getArgs();
        const hasAgentMode = !!(args?.agent_mode)

        if (!hasAgentMode) {
            console.error(`AGENT_MODE is not set, default to non-wallet mode`);
        } else {
            console.error(`✅ Asetta mode: ${args.agent_mode}`);
        }

        if (args.agent_mode === "tokenization") {
            getNetwork()
            console.error(`✅ Asetta MCP environment configuration valid (${network})`);
            console.error(`📍 RPC URL: ${networkInfo.rpcProviderUrl}`);
            console.error(`📍 Chain ID: ${networkInfo.chainId}`);
            console.error(`📍 Native Currency: ${networkInfo.nativeCurrency}`);
            getAccount()
            console.error(`📍 Account: ${account.address}`);
        }
        
        if (args.access_key) {
            console.error(`📍 Access Key: ${args.access_key}`);
        }

    } catch (error) {
        console.error('❌ Invalid environment configuration:', error);
        throw error;
    }
}

// Export network configs for external use
export { networkConfigs, CONTRACT_ADDRESSES, type NetworkType };
