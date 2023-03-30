const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { CONTRACTS } = require("../utils/helper-hardhat-config");

describe("3XP Mint Contract", () => {
  let NFT;
  let nft;
  let devMultisig;

  const royalty = 770;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, _] = await ethers.getSigners();
    provider = ethers.provider;

    devMultisig = addr3.address;

    NFT = await ethers.getContractFactory(CONTRACTS.threeXp);
    nft = await upgrades.deployProxy(
      NFT,
      [
        "_3xpMint", // name
        "3XPMINT", // symbol
        "https://gateway.pinata.cloud/ipfs/Qmego24DURSSuijn1iVwbpiVFQG9WXKnUkiV4SErJmHJAd/", // baseURI
        devMultisig, // devMultisig
        royalty,
      ],
      {
        initializer: "initialize",
      },
    );
    await nft.deployed();

    ({ chainId } = await ethers.provider.getNetwork());
  });

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      expect(await nft.owner()).to.equal(owner.address);
    });
  });

  describe("3XP Mint", () => {
    it("Add Minter should fail -> NOT Owner", async () => {
      try {
        await nft.connect(addr1).addMinter(addr1.address);
      } catch (error) {
        expect(error.message).to.contain("Ownable: caller is not the owner");
      }
    });

    it("Mint should fail -> NOT minter", async () => {
      try {
        const amount = 10;
        await nft.connect(addr1).mint(addr1.address, amount);
      } catch (error) {
        expect(error.message).to.contain("__3XP__NotMinter");
      }
    });

    it("Mint should pass -> mint 10", async () => {
      const amount = 10;

      await nft.addMinter(addr1.address);
      await nft.connect(addr1).mint(addr1.address, amount);
      expect(await nft.balanceOf(addr1.address)).to.equal(amount);
      const nfts = await nft.tokensOfOwner(addr1.address);
      expect(nfts.length).to.equal(amount);
    });
  });
});
