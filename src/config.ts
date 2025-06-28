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
export { networkConfigs, type NetworkType };