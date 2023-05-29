const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { CONTRACTS } = require("../utils/helper-hardhat-config");

describe.only("NFT Sale Contract", () => {
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
    );
  });

  describe("SaleConfig", function () {
    it("should set public sale config correctly", async function () {
      // Set the public sale config
      const projectId = 1;
      const maxPerTransaction = 5;
      const erc20Address = ethers.constants.AddressZero;
      const erc1155Address = ethers.constants.AddressZero;
      const unitPriceInEth = ethers.utils.parseEther("0.1");
      const unitPriceInErc20 = 0;
      const unitPriceInErc1155 = 0;

      await nftSale.setPublicSaleConfig(
        projectId,
        maxPerTransaction,
        erc20Address,
        erc1155Address,
        unitPriceInEth,
        unitPriceInErc20,
        unitPriceInErc1155,
      );

      // Get the public sale config
      const saleConfig = await nftSale.getPublicSaleConfig(projectId);

      // Assert the values are set correctly
      expect(saleConfig.enabled).to.be.false;
      expect(saleConfig.maxPerTransaction).to.equal(maxPerTransaction);
      expect(saleConfig.erc20Address).to.equal(erc20Address);
      expect(saleConfig.erc1155Address).to.equal(erc1155Address);
      expect(saleConfig.unitPriceInEth).to.equal(unitPriceInEth);
      expect(saleConfig.unitPriceInErc20).to.equal(unitPriceInErc20);
      expect(saleConfig.unitPriceInErc1155).to.equal(unitPriceInErc1155);
    });

    it("should set sale config correctly", async function () {
      // Set the sale config
      const projectId = 1;
      const saleId = 1;
      const maxPerTransaction = 5;
      const signerAddress = addr6.address;
      const maxSupplyPerRound = 100;
      const erc20Address = ethers.constants.AddressZero;
      const erc1155Address = ethers.constants.AddressZero;
      const unitPriceInEth = ethers.utils.parseEther("0.1");
      const unitPriceInErc20 = 0;
      const unitPriceInErc1155 = 0;

      await nftSale.setSaleConfig(
        projectId,
        saleId,
        maxPerTransaction,
        signerAddress,
        maxSupplyPerRound,
        erc20Address,
        erc1155Address,
        unitPriceInEth,
        unitPriceInErc20,
        unitPriceInErc1155,
      );

      // Get the sale config
      const saleConfig = await nftSale.getSaleConfig(projectId, saleId);

      // Assert the values are set correctly
      expect(saleConfig.enabled).to.be.false;
      expect(saleConfig.maxPerTransaction).to.equal(maxPerTransaction);
      expect(saleConfig.signerAddress).to.equal(signerAddress);
      expect(saleConfig.maxSupplyPerRound).to.equal(maxSupplyPerRound);
      expect(saleConfig.erc20Address).to.equal(erc20Address);
      expect(saleConfig.erc1155Address).to.equal(erc1155Address);
      expect(saleConfig.unitPriceInEth).to.equal(unitPriceInEth);
      expect(saleConfig.unitPriceInErc20).to.equal(unitPriceInErc20);
      expect(saleConfig.unitPriceInErc1155).to.equal(unitPriceInErc1155);
    });

    it("should disable sale config correctly", async function () {
      // Disable the sale config
      const projectId = 1;
      const saleId = 1;

      await nftSale.setSaleStatus(projectId, saleId, true);

      // Get the disabled sale config
      const saleConfig = await nftSale.getSaleConfig(projectId, saleId);

      // Assert the sale config is disabled
      expect(saleConfig.enabled).to.be.true;
    });
  });
});
