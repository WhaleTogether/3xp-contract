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
  });

  describe("Bonus Mint", () => {
    it("BonusMint should fail --> not enabled", async () => {
      await nft.toggleFreeMintEnabled(typeId);

      const amount = 2;
      const freeMintSignature = await owner.signMessage(
        hashAccount(addr1.address, typeId, amount, addr2.address),
      );

      await nft
        .connect(addr1)
        .freeMint(typeId, amount, addr2.address, freeMintSignature);

      try {
        await nft.toggleFreeMintEnabled(typeId);
        await nft.connect(addr2).bonusMint(typeId);
      } catch (error) {
        expect(error.message).to.be.contain("FreeMintNotEnabled");
      }
    });

    it("BonusMint should pass", async () => {
      await nft.toggleFreeMintEnabled(typeId);

      const amount = 2;
      const freeMintSignature = await owner.signMessage(
        hashAccount(addr1.address, typeId, amount, addr2.address),
      );

      await nft
        .connect(addr1)
        .freeMint(typeId, amount, addr2.address, freeMintSignature);

      const hoppiLoverMintInfo = await nft
        .connect(addr1)
        .hoppiLoverMintInfo(typeId, addr2.address);

      expect(hoppiLoverMintInfo.bonusMintAmount).to.equal(1);

      await nft.connect(addr2).bonusMint(typeId);

      const hoppiLoverMintInfoAfter1 = await nft
        .connect(addr1)
        .hoppiLoverMintInfo(typeId, addr1.address);

      const hoppiLoverMintInfoAfter2 = await nft
        .connect(addr1)
        .hoppiLoverMintInfo(typeId, addr2.address);

      expect(hoppiLoverMintInfoAfter1.bonusMintAmount).to.equal(1);
      expect(hoppiLoverMintInfoAfter1.totalMintedAmount).to.equal(2);

      expect(hoppiLoverMintInfoAfter2.bonusMintAmount).to.equal(0);
      expect(hoppiLoverMintInfoAfter2.totalMintedAmount).to.equal(1);
    });

    it("BonusMint should fail --> cannot claim no more", async () => {
      await nft.toggleFreeMintEnabled(typeId);

      const amount = 2;
      const freeMintSignature = await owner.signMessage(
        hashAccount(addr1.address, typeId, amount, addr2.address),
      );

      await nft
        .connect(addr1)
        .freeMint(typeId, amount, addr2.address, freeMintSignature);

      const hoppiLoverMintInfo = await nft
        .connect(addr1)
        .hoppiLoverMintInfo(typeId, addr2.address);

      expect(hoppiLoverMintInfo.bonusMintAmount).to.equal(1);

      await nft.connect(addr2).bonusMint(typeId);

      const hoppiLoverMintInfoAfter = await nft
        .connect(addr1)
        .hoppiLoverMintInfo(typeId, addr2.address);

      expect(hoppiLoverMintInfoAfter.bonusMintAmount).to.equal(0);
      expect(hoppiLoverMintInfoAfter.totalMintedAmount).to.equal(1);

      try {
        await nft.connect(addr2).bonusMint(typeId);
      } catch (error) {
        expect(error.message).to.be.contain(
          "You already claimed all of your bonus mint",
        );
      }
    });
  });
});
