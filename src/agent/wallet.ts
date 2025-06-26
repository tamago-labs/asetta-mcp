import { publicClient, walletClient, account, network, networkInfo, agentMode } from '../config';


export class WalletAgent {

    public account: typeof account;
    public walletClient: typeof walletClient;
    public publicClient: typeof publicClient;
    public network: typeof network;
    public networkInfo: typeof networkInfo;

    constructor() {
        // Use the configured clients from config 

        this.account = account;
        this.walletClient = walletClient;
        this.publicClient = publicClient;
        this.network = network;
        this.networkInfo = networkInfo;

        console.error(`🎨 Asetta Agent initialized on ${this.network}`);
        console.error(`📍 Wallet address: ${this.account.address}`);

    }

    async connect(): Promise<void> {
        try {
            // Test connection by getting chain ID
            const chainId = await this.publicClient.getChainId();
            console.error(`✅ Connected to the network (Chain ID: ${chainId})`);
            console.error(`🌐 Network: ${this.network}`);
            console.error(`🔗 Explorer: ${this.networkInfo.rpcProviderUrl}`);
        } catch (error) {
            console.error('❌ Failed to connect to Story Protocol:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        console.error('🔌 Disconnected from the network');
    }

}
