const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { CONTRACTS } = require("../utils/helper-hardhat-config");

const costPerUnitPublic = 0.05;
const royalty = 770;
const typeId = 0;

describe.skip("NFT Contract", () => {
  let NFT;
  let nft;
  let devMultisig;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, _] = await ethers.getSigners();
    provider = ethers.provider;

    devMultisig = addr3.address;

    const publicSaleConfig = {
      maxPerTransaction: 10,
      unitPrice: ethers.utils.parseEther(costPerUnitPublic.toString()),
    };

    NFT = await ethers.getContractFactory(CONTRACTS.nft);
    nft = await upgrades.deployProxy(
      NFT,
      [
        "Cilantro", // name
        "CIL", // symbol
        "https://gateway.pinata.cloud/ipfs/Qmego24DURSSuijn1iVwbpiVFQG9WXKnUkiV4SErJmHJAd/", // baseURI
        devMultisig, // devMultisig
        royalty,
        publicSaleConfig,
        owner.address,
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

  describe("Burn on behalf of", () => {
    it("Burn should fail", async () => {
      await nft.setPublicSaleStatus(typeId, true);
      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      await tx.wait();

      const balanceOwned = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwned).to.equal(amount);

      await nft.setHoppiContractAddress(addr2.address);

      try {
        await nft.connect(addr3).feedCarrots(addr1.address, typeId, 1);
      } catch (error) {
        expect(error.message).to.contain("Invalid Hoppi Contract Address");
      }
    });

    it("Burn Batch should fail", async () => {
      await nft.setPublicSaleStatus(typeId, true);
      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      await tx.wait();

      const balanceOwned = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwned).to.equal(amount);

      await nft.setHoppiContractAddress(addr2.address);

      try {
        await nft.connect(addr3).feedCarrotsBatch(addr1.address, [typeId], [1]);
      } catch (error) {
        expect(error.message).to.contain("Invalid Hoppi Contract Address");
      }
    });

    it("Burn should ALL PASS", async () => {
      await nft.setPublicSaleStatus(typeId, true);
      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      await tx.wait();

      const balanceOwned = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwned).to.equal(amount);

      await nft.setHoppiContractAddress(addr2.address);

      await nft.connect(addr2).feedCarrots(addr1.address, typeId, 1);

      const balanceOwnedAfter = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwnedAfter).to.equal(amount - 1);
    });

    it("Burn Batch should ALL PASS", async () => {
      await nft.setPublicSaleStatus(typeId, true);
      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      await tx.wait();

      const balanceOwned = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwned).to.equal(amount);

      await nft.setHoppiContractAddress(addr2.address);

      await nft.connect(addr2).feedCarrotsBatch(addr1.address, [typeId], [1]);

      const balanceOwnedAfter = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwnedAfter).to.equal(amount - 1);
    });
  });
  describe("Burn self", () => {
    it("Burn should fail", async () => {
      await nft.setPublicSaleStatus(typeId, true);
      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      await tx.wait();

      const balanceOwned = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwned).to.equal(amount);

      await nft.setHoppiContractAddress(addr2.address);

      try {
        await nft.connect(addr3).burnCarrots(typeId, 1);
      } catch (error) {
        expect(error.message).to.contain(
          "ERC1155: burn amount exceeds balance",
        );
      }
    });

    it("Burn Batch should fail", async () => {
      await nft.setPublicSaleStatus(typeId, true);
      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      await tx.wait();

      const balanceOwned = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwned).to.equal(amount);

      await nft.setHoppiContractAddress(addr2.address);

      try {
        await nft.connect(addr3).burnCarrotsBatch([typeId], [1]);
      } catch (error) {
        expect(error.message).to.contain(
          "ERC1155: burn amount exceeds balance",
        );
      }
    });

    it("Burn should fail not have enough tokens to burn", async () => {
      await nft.setPublicSaleStatus(typeId, true);
      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      await tx.wait();

      const balanceOwned = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwned).to.equal(amount);

      try {
        await nft.connect(addr1).burnCarrots(typeId, 6);
      } catch (error) {
        expect(error.message).to.contain(
          "ERC1155: burn amount exceeds totalSupply",
        );
      }
    });

    it("Burn should ALL PASS", async () => {
      await nft.setPublicSaleStatus(typeId, true);
      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      await tx.wait();

      const balanceOwned = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwned).to.equal(amount);

      await nft.setHoppiContractAddress(addr2.address);

      await nft.connect(addr1).burnCarrots(typeId, 1);

      const balanceOwnedAfter = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwnedAfter).to.equal(amount - 1);
    });

    it("Burn Batch should ALL PASS", async () => {
      await nft.setPublicSaleStatus(typeId, true);
      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(3);
      const tx = await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      await tx.wait();

      const balanceOwned = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwned).to.equal(amount);

      await nft.setHoppiContractAddress(addr2.address);

      await nft.connect(addr1).burnCarrotsBatch([typeId], [1]);

      const balanceOwnedAfter = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwnedAfter).to.equal(amount - 1);
    });
  });
});
