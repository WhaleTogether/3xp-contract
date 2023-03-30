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

  let devMultisig;

  const EXCLUSIVE_SALE_ID = 1;

  const hoppi = networkConfig["default"][CONTRACTS.hoppi];
  const costPerUnitPublicCarrot = 0.05;
  const costPerUnitPublic = 0.05;
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

  describe("Evolve Hoppi", () => {
    // evolve not enabled
    it("Evolve should fail -> NOT Active", async () => {
      const amount = 1;
      await nft.setAdoptionPlan(true, 999, 33, 650, 3, 1);
      await nft.connect(addr1).adoptHoppi(amount);
      await expect(
        nft.connect(addr1).evolveHoppiMany(1, [0], [0], [0]),
      ).to.be.revertedWith("Hoppi__EvolutionNotEnabled");
    });

    // hoppi need to be at certain stage to evolve (stageId - 1)
    it("Evolve should fail -> wrong stage to evolve", async () => {
      const amount = 1;
      await nft.setAdoptionPlan(true, 999, 33, 650, 3, 1);
      await nft.connect(addr1).adoptHoppi(amount);

      const stageId = 2;
      const enabled = true;
      const carrotTypeId = 0;
      const carrotAmount = 9;

      await nft.setEvolutionPlans(stageId, enabled, carrotTypeId, carrotAmount);

      await expect(
        nft.connect(addr1).evolveHoppiMany(2, [0], [0], [0]),
      ).to.be.revertedWith("Hoppi__NotReadyToEvolve");
    });

    //cannot evolve other hoppi only hoppi owner can evolve
    it("Evolve should fail -> not owner evolve", async () => {
      const amount = 1;
      await nft.setAdoptionPlan(true, 999, 33, 650, 3, 1);
      await nft.connect(addr1).adoptHoppi(amount);

      const stageId = 1;
      const enabled = true;
      const carrotTypeId = 0;
      const carrotAmount = 9;

      await nft.setEvolutionPlans(stageId, enabled, carrotTypeId, carrotAmount);

      await expect(
        nft.connect(addr2).evolveHoppiMany(1, [0], [0], [0]),
      ).to.be.revertedWith("Hoppi__NotTokenOwner");
    });

    // can feed and evolve hoppi in one transaction
    it("Evolve should pass -> can feed and evolve hoppi in one transaction", async () => {
      const amount = 1;
      await nft.setAdoptionPlan(true, 999, 33, 650, 3, 1);
      await nft.connect(addr1).adoptHoppi(amount);

      const stageId = 1;
      const enabled = true;
      const carrotTypeId = 0;
      const carrotAmount = 9;

      const tokenId = 0;

      await nft.setEvolutionPlans(stageId, enabled, carrotTypeId, carrotAmount);

      await nft
        .connect(addr1)
        .evolveHoppiMany(stageId, [tokenId], [carrotTypeId], [6]);

      expect(
        (await nft.hoppiStats(tokenId)).totalAmountOfCarrotsEaten,
      ).to.be.equal(9);

      expect(
        await nft.totalAmountOfCarrotsEatenByCarrotType(tokenId, carrotTypeId),
      ).to.be.equal(9);

      expect((await nft.hoppiStats(tokenId)).stage).to.be.equal(stageId);
    });

    // hoppi need to be fed enough carrot to evolve
    it("Evolve should fail -> hoppi need to be fed enough carrot to evolve", async () => {
      const amount = 1;
      await nft.setAdoptionPlan(true, 999, 33, 650, 3, 1);
      await nft.connect(addr1).adoptHoppi(amount);

      const stageId = 1;
      const enabled = true;
      const carrotTypeId = 0;
      const carrotAmount = 13;

      const tokenId = 0;

      await nft.setEvolutionPlans(stageId, enabled, carrotTypeId, carrotAmount);

      expect(
        nft
          .connect(addr1)
          .evolveHoppiMany(stageId, [tokenId], [carrotTypeId], [9]),
      ).to.be.revertedWith("Hoppi__NotEnoughCarrotsToEvolve");

      expect(
        (await nft.hoppiStats(tokenId)).totalAmountOfCarrotsEaten,
      ).to.be.equal(3);

      expect((await nft.hoppiStats(tokenId)).stage).to.be.equal(0);
    });

    it("Evolve multiple should pass", async () => {
      const amount = 1;
      await nft.setAdoptionPlan(true, 999, 33, 650, 3, 1);
      await nft.connect(addr1).adoptHoppi(amount);
      await nft.setSaleStatus(0, true);

      const cost = (costPerUnitPublic * amount).toFixed(3);
      await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });
      await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });
      await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      const stageId = 1;
      const enabled = true;
      const carrotTypeId = 0;
      const carrotAmountRequiredPerEvolution = 5;

      await nft.setEvolutionPlans(
        stageId,
        enabled,
        carrotTypeId,
        carrotAmountRequiredPerEvolution,
      );

      const tokenIds = [2, 1, 3, 0];
      const tx = await nft
        .connect(addr1)
        .evolveHoppiMany(stageId, tokenIds, [0, 0, 0, 0], [5, 5, 5, 2]);

      let receipt = await tx.wait();

      const hoppiEvolvedMany = receipt.events?.filter((x) => {
        return x.event == "HoppiEvolvedMany";
      });

      console.log("hoppiEvolvedMany", hoppiEvolvedMany[0].args.tokenIds);
      console.log(
        "hoppiEvolvedMany",
        hoppiEvolvedMany[0].args.stage.toNumber(),
      );

      expect(
        (await nft.hoppiStats(tokenIds[0])).totalAmountOfCarrotsEaten,
      ).to.be.equal(5);

      expect(
        (await nft.hoppiStats(tokenIds[1])).totalAmountOfCarrotsEaten,
      ).to.be.equal(5);

      expect(
        (await nft.hoppiStats(tokenIds[2])).totalAmountOfCarrotsEaten,
      ).to.be.equal(5);

      expect(
        (await nft.hoppiStats(tokenIds[3])).totalAmountOfCarrotsEaten,
      ).to.be.equal(5);
    });
  });
});
