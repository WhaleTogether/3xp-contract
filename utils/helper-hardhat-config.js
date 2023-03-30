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
  hoppiCarrot: {
    deploy: false,
    verify: false,
    upgrade: false,
    verifyUpgrade: false,
  },
  hoppi: {
    deploy: true,
    verify: true,
    upgrade: false,
    verifyUpgrade: false,
  },
};

const networkConfig = {
  default: {
    name: "hardhat",
    Hoppi: {
      contractName: "__HOPPPPPP__",
      contractSymbol: "HOPP",
      initBaseURI: "https://staging-alphiewhales.herokuapp.com/tokens/",
      royalty: 500,
      publicSaleConfig: {
        maxPerTransaction: hoppiPublicSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther(
          hoppiMainnetPublicSaleUnitPrice.toString(),
        ),
      },
      exclusiveSaleConfig: {
        saleId: EXCLUSIVE_SALE_ID,
        maxPerWallet: exclusiveSaleMaxPerWallet,
        maxPerTransaction: exclusiveSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther("0"),
        signerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
        maxPerRound: 300,
      },
      adoptionPlan: {
        enabled: false,
        maxSupply: 1000,
        devReserve: 50,
        fcfsSupply: 650,
        carrotAmountRequiredPerAdoption: 3,
        maxPerWalletFCFS: 1,
      },
    },
  },
  1: {
    name: "main",
    wethAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    devMultisigAddress: "0x274851D66ea94d3E888133Ab00F98526B1772743",
    hoppiCarrot: {
      contractName: "HoppisCarrots",
      contractSymbol: "CARROT",
      initBaseURI: "https://3xp.s3.amazonaws.com/hoppis-carrots/",
      royalty: 500,
      publicSaleConfig: {
        maxPerTransaction: publicSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther(
          mainnetPublicSaleUnitPrice.toString(),
        ),
      },
      freeMintSignerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
    },
    hoppi: {
      contractName: "Hoppi",
      contractSymbol: "HOPPI",
      initBaseURI: "https://api.3xp.art/api/v1/hoppi/metadata/",
      royalty: 500,
      publicSaleConfig: {
        maxPerTransaction: hoppiPublicSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther(
          hoppiMainnetPublicSaleUnitPrice.toString(),
        ),
      },
      exclusiveSaleConfig: {
        saleId: EXCLUSIVE_SALE_ID,
        maxPerWallet: exclusiveSaleMaxPerWallet,
        maxPerTransaction: exclusiveSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther("0"),
        signerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
        maxPerRound: 300,
      },
      adoptionPlan: {
        enabled: false,
        maxSupply: 1000,
        devReserve: 50,
        fcfsSupply: 650,
        carrotAmountRequiredPerAdoption: 3,
        maxPerWalletFCFS: 1,
      },
    },
  },
  5: {
    name: "goerli",
    wethAddress: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
    devMultisigAddress: "0x274851D66ea94d3E888133Ab00F98526B1772743",
    hoppiCarrot: {
      contractName: "REALRABBIT",
      contractSymbol: "R___RABIT",
      initBaseURI: "https://dev-api.3xp.art/api/v1/hoppi/tokens/",
      royalty: 500,
      publicSaleConfig: {
        maxPerTransaction: publicSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther(
          testnetPublicSaleUnitPrice.toString(),
        ),
      },
      freeMintSignerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
    },
    hoppi: {
      contractName: "___BOONBOON__",
      contractSymbol: "BOON",
      initBaseURI: "https://staging-alphiewhales.herokuapp.com/tokens/",
      royalty: 500,
      publicSaleConfig: {
        maxPerTransaction: hoppiPublicSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther(
          hoppiTestnetPublicSaleUnitPrice.toString(),
        ),
      },
      exclusiveSaleConfig: {
        saleId: EXCLUSIVE_SALE_ID,
        maxPerWallet: exclusiveSaleMaxPerWallet,
        maxPerTransaction: exclusiveSaleMaxPerTransaction,
        unitPrice: ethers.utils.parseEther("0"),
        signerAddress: "0xBf17BCb397010d16bE98B0c21F4e0183F1b61cac",
        maxPerRound: 300,
      },
      adoptionPlan: {
        enabled: false,
        maxSupply: 1000,
        devReserve: 50,
        fcfsSupply: 650,
        carrotAmountRequiredPerAdoption: 3,
        maxPerWalletFCFS: 1,
      },
    },
  },
};

const CONTRACTS = {
  threeXp: "__3XPMint",
  threeXpUpgrade: "__3xpMintV2",
  nft: "HoppiCarrot",
  nftUpgrade: "HoppiCarrotV2",
  hoppi: "Hoppi",
  hoppiUpgrade: "HoppiV2",
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
