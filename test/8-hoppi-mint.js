const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { networkConfig, CONTRACTS } = require("../utils/helper-hardhat-config");

describe("Hoppi Contract", () => {
  let NFT;
  let nft;
  let devMultisig;

  const hoppi = networkConfig["default"][CONTRACTS.hoppi];
  const costPerUnitPublic = 0.1;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, _] = await ethers.getSigners();
    provider = ethers.provider;

    devMultisig = addr3.address;

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
        hoppi.exclusiveSaleConfig,
        hoppi.adoptionPlan,
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

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      expect(await nft.owner()).to.equal(owner.address);
    });
  });

  describe("Mint Public", () => {
    it("PublicMint should fail -> NOT Active", async () => {
      const amount = 1;
      const cost = (costPerUnitPublic * amount).toFixed(3);

      await expect(
        nft.connect(addr1).publicMint(amount, {
          value: ethers.utils.parseEther(cost.toString()),
        }),
      ).to.be.revertedWith("Hoppi__SaleNotEnabled");
    });

    it("PublicMint should fail -> More than MAX_PER_PURCHASE", async () => {
      await nft.setSaleStatus(0, true);
      const amount = 6; // Max per purchase is 5
      const cost = (costPerUnitPublic * amount).toFixed(3);

      await expect(
        nft.connect(addr1).publicMint(amount, {
          value: ethers.utils.parseEther(cost.toString()),
        }),
      ).to.be.revertedWith("Hoppi__ExceedsMaxPerTransaction");
    });

    it("PublicMint should ALL PASS", async () => {
      await nft.setSaleStatus(0, true);

      expect((await nft.adoptionPlan()).fcfsSupply).to.be.equal(650);

      const amount = 1;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });
      expect(tx).to.be.an("object");

      const balanceOwned = await nft.connect(addr1).balanceOf(addr1.address);
      expect(balanceOwned).to.equal(amount);

      expect((await nft.adoptionPlan()).fcfsSupply).to.be.equal(649);
    });

    it("PublicMint should fail -> over fcfs supply", async () => {
      await nft.setSaleStatus(0, true);

      expect((await nft.adoptionPlan()).fcfsSupply).to.be.equal(650);
      await nft.setAdoptionPlan(false, 1000, 50, 2, 3, 1);
      expect((await nft.adoptionPlan()).fcfsSupply).to.be.equal(2);

      const amount = 1;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });
      expect(tx).to.be.an("object");

      const balanceOwned = await nft.connect(addr1).balanceOf(addr1.address);
      expect(balanceOwned).to.equal(amount);

      expect((await nft.adoptionPlan()).fcfsSupply).to.be.equal(1);

      await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      expect((await nft.adoptionPlan()).fcfsSupply).to.be.equal(0);

      expect(
        nft.connect(addr1).publicMint(amount, {
          value: ethers.utils.parseEther(cost.toString()),
        }),
      ).to.be.revertedWith("Hoppi__ExceedsFCFSSupply");
    });
  });

  describe("DevMint Reserve NFTs", () => {
    it("DevMint Reserve NFTs", async () => {
      const amount = 2;

      const DEV_RESERVE_BEFORE = (await nft.adoptionPlan()).devReserve;
      expect(DEV_RESERVE_BEFORE).to.be.equal(50);
      await nft.connect(owner).devMintTo(amount, devMultisig);

      const DEV_RESERVE_AFTER = (await nft.adoptionPlan()).devReserve;
      expect(DEV_RESERVE_AFTER).to.be.equal(48);

      const totalSupplyCount = await nft.totalSupply();
      const totalBalance = await nft.balanceOf(devMultisig);
      expect(totalSupplyCount).to.equal(2);
      expect(totalBalance).to.equal(2);
    });

    it("DevMint should fail not owner", async () => {
      try {
        const amount = 4;
        await nft.connect(addr1).devMintTo(amount, devMultisig);
      } catch (error) {
        expect(error.message).to.contain("Ownable: caller is not the owner");
      }
    });
  });

  describe("Mint more than supply", () => {
    it("PublicMint more than supply should fail", async () => {
      await nft.setSaleStatus(0, true);

      expect((await nft.connect(addr1).adoptionPlan()).maxSupply).to.be.equal(
        1000,
      );

      const amount = 1;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      expect(await nft.connect(addr1).totalSupply()).to.be.equal(1);

      await nft.setNewSupply(1);

      expect((await nft.connect(addr1).adoptionPlan()).maxSupply).to.be.equal(
        1,
      );

      await expect(
        nft.connect(addr1).publicMint(amount, {
          value: ethers.utils.parseEther(cost.toString()),
        }),
      ).to.be.revertedWith("Hoppi__ExceedMaxSupply");

      expect(await nft.connect(addr1).totalSupply()).to.be.equal(1);
    });
  });
});
