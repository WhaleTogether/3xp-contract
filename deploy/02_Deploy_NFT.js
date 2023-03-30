const { ethers, upgrades } = require("hardhat");
const {
  networkConfig,
  CONTRACTS,
  contratsToDeploy,
} = require("../utils/helper-hardhat-config");
const fs = require("fs");
const func = async ({ deployments, getChainId }) => {
  const { log } = deployments;
  const chainId = await getChainId();

  const { hoppiCarrot, devMultisigAddress } = networkConfig[chainId];
  const {
    contractName,
    contractSymbol,
    initBaseURI,
    royalty,
    publicSaleConfig,
    freeMintSignerAddress,
  } = hoppiCarrot;

  if (contratsToDeploy.hoppiCarrot.deploy) {
    log(
      "======================================================================",
    );
    log(
      `====================== NFT: ${contractName} [${CONTRACTS.nft}] ==========================`,
    );
    log(
      "======================================================================",
    );

    const NFT = await ethers.getContractFactory(CONTRACTS.nft);
    console.log("Deploying...");
    const nft = await upgrades.deployProxy(
      NFT,
      [
        contractName,
        contractSymbol,
        initBaseURI,
        devMultisigAddress, // dev multisig
        royalty,
        publicSaleConfig,
        freeMintSignerAddress,
      ],
      {
        initializer: "initialize",
      },
    );
    await nft.deployed();

    const addresses = {
      proxy: nft.address,
      admin: await upgrades.erc1967.getAdminAddress(nft.address),
      implementation: await upgrades.erc1967.getImplementationAddress(
        nft.address,
      ),
    };
    console.log("Addresses:", addresses);

    const networkName = networkConfig[chainId]["name"];

    fs.writeFileSync(
      `${networkName}-deployment-hoppiCarrot-addresses.json`,
      JSON.stringify(addresses, null, 2),
    );

    log("=====================================================");
    log(`You have deployed an NFT contract to "${nft.address}"`);
    log("=====================================================");

    if (contratsToDeploy.hoppiCarrot.verify) {
      await run("verify:verify", {
        address: addresses.implementation,
        constructorArguments: [],
      });

      console.log("***********************************");
      console.log("***********************************");
      console.log("\n");
      console.log(`[Contract] ${CONTRACTS.nft} has been verify!`);
      console.log("\n");
      console.log("***********************************");
      console.log("***********************************");
    }
  } else {
    log(
      "======================================================================",
    );
    log(
      `====================== [SKIPPED]: ${contractName} [${CONTRACTS.nft}] ==========================`,
    );
    log(
      "======================================================================",
    );
  }
};

func.tags = ["nft"];

module.exports = func;
