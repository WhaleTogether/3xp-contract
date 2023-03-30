const { expect } = require("chai");
const { networkConfig, CONTRACTS } = require("../utils/helper-hardhat-config");

const hashWhitelistAccount = (account, saleId) => {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(["address", "uint256"], [account, saleId])
      .slice(2),
    "hex",
  );
};

describe("Hoppi Contract", () => {
  let NFT;
  let nft;

  let Carrot;
  let carrot;

  let privateSaleSignature;
  let devMultisig;

  const EXCLUSIVE_SALE_ID = 1;

  const hoppi = networkConfig["default"][CONTRACTS.hoppi];
  const costPerUnitExclusive = 0;
  const costPerUnitPublicCarrot = 0.05;
  const typeId = 0;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, addr4, _] = await ethers.getSigners();
    provider = ethers.provider;

    devMultisig = addr3.address;

    const publicSaleConfig = {
      maxPerTransaction: 50,
      unitPrice: ethers.utils.parseEther(costPerUnitPublicCarrot.toString()),
    };

    NFT = await ethers.getContractFactory(CONTRACTS.hoppi);
    nft = await upgrades.deployProxy(
      NFT,
      [
        hoppi.contractName,
        hoppi.contractSymbol,
        hoppi.initBaseURI,
        devMultisig, // dev multisig
        hoppi.royalty,
        hoppi.publicSaleConfig,
        {
          ...hoppi.exclusiveSaleConfig,
          signerAddress: addr4.address,
        },
        hoppi.adoptionPlan,
      ],
      {
        initializer: "initialize",
      },
    );
    await nft.deployed();

    Carrot = await ethers.getContractFactory(CONTRACTS.nft);
    carrot = await upgrades.deployProxy(
      Carrot,
      [
        "Cilantro", // name
        "CIL", // symbol
        "https://gateway.pinata.cloud/ipfs/Qmego24DURSSuijn1iVwbpiVFQG9WXKnUkiV4SErJmHJAd/", // baseURI
        devMultisig, // devMultisig
        500,
        publicSaleConfig,
        owner.address,
      ],
      {
        initializer: "initialize",
      },
    );
    await carrot.deployed();

    privateSaleSignature = await addr4.signMessage(
      hashWhitelistAccount(addr1.address, EXCLUSIVE_SALE_ID),
    );

    await carrot.setPublicSaleStatus(typeId, true);
    await carrot.setHoppiContractAddress(nft.address);

    await nft.setHoppiCarrotContractAddress(carrot.address);

    const amount = 50;
    const cost = (costPerUnitPublicCarrot * amount).toFixed(3);
    const tx = await carrot.connect(addr1).publicMint(typeId, amount, {
      value: ethers.utils.parseEther(cost.toString()),
    });
    await carrot.connect(addr2).publicMint(typeId, amount, {
      value: ethers.utils.parseEther(cost.toString()),
    });
    await carrot.connect(addr3).publicMint(typeId, amount, {
      value: ethers.utils.parseEther(cost.toString()),
    });
  });

  describe("Dr. Hoppinstein Research Labs", () => {
    // research not enabled
    it("Donate should fail -> Research NOT Active", async () => {
      const researchId = 0;
      const carrotTypeId = 0;
      const carrotAmount = 9;
      expect(
        nft.donate(researchId, carrotTypeId, carrotAmount),
      ).to.be.revertedWith("Hoppi__ResearchNotEnabled");
    });

    it("Donate should fail -> Research NOT Active because no contract address set yet", async () => {
      const researchId = 0;
      const carrotTypeId = 0;
      const carrotAmount = 9;

      await nft.toggleResearch(researchId, true);

      expect(
        nft.donate(researchId, carrotTypeId, carrotAmount),
      ).to.be.revertedWith("Hoppi__ResearchNotEnabled");
    });

    // research enabled and carrot amount is more than 0
    it("Donate Carrots should update stats -> ", async () => {
      const researchId = 0;
      const carrotTypeId = 0;
      const carrotAmount = 9;

      await nft.toggleResearch(researchId, true);
      await nft.setDrHoppinsteinFundingWallet(addr4.address);

      await nft.connect(addr1).donate(researchId, carrotTypeId, carrotAmount);

      const researchInfo = await nft.drHoppinsteinResearch(researchId);

      expect(researchInfo.carrotsAmount).to.equal(9);
      expect(
        await nft.totalAmountOfCarrotsDonatedByCarrotType(
          researchId,
          carrotTypeId,
        ),
      ).to.equal(9);

      expect(
        await nft.totalAmountOfCarrotsDonatedByAddress(
          researchId,
          addr1.address,
        ),
      ).to.equal(9);
    });

    it("Donate ETH should update stats -> ", async () => {
      const researchId = 0;
      const carrotTypeId = 0;
      const carrotAmount = 9;

      await nft.toggleResearch(researchId, true);
      await nft.setDrHoppinsteinFundingWallet(addr4.address);

      const addr4ETHBalanceBEFORE = await ethers.provider.getBalance(
        addr4.address,
      );

      await nft.connect(addr1).donate(researchId, carrotTypeId, carrotAmount, {
        value: ethers.utils.parseEther("0.134"),
      });

      const researchInfo = await nft.drHoppinsteinResearch(researchId);

      expect(researchInfo.carrotsAmount).to.equal(9);
      expect(
        await nft.totalAmountOfCarrotsDonatedByCarrotType(
          researchId,
          carrotTypeId,
        ),
      ).to.equal(9);

      expect(
        await nft.totalAmountOfCarrotsDonatedByAddress(
          researchId,
          addr1.address,
        ),
      ).to.equal(9);

      expect(researchInfo.ethAmount).to.equal("134000000000000000");

      expect(
        await nft.totalAmountOfETHDonatedByAddress(researchId, addr1.address),
      ).to.equal("134000000000000000");

      const addr4ETHBalanceAFTER = await ethers.provider.getBalance(
        addr4.address,
      );

      console.log("addr4ETHBalanceBEFORE->", addr4ETHBalanceBEFORE.toString());
      console.log("addr4ETHBalanceAFTER->", addr4ETHBalanceAFTER.toString());
    });
  });
});
