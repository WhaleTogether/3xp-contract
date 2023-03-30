const { expect } = require("chai");
const { CONTRACTS } = require("../utils/helper-hardhat-config");

const costPerUnitPublic = 0.05;
const royalty = 770;
const typeId = 0;

describe("NFT Role Guards", () => {
  let NFT;
  let nft;

  let provider;
  let devMultisig;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, addr4, _] = await ethers.getSigners();
    provider = ethers.provider;

    devMultisig = addr3.address;

    const publicSaleConfig = {
      maxPerTransaction: 5,
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

    await nft.setPublicSaleStatus(typeId, true);
    const amount = 3;
    const cost = (costPerUnitPublic * amount).toFixed(3);

    await nft.connect(addr1).publicMint(typeId, amount, {
      value: ethers.utils.parseEther(cost.toString()),
    });
  });

  describe("OnlyDevMultiSig", () => {
    it("Get current devMultiSigWallet", async () => {
      const devMultiSigWallet = await nft.connect(addr1).devMultiSigWallet();
      expect(devMultiSigWallet).to.equal(devMultisig);
    });

    it("Set new devMultiSigWallet should fail -> non dev multisig try to update dev multisig wallet", async () => {
      const devMultiSigWallet = await nft.connect(addr1).devMultiSigWallet();
      expect(devMultiSigWallet).to.equal(devMultisig);

      try {
        await nft.connect(addr1).updateDevMultiSigWallet(addr4.address);
      } catch (error) {
        expect(error.message).to.contain("OnlyDevMultiSigCan");
      }
    });

    it("Set new devMultiSigWallet should PASS ", async () => {
      const devMultiSigWallet = await nft.connect(addr1).devMultiSigWallet();
      expect(devMultiSigWallet).to.equal(devMultisig);

      await nft.connect(addr3).updateDevMultiSigWallet(addr4.address);

      const devMultiSigWalletNew = await nft.connect(addr1).devMultiSigWallet();
      expect(devMultiSigWalletNew).to.equal(addr4.address);
    });
  });
});
