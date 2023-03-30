const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { CONTRACTS } = require("../utils/helper-hardhat-config");

const costPerUnitPublic = 0.05;
const royalty = 770;
const typeId = 0;

const hashAccount = (account, typeId, amount, referralWalletAddress) => {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(
        ["address", "uint256", "uint256", "address"],
        [account, typeId, amount, referralWalletAddress],
      )
      .slice(2),
    "hex",
  );
};

describe("NFT Contract", () => {
  let NFT;
  let nft;
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

  describe("FreeMint", () => {
    it("FreeMint should fail --> not enabled", async () => {
      const amount = 2;
      const freeMintSignature = await owner.signMessage(
        hashAccount(addr1.address, typeId, amount, addr2.address),
      );

      try {
        await nft
          .connect(addr1)
          .freeMint(typeId, amount, addr2.address, freeMintSignature);
      } catch (error) {
        expect(error.message).to.be.contain("FreeMintNotEnabled");
      }
    });

    it("FreeMint with referral should pass", async () => {
      await nft.toggleFreeMintEnabled(typeId);

      const amount = 2;
      const freeMintSignature = await owner.signMessage(
        hashAccount(addr1.address, typeId, amount, addr2.address),
      );

      await nft
        .connect(addr1)
        .freeMint(typeId, amount, addr2.address, freeMintSignature);

      const addr1Balance = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(addr1Balance).to.equal(2);
    });

    it("FreeMint with NO referral should pass", async () => {
      await nft.toggleFreeMintEnabled(typeId);

      const amount = 2;
      const freeMintSignature = await owner.signMessage(
        hashAccount(
          addr1.address,
          typeId,
          amount,
          ethers.constants.AddressZero,
        ),
      );

      await nft
        .connect(addr1)
        .freeMint(
          typeId,
          amount,
          ethers.constants.AddressZero,
          freeMintSignature,
        );

      const addr1Balance = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(addr1Balance).to.equal(2);

      const hoppiLoverMintInfoAfter1 = await nft
        .connect(addr1)
        .hoppiLoverMintInfo(typeId, addr1.address);

      expect(hoppiLoverMintInfoAfter1.bonusMintAmount).to.equal(0);
      expect(hoppiLoverMintInfoAfter1.totalMintedAmount).to.equal(2);
    });

    it("FreeMint should fail -> Invalid signature", async () => {
      await nft.toggleFreeMintEnabled(typeId);

      try {
        const amount = 2;
        const freeMintSignature = await owner.signMessage(
          hashAccount(addr1.address, typeId, amount, addr2.address),
        );

        await nft
          .connect(addr1)
          .freeMint(typeId, amount, addr3.address, freeMintSignature);
      } catch (error) {
        expect(error.message).to.contain("Invalid signature");
      }
    });

    it("FreeMint should fail -> try to claim twice", async () => {
      await nft.toggleFreeMintEnabled(typeId);

      const amount = 2;
      const freeMintSignature = await owner.signMessage(
        hashAccount(addr1.address, typeId, amount, addr2.address),
      );

      await nft
        .connect(addr1)
        .freeMint(typeId, amount, addr2.address, freeMintSignature);

      const addr1Balance = await nft
        .connect(addr1)
        .balanceOf(addr1.address, typeId);
      expect(addr1Balance).to.equal(2);

      try {
        await nft
          .connect(addr1)
          .freeMint(typeId, amount, addr2.address, freeMintSignature);
      } catch (error) {
        expect(error.message).to.contain("You already claimed your free mint");
      }
    });
  });
});
