// HoppiCarrot
const publicSaleMaxPerTransaction = 50;
const mainnetPublicSaleUnitPrice = 0.003;
const testnetPublicSaleUnitPrice = 0.003;

// Hoppi
const hoppiPublicSaleMaxPerTransaction = 1;
const hoppiMainnetPublicSaleUnitPrice = 0.05;
const hoppiTestnetPublicSaleUnitPrice = 0.05;

const EXCLUSIVE_SALE_ID = 1;
const exclusiveSaleMaxPerWallet = 2;
const exclusiveSaleMaxPerTransaction = 2;

const contratsToDeploy = {
  nft: {
    deploy: true,
    verify: true,
  },
  nftSale: {
    deploy: false,
    verify: false,
    upgrade: false,
    verifyUpgrade: false,
  },
};

const networkConfig = {
  default: {
    name: "hardhat",
  },
  1: {
    name: "main",
    // devMultisigAddress: "",
    // nft: {
    //   contractName: "HoppisCarrots",
    //   contractSymbol: "CARROT",
    //   initBaseURI: "https://neomuse.s3.amazonaws.com/tokens/",
    //   royalty: 500,
    //   publicSaleConfig: {
    //     maxPerTransaction: publicSaleMaxPerTransaction,
    //     unitPrice: ethers.utils.parseEther(
    //       mainnetPublicSaleUnitPrice.toString(),
    //     ),
    //   },
    //   freeMintSignerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
    // },
  },
  5: {
    name: "goerli",
    devMultisigAddress: "0xd1ca34C113E690c8C7fFb0502531342Dc9F1c0Cd",
    nft: {
      contractName: "SOMETHING_3",
      contractSymbol: "SOME3",
      initBaseURI: "https://abc.xyz/tokens/",
      royalty: 500,
    },
  },
};

const CONTRACTS = {
  nft: "NFT",
  nftSale: "NFTSale",
  nftSaleUpgrade: "NFTSaleV2",
};

const developmentChains = ["hardhat", "localhost"];

const getNetworkIdFromName = async (networkIdName) => {
  for (const id in networkConfig) {
    if (networkConfig[id]["name"] == networkIdName) {
      return id;
    }
  }
  return null;
};

module.exports = {
  contratsToDeploy,
  networkConfig,
  getNetworkIdFromName,
  developmentChains,
  CONTRACTS,
};
