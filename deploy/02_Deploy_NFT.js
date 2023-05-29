const { ethers, upgrades } = require("hardhat");
const {
  networkConfig,
  CONTRACTS,
  contratsToDeploy,
} = require("../utils/helper-hardhat-config");
const fs = require("fs");
const func = async ({ deployments, getChainId }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  const { nft: nftInfo, devMultisigAddress } = networkConfig[chainId];
  const { contractName, contractSymbol, initBaseURI, royalty } = nftInfo;

  if (contratsToDeploy.nft.deploy) {
    log(
      "======================================================================",
    );
    log(`========= NFT: ${contractName} [${CONTRACTS.nft}] ==================`);
    log(
      "======================================================================",
    );

    const nft = await deploy(CONTRACTS.nft, {
      from: deployer,
      log: true,
      args: [
        contractName,
        contractSymbol,
        initBaseURI,
        devMultisigAddress,
        royalty,
      ],
    });

    const networkName = networkConfig[chainId]["name"];

    fs.writeFileSync(
      `${networkName}-deployment-nft-addresses.json`,
      JSON.stringify(nft.address, null, 2),
    );

    log("=====================================================");
    log(`You have deployed an NFT contract to "${nft.address}"`);
    log("=====================================================");

    if (contratsToDeploy.nft.verify) {
      await run("verify:verify", {
        address: nft.address,
        constructorArguments: [
          contractName,
          contractSymbol,
          initBaseURI,
          devMultisigAddress,
          royalty,
        ],
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
