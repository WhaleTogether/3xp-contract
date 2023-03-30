const { ethers, upgrades } = require("hardhat");
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

describe("Hoppi Contract Transfer", () => {
  let NFT;
  let nft;

  let privateSaleSignature;
  let devMultisig;

  const EXCLUSIVE_SALE_ID = 1;

  const hoppi = networkConfig["default"][CONTRACTS.hoppi];
  const costPerUnitExclusive = 0.1;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, addr4, _] = await ethers.getSigners();
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

    privateSaleSignature = await addr4.signMessage(
      hashWhitelistAccount(addr1.address, EXCLUSIVE_SALE_ID),
    );
  });

  describe("Transfer NFT", () => {
    it("Transfer NFT from addr1 -> addr2 addr1 should not have it anymore addr2 should have it", async () => {
      await nft.setSaleStatus(0, true);
      const amount = 1;
      const cost = (costPerUnitExclusive * amount).toFixed(3);

      const tx = await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      expect(tx).to.be.an("object");
      let receipt = await tx.wait();

      const totalSupplyCount = await nft.totalSupply();
      const totalBalance = await nft.balanceOf(addr1.address);

      expect(totalSupplyCount).to.equal(totalBalance);

      const nft1 = 0;
      const owner = await nft.connect(addr1).ownerOf(nft1);
      expect(owner).to.equal(addr1.address);

      const ownerAddress = await nft.connect(addr1).ownerOf(nft1);
      expect(ownerAddress).to.equal(addr1.address);

      const from = addr1.address;
      const to = addr2.address;

      await nft
        .connect(addr1)
        ["safeTransferFrom(address,address,uint256)"](from, to, nft1);

      const ownerAddressNft1 = await nft.connect(addr1).ownerOf(nft1);
      expect(ownerAddressNft1).to.be.equal(addr2.address);

      await nft.connect(addr2).transferFrom(addr2.address, addr1.address, nft1);

      const ownerAddressNft2 = await nft.connect(addr1).ownerOf(nft1);
      expect(ownerAddressNft2).to.be.equal(addr1.address);

      const tokensOwnedByAddr2 = await nft.balanceOf(addr2.address);

      const ownedTokenIds = await nft.tokensOfOwner(addr1.address);

      expect(tokensOwnedByAddr2).to.be.equal(0);
    });

    it("Transfer NFT from addr1 -> addr2 tokenId 1 walletOfOwner addr2 should have only tokenId 1", async () => {
      await nft.setSaleStatus(0, true);
      const amount = 1;
      const cost = (costPerUnitExclusive * amount).toFixed(3);

      const tx = await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      expect(tx).to.be.an("object");
      let receipt = await tx.wait();

      const totalSupplyCount = await nft.totalSupply();
      const totalBalance = await nft.balanceOf(addr1.address);

      expect(totalSupplyCount).to.equal(totalBalance);

      const nft1 = 0;
      const owner = await nft.connect(addr1).ownerOf(nft1);
      expect(owner).to.equal(addr1.address);

      const ownerAddress = await nft.connect(addr1).ownerOf(nft1);
      expect(ownerAddress).to.equal(addr1.address);

      const from = addr1.address;
      const to = addr2.address;

      await nft.connect(addr1).transferFrom(from, to, nft1);

      const ownerAddressNft2 = await nft.connect(addr1).ownerOf(nft1);
      expect(ownerAddressNft2).to.be.equal(addr2.address);

      const tokensOwnedByAddr2 = await nft.balanceOf(addr2.address);

      const ownedTokenIds = await nft.tokensOfOwner(addr2.address);

      ownedTokenIds.map((tokenId) => {
        expect(tokenId).to.be.equal(nft1);
      });

      expect(tokensOwnedByAddr2).to.be.equal(1);
    });

    it("check tokens of owner", async () => {
      await nft.setSaleStatus(0, true);
      const amount = 1;
      const cost = (costPerUnitExclusive * amount).toFixed(3);

      await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });
      await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });
      await nft.connect(addr2).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });
      await nft.connect(addr2).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });
      await nft.connect(addr3).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });
      await nft.connect(addr1).publicMint(amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      const addr1OwnedTokenIds = await nft.tokensOfOwner(addr1.address);
      const addr2OwnedTokenIds = await nft.tokensOfOwner(addr2.address);
      const addr3OwnedTokenIds = await nft.tokensOfOwner(addr3.address);

      expect(addr1OwnedTokenIds.length).to.be.equal(3);
      expect(addr2OwnedTokenIds.length).to.be.equal(2);
      expect(addr3OwnedTokenIds.length).to.be.equal(1);

      const tokenIdsOwnedByAddr1 = [0, 1, 5];
      const tokenIdsOwnedByAddr2 = [2, 3];
      const tokenIdsOwnedByAddr3 = [4];
      addr1OwnedTokenIds.map((tokenId, index) => {
        expect(tokenId).to.be.equal(tokenIdsOwnedByAddr1[index]);
      });
      addr2OwnedTokenIds.map((tokenId, index) => {
        expect(tokenId).to.be.equal(tokenIdsOwnedByAddr2[index]);
      });
      addr3OwnedTokenIds.map((tokenId, index) => {
        expect(tokenId).to.be.equal(tokenIdsOwnedByAddr3[index]);
      });
    });
  });
});
