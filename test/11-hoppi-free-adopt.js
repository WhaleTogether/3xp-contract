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

  describe("FCFS Free Mint", () => {
    it("Adoption should fail -> NOT Active", async () => {
      const amount = 1;
      await expect(nft.connect(addr1).adoptHoppi(amount)).to.be.revertedWith(
        "Hoppi__AdoptionNotEnabled",
      );
    });

    // exceed max per wallet
    it("Adoption should fail -> Exceed Max per wallet", async () => {
      const amount = 2;

      await nft.setAdoptionPlan(true, 999, 33, 650, 3, 1);

      await expect(nft.connect(addr1).adoptHoppi(amount)).to.be.revertedWith(
        "Hoppi__ExceedsMaxPerWallet",
      );
    });

    // already adopt
    it("Adoption should fail -> Already Adopted", async () => {
      const amount = 1;

      await nft.setAdoptionPlan(true, 999, 33, 650, 3, 1);
      await nft.connect(addr1).adoptHoppi(amount);
      await expect(nft.connect(addr1).adoptHoppi(amount)).to.be.revertedWith(
        "Hoppi__AlreadyAdopted",
      );
    });

    // not enough carrot
    it("Adoption should fail -> Not Enough Carrot", async () => {
      const amount = 1;

      await nft.setAdoptionPlan(true, 999, 33, 650, 3, 1);

      await carrot.connect(addr1).burnCarrots(typeId, 48);
      await expect(nft.connect(addr1).adoptHoppi(amount)).to.be.revertedWith(
        "Hoppi__NotEnoughCarrots",
      );
    });

    // not exceed Max Supply
    it("Adoption should fail -> Exceed FCFS Max Supply", async () => {
      const amount = 1;

      await nft.setAdoptionPlan(true, 1000, 33, 2, 3, 1);

      await nft.connect(addr1).adoptHoppi(amount);
      await nft.connect(addr2).adoptHoppi(amount);
      await expect(nft.connect(addr3).adoptHoppi(amount)).to.be.revertedWith(
        "Hoppi__ExceedsFCFSSupply",
      );
    });

    it("Adoption should Pass -> update hoppi stats", async () => {
      const amount = 1;

      await nft.setAdoptionPlan(true, 999, 33, 650, 3, 1);
      await nft.connect(addr1).adoptHoppi(amount);
      await nft.connect(addr2).adoptHoppi(amount);
      await nft.connect(addr3).adoptHoppi(amount);

      const tokenId = 0;
      const tokenId1 = 1;
      const tokenId2 = 2;

      expect(
        (await nft.hoppiStats(tokenId)).totalAmountOfCarrotsEaten,
      ).to.be.equal(3);
      expect(
        (await nft.hoppiStats(tokenId1)).totalAmountOfCarrotsEaten,
      ).to.be.equal(3);
      expect(
        (await nft.hoppiStats(tokenId2)).totalAmountOfCarrotsEaten,
      ).to.be.equal(3);
    });
  });
});
