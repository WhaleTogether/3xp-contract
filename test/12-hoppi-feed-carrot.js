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

  describe("Feed Hoppi", () => {
    // not time to feed yet
    it("Adoption should fail -> Not Time to Feed", async () => {
      const amount = 1;

      await nft.setAdoptionPlan(true, 999, 33, 650, 3, 1);
      await nft.connect(addr1).adoptHoppi(amount);
      await carrot.connect(addr1).burnCarrots(typeId, 46);

      const tokenId = 0;
      const carrotTypeId = 0;
      await expect(
        nft.connect(addr1).feedHoppiMany([tokenId], [carrotTypeId], [10]),
      ).to.be.revertedWith("Hoppi__IsNotTimeToFeed");
    });

    // not enough carrot
    it("Adoption should fail -> Not Enough Carrot", async () => {
      const amount = 1;

      await nft.setAdoptionPlan(true, 999, 33, 650, 3, 1);
      await nft.toggleIsTimeToFeed();

      await nft.connect(addr1).adoptHoppi(amount);
      await carrot.connect(addr1).burnCarrots(typeId, 46);

      const tokenId = 0;
      const carrotTypeId = 0;
      await expect(
        nft.connect(addr1).feedHoppiMany([tokenId], [carrotTypeId], [10]),
      ).to.be.revertedWith("Hoppi__NotEnoughCarrots");
    });

    // hoppi stats changed after feeding
    it("Adoption success -> Hoppi stats changed", async () => {
      const amount = 1;

      await nft.setAdoptionPlan(true, 2, 33, 650, 3, 1);
      await nft.toggleIsTimeToFeed();

      await nft.connect(addr1).adoptHoppi(amount);

      const tokenId = 0;
      const carrotTypeId = 0;

      expect(
        (await nft.hoppiStats(tokenId)).totalAmountOfCarrotsEaten,
      ).to.be.equal(3);

      await nft.connect(addr1).feedHoppiMany([tokenId], [carrotTypeId], [10]);

      expect(
        (await nft.hoppiStats(tokenId)).totalAmountOfCarrotsEaten,
      ).to.be.equal(13);

      expect(
        await nft.totalAmountOfCarrotsEatenByCarrotType(tokenId, carrotTypeId),
      ).to.be.equal(13);
    });

    //cannot feed other hoppi only hoppi owner can feed
    it("Adoption should fail -> not owner", async () => {
      const amount = 1;

      await nft.setAdoptionPlan(true, 2, 33, 650, 3, 1);
      await nft.toggleIsTimeToFeed();

      await nft.connect(addr1).adoptHoppi(amount);
      await nft.connect(addr2).adoptHoppi(amount);

      const tokenId = 0;
      const carrotTypeId = 0;

      expect(
        nft.connect(addr2).feedHoppiMany([tokenId], [carrotTypeId], [10]),
      ).to.be.revertedWith("Hoppi__NotTokenOwner");
    });
  });
});
