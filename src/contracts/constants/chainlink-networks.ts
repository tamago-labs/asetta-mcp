export const CHAINLINK_NETWORKS = {
  ethereumSepolia: {
    chainId: 11155111,
    chainSelector: "16015286601757825753",
    routerAddress: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
    linkAddress: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    rmnProxyAddress: "0xba3f6251de62dED61Ff98590cB2fDf6871FbB991",
    registryModuleOwnerCustomAddress: "0x62e731218d0D47305aba2BE3751E7EE9E5520790",
    tokenAdminRegistryAddress: "0x95F29FEE11c5C55d26cCcf1DB6772DE953B37B82"
  },
  arbitrumSepolia: {
    chainId: 421614,
    chainSelector: "3478487238524512106",
    routerAddress: "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165",
    linkAddress: "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E",
    rmnProxyAddress: "0x9527E2d01A3064ef6b50c1Da1C0cC523803BCFF2",
    registryModuleOwnerCustomAddress: "0xE625f0b8b0Ac86946035a7729Aba124c8A64cf69",
    tokenAdminRegistryAddress: "0x8126bE56454B628a88C17849B9ED99dd5a11Bd2f"
  },
  avalancheFuji: {
    chainId: 43113,
    chainSelector: "14767482510784806043",
    routerAddress: "0xF694E193200268f9a4868e4Aa017A0118C9a8177",
    linkAddress: "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846",
    rmnProxyAddress: "0xAc8CFc3762a979628334a0E4C1026244498E821b",
    registryModuleOwnerCustomAddress: "0x97300785aF1edE1343DB6d90706A35CF14aA3d81",
    tokenAdminRegistryAddress: "0xA92053a4a3922084d992fD2835bdBa4caC6877e6"
  }
} as const;

export type ChainlinkNetwork = keyof typeof CHAINLINK_NETWORKS;
export type NetworkConfig = typeof CHAINLINK_NETWORKS[ChainlinkNetwork];

export const DEFAULT_RATE_LIMIT_CONFIG = {
  isEnabled: true,
  capacity: 100000,
  rate: 167
} as const;
