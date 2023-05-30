const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { CONTRACTS } = require("../utils/helper-hardhat-config");

const hashWhitelistAccount = (projectId, saleId, account, type) => {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(
        ["uint256", "uint256", "address", "uint256"],
        [projectId, saleId, account, type],
      )
      .slice(2),
    "hex",
  );
};

describe("NFT Sale Contract", () => {
  let NFT;
  let devMultisig;
  let artistAddress;
  let devAddress;
  let signature;

  const CurrencyType = {
    ETH: 0,
    ERC20: 1,
    ERC1155: 2,
  };

  const royalty = 770;

  const maxSupply = 1000;
  const devReserve = 30;
  const artistReserve = 60;
  const projectId = 1;
  const saleId = 1;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, addr4, addr5, addr6, _] =
      await ethers.getSigners();
    provider = ethers.provider;

    devMultisig = addr3.address;
    artistAddress = addr4.address;

    devAddress = addr5.address;

    NFTSale = await ethers.getContractFactory(CONTRACTS.nftSale);
    nftSale = await upgrades.deployProxy(
      NFTSale,
      [
        devMultisig, // devMultisig
      ],
      {
        initializer: "initialize",
      },
    );
    await nftSale.deployed();

    // create nft contract
    NFT = await ethers.getContractFactory(CONTRACTS.nft);
    nftFactory = await NFT.deploy(
      "MM456YY_name",
      "MM456YY",
      "https://something.com/metatadata",
      devMultisig,
      royalty,
    );

    await nftFactory.addMinter(nftSale.address);

    await nftSale.addProject(
      nftFactory.address,
      artistAddress,
      maxSupply,
      devReserve,
      artistReserve,
    );

    const maxPerTransaction = 5;
    const erc20Address = ethers.constants.AddressZero;
    const erc1155Address = ethers.constants.AddressZero;
    const unitPriceInEth = ethers.utils.parseEther("0.1");
    const unitPriceInErc20 = 0;
    const unitPriceInErc1155 = 0;
    const erc1155Id = 0;

    await nftSale.setPublicSaleConfig(
      projectId,
      maxPerTransaction,
      erc20Address,
      erc1155Address,
      unitPriceInEth,
      unitPriceInErc20,
      unitPriceInErc1155,
      erc1155Id,
    );

    const signerAddress = addr6.address;
    const maxSupplyPerRound = 10;

    await nftSale.setSaleConfig(
      projectId,
      saleId,
      2, // maxPerTransaction
      signerAddress,
      maxSupplyPerRound,
      erc20Address,
      erc1155Address,
      ethers.utils.parseEther("0.15"),
      unitPriceInErc20,
      unitPriceInErc1155,
      erc1155Id,
    );

    signature = await addr6.signMessage(
      hashWhitelistAccount(projectId, saleId, addr1.address, 1),
    );
  });

  describe("privateMint", function () {
    it("Mint Private should fail -> NOT Active", async () => {
      try {
        const amount = 1;
        const cost = 0.15 * amount;

        const tx = await nftSale
          .connect(addr1)
          .privateMint(projectId, saleId, amount, CurrencyType.ETH, signature, {
            value: ethers.utils.parseEther(cost.toString()),
          });
      } catch (error) {
        expect(error.message).to.contain("SaleNotEnabled");
      }
    });

    it("Mint Pre should fail -> More than their max token purchase", async () => {
      try {
        await nftSale.setSaleStatus(projectId, saleId, true);
        const amount = 3; // Max per purchase is 2
        const cost = 0.15 * amount;
        const tx = await nftSale
          .connect(addr1)
          .privateMint(projectId, saleId, amount, CurrencyType.ETH, signature, {
            value: ethers.utils.parseEther(cost.toString()),
          });
      } catch (error) {
        expect(error.message).to.contain("ExceedsMaxPerTransaction");
      }
    });

    it("Mint Pre should fail -> when try to mint more on the second transaction", async () => {
      await nftSale.setSaleStatus(projectId, saleId, true);
      const amount = 2;
      const cost = (0.15 * amount).toFixed(3);

      const signature = await addr6.signMessage(
        hashWhitelistAccount(projectId, saleId, addr1.address, amount),
      );

      const tx = await nftSale
        .connect(addr1)
        .privateMint(projectId, saleId, amount, CurrencyType.ETH, signature, {
          value: ethers.utils.parseEther(cost.toString()),
        });

      await expect(
        nftSale
          .connect(addr1)
          .privateMint(projectId, saleId, amount, CurrencyType.ETH, signature, {
            value: ethers.utils.parseEther(cost.toString()),
          }),
      ).to.be.revertedWith("InvalidMintAmount");
    });

    it("Mint Pre should fail -> Invalid signature", async () => {
      await nftSale.setSaleStatus(projectId, saleId, true);
      const amount = 2;
      const cost = 0.15 * amount;

      const wrongSignature =
        "0x2626038312321008e1a40bbd29d836e084de950766bb04700c7d7800b6907ebb3df51e0fdf49e323aa4054ea8e3f4b35aeecba1b3f6564ff0893d1c8aff814231b";
      await expect(
        nftSale
          .connect(addr1)
          .privateMint(
            projectId,
            saleId,
            amount,
            CurrencyType.ETH,
            wrongSignature,
            {
              value: ethers.utils.parseEther(cost.toString()),
            },
          ),
      ).to.be.revertedWith("InvalidSig");
    });

    it("Mint Pre should fail -> LESS Supply", async () => {
      await nftSale.setSaleStatus(projectId, saleId, true);

      await nftSale.updateMaxSupply(projectId, 1);

      const amount = 2;
      const cost = (0.15 * amount).toFixed(3);

      const signature = await addr6.signMessage(
        hashWhitelistAccount(projectId, saleId, addr1.address, amount),
      );

      await expect(
        nftSale
          .connect(addr1)
          .privateMint(projectId, saleId, amount, CurrencyType.ETH, signature, {
            value: ethers.utils.parseEther(cost.toString()),
          }),
      ).to.be.revertedWith("ExceedMaxSupply");
    });

    it("Mint Pre should fail -> send lower ETH than 0.077 price -> Not enough ETH", async () => {
      await nftSale.setSaleStatus(projectId, saleId, true);

      const amount = 1;
      const cost = 0.076;

      await expect(
        nftSale
          .connect(addr1)
          .privateMint(projectId, saleId, amount, CurrencyType.ETH, signature, {
            value: ethers.utils.parseEther(cost.toString()),
          }),
      ).to.be.revertedWith("InsufficientFunds");
    });

    it("Mint Pre pass 0 ETH should fail -> Not enough ETH ", async () => {
      await nftSale.setSaleStatus(projectId, saleId, true);

      const amount = 1;
      const cost = 0;

      await expect(
        nftSale
          .connect(addr1)
          .privateMint(projectId, saleId, amount, CurrencyType.ETH, signature, {
            value: ethers.utils.parseEther(cost.toString()),
          }),
      ).to.be.revertedWith("InsufficientFunds");
    });

    it("Mint Pre should fail -> cost = null -> Not enough ETH", async () => {
      await nftSale.setSaleStatus(projectId, saleId, true);

      const amount = 1;

      await expect(
        nftSale
          .connect(addr1)
          .privateMint(projectId, saleId, amount, CurrencyType.ETH, signature, {
            value: null,
          }),
      ).to.be.revertedWith("InsufficientFunds");
    });

    it("Mint Pre should ALL PASS", async () => {
      await nftSale.setSaleStatus(projectId, saleId, true);

      const amount = 2;
      const cost = (0.15 * amount).toFixed(3);

      const signature = await addr6.signMessage(
        hashWhitelistAccount(projectId, saleId, addr1.address, amount),
      );

      const tx = await nftSale
        .connect(addr1)
        .privateMint(projectId, saleId, amount, CurrencyType.ETH, signature, {
          value: ethers.utils.parseEther(cost.toString()),
        });

      expect(tx).to.be.an("object");

      const totalSupply = await nftFactory.totalSupply();

      expect(totalSupply).to.equal(amount);

      await tx.wait();

      for (let i = 0; i < amount; i++) {
        const owner = await nftFactory.connect(addr1).ownerOf(i);
        expect(owner).to.equal(addr1.address);
      }
    });
  });

  describe("PublicMint", () => {
    it("Mint Public should fail -> NOT Active", async () => {
      const amount = 1;
      const cost = (0.1 * amount).toFixed(3);

      await expect(
        nftSale
          .connect(addr1)
          .publicMint(
            projectId,
            amount,
            CurrencyType.ETH,
            ethers.constants.AddressZero,
            {
              value: ethers.utils.parseEther(cost.toString()),
            },
          ),
      ).to.be.revertedWith("SaleNotEnabled");
    });

    it("Mint Regular should fail -> ExceedsMaxPerTransaction", async () => {
      await nftSale.setSaleStatus(projectId, 0, true);
      const amount = 6; // Max per purchase is 5
      const cost = (0.1 * amount).toFixed(3);
      await expect(
        nftSale
          .connect(addr1)
          .publicMint(
            projectId,
            amount,
            CurrencyType.ETH,
            ethers.constants.AddressZero,
            {
              value: ethers.utils.parseEther(cost.toString()),
            },
          ),
      ).to.be.revertedWith("ExceedsMaxPerTransaction");
    });

    it("Mint Regular should ALL PASS", async () => {
      await nftSale.setSaleStatus(projectId, 0, true);
      const amount = 2;
      const cost = (0.1 * amount).toFixed(3);
      const tx = await nftSale
        .connect(addr1)
        .publicMint(
          projectId,
          amount,
          CurrencyType.ETH,
          ethers.constants.AddressZero,
          {
            value: ethers.utils.parseEther(cost.toString()),
          },
        );
      expect(tx).to.be.an("object");

      const totalSupply = await nftFactory.totalSupply();
      expect(totalSupply).to.equal(amount);

      await tx.wait();

      for (let i = 0; i < amount; i++) {
        const owner = await nftFactory.connect(addr1).ownerOf(i);
        expect(owner).to.equal(addr1.address);
      }
    });
  });
});
