const { expect } = require("chai");
const { CONTRACTS } = require("../utils/helper-hardhat-config");

const costPerUnitPublic = 0.05;
const royalty = 770;
const typeId = 0;

describe("Dev Wallet Contract", () => {
  let NFT;
  let nft;

  let provider;
  let devMultisig;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, addr4, _] = await ethers.getSigners();
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

    MoonToken = await ethers.getContractFactory("MoonToken");
    moonToken = await MoonToken.deploy(nft.address, addr2.address);
  });

  describe("Multisig Dev Wallet", () => {
    it("Withdraw to Multisig Dev Wallet should fail -> no ETH left", async () => {
      try {
        await nft.connect(addr3).withdrawETHBalanceToDev();
      } catch (error) {
        expect(error.message).to.contain("No ETH left");
      }
    });

    it("Get paid to contract and withdraw to Multisig Dev Wallet", async () => {
      await nft.setPublicSaleStatus(typeId, true);

      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(2);

      const tx = await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      expect(tx).to.be.an("object");

      const totalSupplyCount = await nft.totalSupply(typeId);
      const totalBalance = await nft.balanceOf(addr1.address, typeId);

      expect(totalSupplyCount).to.equal(amount);
      expect(totalBalance).to.equal(amount);

      let receipt = await tx.wait();

      const nftMinted = receipt.events?.filter((x) => {
        return x.event == "NFTMinted";
      });
      expect(nftMinted).to.length(1);

      const balanceOwned = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(balanceOwned).to.equal(amount);

      const nftETHBalance = await provider.getBalance(nft.address);

      expect(ethers.utils.formatEther(nftETHBalance)).to.be.equal(
        cost.toString(),
      );

      await nft.connect(addr3).withdrawETHBalanceToDev();
      const nftETHBalanceAFTER = await provider.getBalance(nft.address);

      expect(ethers.utils.formatEther(nftETHBalanceAFTER)).to.be.equal("0.0");

      const devMultisigETHBalance = await provider.getBalance(devMultisig);

      expect(ethers.utils.formatEther(devMultisigETHBalance)).to.be.equal(
        "10000.249900743970727642",
        // cost.toString(),
      );
    });

    it("set New Multisig Dev Wallet and withdraw to NEW Multisig Dev Wallet", async () => {
      const tx = await nft.connect(addr3).setDevMultiSigAddress(addr4.address);
      expect(tx).to.be.an("object");

      await nft.setPublicSaleStatus(typeId, true);

      const amount = 5;
      const cost = (costPerUnitPublic * amount).toFixed(2);

      await nft.connect(addr1).publicMint(typeId, amount, {
        value: ethers.utils.parseEther(cost.toString()),
      });

      const nftETHBalance = await provider.getBalance(nft.address);

      expect(ethers.utils.formatEther(nftETHBalance)).to.be.equal(
        cost.toString(),
      );

      await nft.connect(addr4).withdrawETHBalanceToDev();
      const nftETHBalanceAFTER = await provider.getBalance(nft.address);

      expect(ethers.utils.formatEther(nftETHBalanceAFTER)).to.be.equal("0.0");

      const devMultisigETHBalance = await provider.getBalance(addr4.address);

      expect(ethers.utils.formatEther(devMultisigETHBalance)).to.be.equal(
        "10000.249954884987187003",
      );
    });

    it("withdraw token to Multisig Dev Wallet should fail -> no fund left", async () => {
      try {
        await nft.connect(addr3).withdrawTokensToDev(moonToken.address);
      } catch (error) {
        expect(error.message).to.contain("No token left");
      }
    });

    it("withdraw token to Multisig Dev Wallet should PASS", async () => {
      await moonToken.connect(addr2).setAllowedAddresses(owner.address, true);
      const totalTokenToMint = ethers.utils.parseEther("5000");
      await moonToken.claimLaboratoryExperimentRewards(
        nft.address,
        totalTokenToMint,
      );

      await nft.connect(addr3).withdrawTokensToDev(moonToken.address);

      const devMultisigTokenBalance = await moonToken.balanceOf(devMultisig);
      expect(devMultisigTokenBalance).to.be.equal(totalTokenToMint.toString());
    });
  });
});
