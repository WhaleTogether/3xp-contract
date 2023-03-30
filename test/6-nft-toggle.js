const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { CONTRACTS } = require("../utils/helper-hardhat-config");

const costPerUnitPublic = 0.05;
const royalty = 770;
const typeId = 0;

const hashAccount = (account, typeId, amount, referralWalletAddress) => {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(
        ["address", "uint256", "uint256", "address"],
        [account, typeId, amount, referralWalletAddress],
      )
      .slice(2),
    "hex",
  );
};

describe("NFT Contract", () => {
  let NFT;
  let nft;
  let devMultisig;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, _] = await ethers.getSigners();
    provider = ethers.provider;

    devMultisig = addr3.address;

    const publicSaleConfig = {
      maxPerTransaction: 10,
      unitPrice: ethers.utils.parseEther(costPerUnitPublic.toString()),
    };

    NFT = await ethers.getContractFactory(CONTRACTS.nft);
    nft = await upgrades.deployProxy(
      NFT,
      [
        "Cilantro", // name
        "CIL", // symbol
        "https://gateway.pinata.cloud/ipfs/Qmego24DURSSuijn1iVwbpiVFQG9WXKnUkiV4SErJmHJAd/", // baseURI
        devMultisig, // devMultisig
        royalty,
        publicSaleConfig,
        owner.address,
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

    ({ chainId } = await ethers.provider.getNetwork());
  });

  describe("Toggle Sale On/Off", () => {
    it("Toggle Everyhing on and off should pass", async () => {
      await nft.toggleFreeMintEnabled(typeId);
      await nft.setPublicSaleStatus(typeId, true);

      const publicSaleConfig = await nft.getPublicSaleConfig(typeId);
      const isFreeMintEnabled = await nft.isFreeMintEnabled(typeId);

      expect(publicSaleConfig.enabled).to.equal(true);
      expect(isFreeMintEnabled).to.equal(true);

      await nft.toggleFreeMintAndPublicSale(typeId, false);

      expect((await nft.getPublicSaleConfig(typeId)).enabled).to.equal(false);
      expect(await nft.isFreeMintEnabled(typeId)).to.equal(false);
    });
  });
});
