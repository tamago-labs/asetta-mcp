import { publicClient, walletClient, account, network, networkInfo, agentMode, createClientForNetwork, type NetworkType } from '../config';


export class WalletAgent {

    public account: typeof account;
    public walletClient: typeof walletClient;
    public publicClient: typeof publicClient;
    public network: NetworkType;
    public networkInfo: typeof networkInfo;

    constructor(networkType?: NetworkType) {
        if (networkType && networkType !== network) {
            // Use different network
            const clients = createClientForNetwork(networkType);
            this.publicClient = clients.publicClient;
            this.walletClient = clients.walletClient;
            this.networkInfo = clients.networkInfo;
            this.network = networkType; // Fix: Actually set the network property
        } else {
            // Use default configured clients
            this.walletClient = walletClient;
            this.publicClient = publicClient;
            this.network = network;
            this.networkInfo = networkInfo;
        }

        this.account = account;

        console.error(`🎨 Asetta Agent initialized on ${this.network}`);
        console.error(`📍 Wallet address: ${this.account.address}`);

    }

    async connect(): Promise<void> {
        try {
            // Test connection by getting chain ID
            const chainId = await this.publicClient.getChainId();
            console.error(`✅ Connected to the network (Chain ID: ${chainId})`);
            console.error(`🌐 Network: ${this.network}`);
            console.error(`🔗 RPC: ${this.networkInfo.rpcProviderUrl}`);
        } catch (error) {
            console.error('❌ Failed to connect to network:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        console.error('🔌 Disconnected from the network');
    }

    async getWalletInfo(): Promise<any> {
        try {
            const balance = await this.publicClient.getBalance({
                address: this.account.address
            });

            return {
                address: this.account.address,
                balance: balance.toString(),
                network: this.network,
                chainId: await this.publicClient.getChainId(),
                blockExplorer: this.networkInfo.blockExplorer,
                nativeCurrency: this.networkInfo.nativeCurrency
            };
        } catch (error) {
            console.error('Failed to get wallet info:', error);
            throw error;
        }
    }

}
