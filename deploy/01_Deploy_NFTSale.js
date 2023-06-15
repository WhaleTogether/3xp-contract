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

  const { devMultisigAddress } = networkConfig[chainId];

  if (contratsToDeploy.nftSale.deploy) {
    log(
      "======================================================================",
    );
    log(
      `====================== NFT: [${CONTRACTS.nftSale}] ==========================`,
    );
    log(
      "======================================================================",
    );

    const NFTSale = await ethers.getContractFactory(CONTRACTS.nftSale);
    console.log("Deploying...");
    const nftSale = await upgrades.deployProxy(
      NFTSale,
      [
        devMultisigAddress, // dev multisig
      ],
      {
        initializer: "initialize",
      },
    );
    await nftSale.deployed();

    const addresses = {
      proxy: nftSale.address,
      admin: await upgrades.erc1967.getAdminAddress(nftSale.address),
      implementation: await upgrades.erc1967.getImplementationAddress(
        nftSale.address,
      ),
    };
    console.log("Addresses:", addresses);

    const networkName = networkConfig[chainId]["name"];

    fs.writeFileSync(
      `${networkName}-deployment-nftSale-addresses.json`,
      JSON.stringify(addresses, null, 2),
    );

    log("=====================================================");
    log(`You have deployed an NFT sale contract to "${nftSale.address}"`);
    log("=====================================================");

    if (contratsToDeploy.nftSale.verify) {
      await run("verify:verify", {
        address: addresses.implementation,
        constructorArguments: [],
      });

      console.log("***********************************");
      console.log("***********************************");
      console.log("\n");
      console.log(`[Contract] ${CONTRACTS.nftSale} has been verify!`);
      console.log("\n");
      console.log("***********************************");
      console.log("***********************************");
    }
  } else {
    log(
      "======================================================================",
    );
    log(
      `====================== [SKIPPED]: [${CONTRACTS.nftSale}] ==========================`,
    );
    log(
      "======================================================================",
    );
  }
};

func.tags = ["nft"];

module.exports = func;
