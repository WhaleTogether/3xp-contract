const { expect } = require("chai");
const { CONTRACTS } = require("../utils/helper-hardhat-config");
const { BigNumber } = require("ethers");

const hashWhitelistAccount = (projectId, saleId, account, type) => {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(
        ["uint256", "uint256", "address", "uint256"],
        [projectId, saleId, account, type],
      )
      .slice(2),
    "hex",
  );
};

describe("NFT Contract", () => {
  let NFT;
  let devMultisig;
  let artistAddress;
  let devAddress;
  let signature;

  const CurrencyType = {
    ETH: 0,
    ERC20: 1,
    ERC1155: 2,
  };

  const royalty = 770;

  const maxSupply = 1000;
  const devReserve = 30;
  const artistReserve = 60;
  const projectId = 1;
  const saleId = 1;

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

    await nftFactory.addMinter(nftSale.address);

    await nftSale.addProject(
      nftFactory.address,
      artistAddress,
      maxSupply,
      devReserve,
      artistReserve,
      0,
    );

    const maxPerTransaction = 5;
    const erc20Address = ethers.constants.AddressZero;
    const erc1155Address = ethers.constants.AddressZero;
    const unitPriceInEth = ethers.utils.parseEther("0.1");
    const unitPriceInErc20 = 0;
    const unitPriceInErc1155 = 0;
    const erc1155Id = 0;

    await nftSale.setPublicSaleConfig(
      projectId,
      maxPerTransaction,
      erc20Address,
      erc1155Address,
      unitPriceInEth,
      unitPriceInErc20,
      unitPriceInErc1155,
      erc1155Id,
    );

    const signerAddress = addr6.address;
    const maxSupplyPerRound = 10;

    await nftSale.setSaleConfig(
      projectId,
      saleId,
      2, // maxPerTransaction
      signerAddress,
      maxSupplyPerRound,
      erc20Address,
      erc1155Address,
      ethers.utils.parseEther("0.15"),
      unitPriceInErc20,
      unitPriceInErc1155,
      erc1155Id,
    );

    signature = await addr6.signMessage(
      hashWhitelistAccount(projectId, saleId, addr1.address, 1),
    );
  });

  describe("Payout Claim", () => {
    it("Payout Claim should fail --> not enabled", async () => {
      await expect(nftSale.connect(addr2).claimPayout()).to.be.revertedWith(
        "PayoutNotActive",
      );
    });

    it("Payout Claim should pass", async () => {
      await nftSale.setSaleStatus(projectId, 0, true);
      await nftSale.setSaleStatus(projectId, saleId, true);
      const project = await nftSale.projectDetails(projectId);

      const amount = 2;
      const cost = (0.1 * amount).toFixed(3);

      const revenueShareAmount =
        (ethers.utils.parseEther(cost.toString()) *
          project.revenueSharePercentage) /
        10000;

      await expect(() =>
        nftSale
          .connect(addr1)
          .publicMint(projectId, amount, CurrencyType.ETH, addr2.address, {
            value: ethers.utils.parseEther(cost.toString()),
          }),
      ).to.changeEtherBalances(
        [addr1, addr3],
        [
          ethers.utils.parseEther((-cost).toString()),
          ethers.utils
            .parseEther(cost.toString())
            .sub(ethers.utils.parseUnits(revenueShareAmount.toString(), 0)),
        ],
      );

      const referralInfo = await nftSale
        .connect(addr1)
        .referralInfo(addr2.address);

      expect(referralInfo.revenueShareAmount).to.equal(
        BigNumber.from(
          (
            (ethers.utils.parseEther(cost.toString()) *
              project.revenueSharePercentage) /
            10000
          ).toString(),
        ),
      );

      await nftSale.togglePayoutStatus(true);

      await expect(() =>
        nftSale.connect(addr2).claimPayout(),
      ).to.changeEtherBalances(
        [addr2],
        [
          BigNumber.from(
            (
              (ethers.utils.parseEther(cost.toString()) *
                project.revenueSharePercentage) /
              10000
            ).toString(),
          ),
        ],
      );

      const referralInfoAfter = await nftSale
        .connect(addr1)
        .referralInfo(addr2.address);

      expect(referralInfoAfter.revenueShareAmount).to.equal(0);
      expect(referralInfoAfter.claimedRevenueShareAmount).to.equal(
        BigNumber.from(
          (
            (ethers.utils.parseEther(cost.toString()) *
              project.revenueSharePercentage) /
            10000
          ).toString(),
        ),
      );
    });

    it("BonusMint should fail --> cannot claim no more", async () => {
      await nftSale.setSaleStatus(projectId, 0, true);
      await nftSale.setSaleStatus(projectId, saleId, true);

      const project = await nftSale.projectDetails(projectId);

      const amount = 2;
      const cost = (0.1 * amount).toFixed(3);

      const revenueShareAmount =
        (ethers.utils.parseEther(cost.toString()) *
          project.revenueSharePercentage) /
        10000;

      await expect(() =>
        nftSale
          .connect(addr1)
          .publicMint(projectId, amount, CurrencyType.ETH, addr2.address, {
            value: ethers.utils.parseEther(cost.toString()),
          }),
      ).to.changeEtherBalances(
        [addr1, addr3],
        [
          ethers.utils.parseEther((-cost).toString()),
          ethers.utils
            .parseEther(cost.toString())
            .sub(ethers.utils.parseUnits(revenueShareAmount.toString(), 0)),
        ],
      );

      const referralInfo = await nftSale
        .connect(addr1)
        .referralInfo(addr2.address);

      expect(referralInfo.revenueShareAmount).to.equal(
        BigNumber.from(
          (
            (ethers.utils.parseEther(cost.toString()) *
              project.revenueSharePercentage) /
            10000
          ).toString(),
        ),
      );

      await nftSale.togglePayoutStatus(true);

      await expect(() =>
        nftSale.connect(addr2).claimPayout(),
      ).to.changeEtherBalances(
        [addr2],
        [
          BigNumber.from(
            (
              (ethers.utils.parseEther(cost.toString()) *
                project.revenueSharePercentage) /
              10000
            ).toString(),
          ),
        ],
      );

      const referralInfoAfter = await nftSale
        .connect(addr1)
        .referralInfo(addr2.address);

      expect(referralInfoAfter.revenueShareAmount).to.equal(0);
      expect(referralInfoAfter.claimedRevenueShareAmount).to.equal(
        BigNumber.from(
          (
            (ethers.utils.parseEther(cost.toString()) *
              project.revenueSharePercentage) /
            10000
          ).toString(),
        ),
      );

      await expect(nftSale.connect(addr2).claimPayout()).to.be.revertedWith(
        "NoETHLeft",
      );
    });
  });
});
