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
    privateSaleSignature2 = await addr4.signMessage(
      hashWhitelistAccount(addr2.address, EXCLUSIVE_SALE_ID),
    );
    privateSaleSignature3 = await addr4.signMessage(
      hashWhitelistAccount(addr3.address, EXCLUSIVE_SALE_ID),
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

  describe("Whitelist", () => {
    it("Whitelist user first time checking  -> should show isWhitelisted: true and 2 mintAmount", async () => {
      const [isWhitelistedBool, mintAmount] = await nft
        .connect(addr1)
        .isWhitelisted(EXCLUSIVE_SALE_ID, privateSaleSignature);
      expect(isWhitelistedBool).to.be.equal(true);
      expect(mintAmount).to.be.equal(2);
    });

    it("mint 1 and should show mintAmount down to 1", async () => {
      const [isWhitelistedBool, mintAmount] = await nft
        .connect(addr1)
        .isWhitelisted(EXCLUSIVE_SALE_ID, privateSaleSignature);
      expect(isWhitelistedBool).to.be.equal(true);
      expect(mintAmount).to.be.equal(2);

      await nft.setSaleStatus(EXCLUSIVE_SALE_ID, true);

      const amount = 1;
      const cost = (costPerUnitExclusive * amount).toFixed(3);

      const carrotOwned = await carrot.balanceOf(addr1.address, typeId);
      expect(carrotOwned).to.be.equal(50);

      await nft
        .connect(addr1)
        .exclusiveMint(EXCLUSIVE_SALE_ID, amount, privateSaleSignature, {
          value: ethers.utils.parseEther(cost.toString()),
        });

      const carrotOwned2 = await carrot.balanceOf(addr1.address, typeId);
      expect(carrotOwned2).to.be.equal(47);

      const { maxPerRound } = await nft.getSaleConfig(EXCLUSIVE_SALE_ID);
      expect(maxPerRound).to.be.equal(299);

      const [isWhitelistedAfter, mintAmountAfter] = await nft
        .connect(addr1)
        .isWhitelisted(EXCLUSIVE_SALE_ID, privateSaleSignature);
      expect(isWhitelistedAfter).to.be.equal(true);
      expect(mintAmountAfter).to.be.equal(1);

      await nft
        .connect(addr1)
        .exclusiveMint(EXCLUSIVE_SALE_ID, amount, privateSaleSignature, {
          value: ethers.utils.parseEther(cost.toString()),
        });

      expect(
        (await nft.getSaleConfig(EXCLUSIVE_SALE_ID)).maxPerRound,
      ).to.be.equal(298);

      await expect(
        nft
          .connect(addr1)
          .exclusiveMint(EXCLUSIVE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          }),
      ).to.be.revertedWith("Hoppi__ExceedsMaxPerWallet");

      expect(
        (await nft.getSaleConfig(EXCLUSIVE_SALE_ID)).maxPerRound,
      ).to.be.equal(298);

      await nft.setSaleStatus(0, true);
      await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther("0.1"),
      });
    });

    it("whitelist mint should fail -> over whitelist round supply", async () => {
      const [isWhitelistedBool, mintAmount] = await nft
        .connect(addr1)
        .isWhitelisted(EXCLUSIVE_SALE_ID, privateSaleSignature);
      expect(isWhitelistedBool).to.be.equal(true);
      expect(mintAmount).to.be.equal(2);

      await nft.setSaleStatus(EXCLUSIVE_SALE_ID, true);

      const amount = 2;
      const cost = (costPerUnitExclusive * amount).toFixed(3);

      const carrotOwned = await carrot.balanceOf(addr1.address, typeId);
      expect(carrotOwned).to.be.equal(50);

      await nft
        .connect(addr1)
        .exclusiveMint(EXCLUSIVE_SALE_ID, amount, privateSaleSignature, {
          value: ethers.utils.parseEther(cost.toString()),
        });

      const carrotOwned2 = await carrot.balanceOf(addr1.address, typeId);
      expect(carrotOwned2).to.be.equal(44);

      const { maxPerRound } = await nft.getSaleConfig(EXCLUSIVE_SALE_ID);
      expect(maxPerRound).to.be.equal(298);

      await nft.setSaleConfig(EXCLUSIVE_SALE_ID, 2, 2, 0, addr4.address, 2);

      const [isWhitelistedAfter, mintAmountAfter] = await nft
        .connect(addr1)
        .isWhitelisted(EXCLUSIVE_SALE_ID, privateSaleSignature);

      expect(isWhitelistedAfter).to.be.equal(true);
      expect(mintAmountAfter).to.be.equal(0);

      expect(
        (await nft.getSaleConfig(EXCLUSIVE_SALE_ID)).maxPerRound,
      ).to.be.equal(2);

      await nft
        .connect(addr2)
        .exclusiveMint(EXCLUSIVE_SALE_ID, amount, privateSaleSignature2, {
          value: ethers.utils.parseEther(cost.toString()),
        });

      expect(
        (await nft.getSaleConfig(EXCLUSIVE_SALE_ID)).maxPerRound,
      ).to.be.equal(0);

      await expect(
        nft
          .connect(addr3)
          .exclusiveMint(EXCLUSIVE_SALE_ID, amount, privateSaleSignature3, {
            value: ethers.utils.parseEther(cost.toString()),
          }),
      ).to.be.revertedWith("Hoppi__ExceedsMaxPerRound");
    });

    it("mint should fail because not enough carrot hold in  wallet", async () => {
      const [isWhitelistedBool, mintAmount] = await nft
        .connect(addr1)
        .isWhitelisted(EXCLUSIVE_SALE_ID, privateSaleSignature);
      expect(isWhitelistedBool).to.be.equal(true);
      expect(mintAmount).to.be.equal(2);

      await nft.setSaleStatus(EXCLUSIVE_SALE_ID, true);

      const amount = 1;
      const cost = (costPerUnitExclusive * amount).toFixed(3);
      const { carrotAmountRequiredPerAdoption } = await nft.adoptionPlan();

      const carrotOwned = await carrot.balanceOf(addr1.address, typeId);

      expect(carrotOwned).to.be.equal(50);

      await carrot.connect(addr1).burnCarrots(typeId, 48);
      expect(await carrot.balanceOf(addr1.address, typeId)).to.be.equal(2);

      await expect(
        nft
          .connect(addr1)
          .exclusiveMint(EXCLUSIVE_SALE_ID, amount, privateSaleSignature, {
            value: ethers.utils.parseEther(cost.toString()),
          }),
      ).to.be.revertedWith("Hoppi__NotEnoughCarrots");
    });

    it("whitelist mint should pass -> update hoppi stats", async () => {
      const [isWhitelistedBool, mintAmount] = await nft
        .connect(addr1)
        .isWhitelisted(EXCLUSIVE_SALE_ID, privateSaleSignature);
      expect(isWhitelistedBool).to.be.equal(true);
      expect(mintAmount).to.be.equal(2);

      await nft.setSaleStatus(EXCLUSIVE_SALE_ID, true);

      const amount = 2;
      const cost = (costPerUnitExclusive * amount).toFixed(3);

      const carrotOwned = await carrot.balanceOf(addr1.address, typeId);
      expect(carrotOwned).to.be.equal(50);

      await nft
        .connect(addr1)
        .exclusiveMint(EXCLUSIVE_SALE_ID, amount, privateSaleSignature, {
          value: ethers.utils.parseEther(cost.toString()),
        });

      await nft
        .connect(addr2)
        .exclusiveMint(EXCLUSIVE_SALE_ID, amount, privateSaleSignature2, {
          value: ethers.utils.parseEther(cost.toString()),
        });

      await nft
        .connect(addr3)
        .exclusiveMint(EXCLUSIVE_SALE_ID, amount, privateSaleSignature3, {
          value: ethers.utils.parseEther(cost.toString()),
        });

      const tokenId = 0;
      const tokenId1 = 1;
      const tokenId2 = 2;
      const tokenId3 = 3;
      const tokenId4 = 4;
      const tokenId5 = 5;
      const tokenId6 = 6;

      expect(
        (await nft.hoppiStats(tokenId)).totalAmountOfCarrotsEaten,
      ).to.be.equal(3);
      expect(
        (await nft.hoppiStats(tokenId1)).totalAmountOfCarrotsEaten,
      ).to.be.equal(3);
      expect(
        (await nft.hoppiStats(tokenId2)).totalAmountOfCarrotsEaten,
      ).to.be.equal(3);
      expect(
        (await nft.hoppiStats(tokenId3)).totalAmountOfCarrotsEaten,
      ).to.be.equal(3);
      expect(
        (await nft.hoppiStats(tokenId4)).totalAmountOfCarrotsEaten,
      ).to.be.equal(3);
      expect(
        (await nft.hoppiStats(tokenId5)).totalAmountOfCarrotsEaten,
      ).to.be.equal(3);
      expect(
        (await nft.hoppiStats(tokenId6)).totalAmountOfCarrotsEaten,
      ).to.be.equal(0);
    });
  });
});
