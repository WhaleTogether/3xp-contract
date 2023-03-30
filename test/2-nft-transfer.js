const { expect } = require("chai");
const { CONTRACTS } = require("../utils/helper-hardhat-config");

const costPerUnitPublic = 0.05;
const royalty = 770;
const typeId = 0;

describe("NFT Contract Transfer", () => {
  let NFT;
  let nft;

  let provider;
  let devMultisig;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, _] = await ethers.getSigners();
    provider = ethers.provider;

    devMultisig = addr3.address;

    const publicSaleConfig = {
      maxPerTransaction: 5,
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

  describe("Transfer NFT", () => {
    it("Transfer NFT from addr1 -> addr2 addr1 should have 1 left and addr2 should have 1 now", async () => {
      await nft.setPublicSaleStatus(typeId, true);
      const amount = 2;
      const cost = (costPerUnitPublic * amount).toFixed(3);

      const tx = await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      expect(tx).to.be.an("object");
      let receipt = await tx.wait();

      const totalSupplyCount = await nft.totalSupply(typeId);
      const totalBalance = await nft.balanceOf(addr1.address, typeId);

      expect(totalSupplyCount).to.equal(totalBalance);

      const nftMinted = receipt.events?.filter((x) => {
        return x.event == "NFTMinted";
      });
      expect(nftMinted).to.length(1);

      const from = addr1.address;
      const to = addr2.address;

      await nft.connect(addr1).safeTransferFrom(from, to, typeId, 1, "0x");

      const address1OwnedBalance = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(address1OwnedBalance).to.be.equal(1);

      const address2OwnedBalance = await nft
        .connect(addr1)
        .balanceOf(addr2.address, typeId);
      expect(address2OwnedBalance).to.be.equal(1);
    });
  });
});
