const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { CONTRACTS } = require("../utils/helper-hardhat-config");

describe.only("3XP Sale Contract", () => {
  let NFT;
  let nft;
  let devMultisig;

  const costPerUnitPublic = 0.05;
  const royalty = 770;
  const typeId = 0;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, _] = await ethers.getSigners();
    provider = ethers.provider;

    devMultisig = addr3.address;

    NFT = await ethers.getContractFactory(CONTRACTS.threeXp);
    nft = await upgrades.deployProxy(
      NFT,
      [
        devMultisig, // devMultisig
      ],
      {
        initializer: "initialize",
      },
    );
    await nft.deployed();

    ({ chainId } = await ethers.provider.getNetwork());

    await nft.addProject(
      "MM456YY",
      "3xp.art/metatadata",
      addr1.address,
      2000000000000000,
      // 20000000000000000,
      100,
    );
  });

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      expect(await nft.owner()).to.equal(owner.address);
    });
  });

  describe("Mint Public", () => {
    it("PublicMint should fail -> NOT Invalid typeId", async () => {
      try {
        const project0 = await nft.projectDetails(0);
        const project1 = await nft.projectDetails(1);

        console.log(project0);
        console.log(project1);
        // const amount = 1;
        // const cost = (costPerUnitPublic * amount).toFixed(3);
        // const tx = await nft.connect(addr1).publicMint(123123, amount, {
        //   value: ethers.utils.parseEther(cost.toString()),
        // });
      } catch (error) {
        expect(error.message).to.contain("Invalid Carrot Type");
      }
    });

    it("PublicMint should fail -> NOT Active", async () => {
      try {
        const amount = 1;
        const cost = (costPerUnitPublic * amount).toFixed(3);
        const tx = await nft.connect(addr1).publicMint(typeId, amount, {
          value: ethers.utils.parseEther(cost.toString()),
        });
      } catch (error) {
        expect(error.message).to.contain("Sale not enabled");
      }
    });

    it("PublicMint should fail -> More than MAX_PER_PURCHASE", async () => {
      try {
        await nft.setPublicSaleStatus(typeId, true);
        const amount = 6; // Max per purchase is 5
        const cost = (costPerUnitPublic * amount).toFixed(3);
        const tx = await nft.connect(addr1).publicMint(typeId, amount, {
          value: ethers.utils.parseEther(cost.toString()),
        });
      } catch (error) {
        expect(error.message).to.contain("Exceeds max per transaction");
      }
    });

    it("PublicMint should ALL PASS", async () => {
      await nft.setPublicSaleStatus(typeId, true);
      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });
      expect(tx).to.be.an("object");

      let receipt = await tx.wait();

      const nftMinted = receipt.events?.filter((x) => {
        return x.event == "NFTMinted";
      });
      expect(nftMinted).to.length(1);

      const balanceOwned = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwned).to.equal(amount);
    });
  });

  describe("DevMint Reserve NFTs", () => {
    it("DevMint Reserve NFTs", async () => {
      const amount = 50;

      const DEV_RESERVE_BEFORE = (await nft.mintInfo(typeId)).devReserveAmounts;
      expect(DEV_RESERVE_BEFORE).to.be.equal(1000);
      await nft.connect(owner).devMint([typeId], [amount]);
      await nft.connect(owner).devMint([typeId], [amount]);
      await nft.connect(owner).devMint([typeId], [amount]);
      await nft.connect(owner).devMint([typeId], [amount]);

      const DEV_RESERVE_AFTER = (await nft.mintInfo(typeId)).devReserveAmounts;
      expect(DEV_RESERVE_AFTER).to.be.equal(800);

      const totalSupplyCount = await nft.totalSupply(typeId);
      const totalBalance = await nft.balanceOf(devMultisig, typeId);
      expect(totalSupplyCount).to.equal(200);
      expect(totalBalance).to.equal(200);
    });
    it("DevMint should fail not owner", async () => {
      try {
        const amount = 50;
        await nft.connect(addr1).devMint([typeId], [amount]);
      } catch (error) {
        expect(error.message).to.contain("Ownable: caller is not the owner");
      }
    });
  });

  describe("Mint more than supply", () => {
    it("PublicMint more than supply should fail", async () => {
      await nft.setPublicSaleStatus(typeId, true);

      expect(
        (await nft.connect(addr1).mintInfo(typeId)).maxSupplyAmounts,
      ).to.be.equal(100000);

      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      await nft.updateMaxSupply(typeId, 9);

      expect(
        (await nft.connect(addr1).mintInfo(typeId)).maxSupplyAmounts,
      ).to.be.equal(9);

      try {
        await nft.connect(addr1).publicMint(typeId, amount, {
          value: ethers.utils.parseEther(cost.toString()),
        });
      } catch (error) {
        expect(error.message).to.contain("Exceeds max supply");
      }

      expect(await nft.connect(addr1).totalSupply(typeId)).to.be.equal(5);
    });
  });
});
