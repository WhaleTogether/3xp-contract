const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { CONTRACTS } = require("../utils/helper-hardhat-config");

describe("NFT Sale Contract", () => {
  let NFT;
  let devMultisig;
  let artistAddress;
  let devAddress;

  const costPerUnitPublic = 0.05;
  const royalty = 770;

  const maxSupply = 1000;
  const devReserve = 30;
  const artistReserve = 60;

  const projectId = 1;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, addr4, addr5, addr6, _] =
      await ethers.getSigners();
    provider = ethers.provider;

    devMultisig = addr3.address;
    artistAddress = addr4.address;

    devAddress = addr5.address;

    NFTSale = await ethers.getContractFactory(CONTRACTS.nftSale);
    nftSale = await upgrades.deployProxy(
      NFTSale,
      [
        devMultisig, // devMultisig
      ],
      {
        initializer: "initialize",
      },
    );
    await nftSale.deployed();

    // create nft contract
    NFT = await ethers.getContractFactory(CONTRACTS.nft);
    nftFactory = await NFT.deploy(
      "MM456YY_name",
      "MM456YY",
      "https://something.com/metatadata",
      devMultisig,
      royalty,
    );

    await nftSale.addProject(
      nftFactory.address,
      artistAddress,
      maxSupply,
      devReserve,
      artistReserve,
      0,
    );
  });

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      expect(await nftFactory.owner()).to.equal(owner.address);
    });
  });

  describe("NFT Mint", () => {
    it("Add Minter should fail -> NOT Owner", async () => {
      try {
        await nftFactory.connect(addr1).addMinter(addr1.address);
      } catch (error) {
        expect(error.message).to.contain("Ownable: caller is not the owner");
      }
    });

    it("Mint should fail -> NOT minter", async () => {
      try {
        const amount = 10;
        await nftFactory.connect(addr1).mint(addr1.address, amount);
      } catch (error) {
        expect(error.message).to.contain("NotMinter");
      }
    });

    it("Mint should pass -> mint 10", async () => {
      const amount = 10;

      await nftFactory.addMinter(addr1.address);
      await nftFactory.connect(addr1).mint(addr1.address, amount);
      expect(await nftFactory.balanceOf(addr1.address)).to.equal(amount);
      const nfts = await nftFactory.tokensOfOwner(addr1.address);
      expect(nfts.length).to.equal(amount);
    });
  });
});
