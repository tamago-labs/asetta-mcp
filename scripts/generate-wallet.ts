#!/usr/bin/env ts-node

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 🚀 Quick Wallet Generator 
 * 
 * Generates a new Ethereum wallet and saves to .env
 * No network connection required - just pure wallet generation
 */

function generateWallet() {
    console.log('🔑 Generating new Ethereum wallet...\\n');

    // Generate wallet
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    console.log('✅ Wallet generated successfully!');
    console.log(`   Address: ${account.address}`);
    console.log(`   Private Key: ${privateKey}\\n`);

    // Create .env file
    const envPath = path.join(process.cwd(), '.env');
    const envExists = fs.existsSync(envPath);

    if (envExists) {
        console.log('⚠️  .env file already exists');
        console.log('   Backing up to .env.backup...');
        fs.copyFileSync(envPath, path.join(process.cwd(), '.env.backup'));
    }

    const envContent = `# Wallet Configuration
# Generated: ${new Date().toISOString()}

# Wallet Credentials
WALLET_PRIVATE_KEY=${privateKey.slice(2)}   

# Wallet Details (for reference)
# Address: ${account.address} 
# Generated: ${new Date().toISOString()}

# Security Warning: Never share your private key or commit this file!
`;

    fs.writeFileSync(envPath, envContent);
    console.log('📄 .env file created with wallet configuration\\n');

    console.log('🌟 Wallet ready for testing! 🌟');
}

if (require.main === module) {
    generateWallet();
}

export { generateWallet };