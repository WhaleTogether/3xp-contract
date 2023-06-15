const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { CONTRACTS } = require("../utils/helper-hardhat-config");

describe("NFT Sale Contract", () => {
  let NFT;
  let devMultisig;
  let artistAddress;
  let devAddress;

  const costPerUnitPublic = 0.05;
  const royalty = 770;

  const maxSupply = 1000;
  const devReserve = 30;
  const artistReserve = 60;

  const projectId = 1;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, addr4, addr5, _] = await ethers.getSigners();
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
  });

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      expect(await nftSale.owner()).to.equal(owner.address);
      expect(await nftFactory.owner()).to.equal(owner.address);
    });
  });

  // Test case 1: Test addProject function
  it("should add a new project", async () => {
    // Add a new project
    await nftSale.addProject(
      nftFactory.address,
      artistAddress,
      maxSupply,
      devReserve,
      artistReserve,
      0,
    );

    // Retrieve the project details
    const projectDetails = await nftSale.projectDetails(projectId);

    // Verify the project details
    expect(projectDetails.projectName).to.equal("MM456YY_name");
    expect(projectDetails.contractAddress).to.equal(nftFactory.address);
    expect(await nftSale.projectIdToArtistAddress(projectId)).to.equal(
      artistAddress,
    );
    expect(projectDetails.totalSupply).to.equal(0);
    expect(projectDetails.maxSupply).to.equal(maxSupply);
    expect(projectDetails.devReserve).to.equal(devReserve);
    expect(projectDetails.artistReserve).to.equal(artistReserve);
  });

  // Test case 2: Test updateProjectContractAddress function
  it("should update the project contract address", async () => {
    // Add a new project
    await nftSale.addProject(
      nftFactory.address,
      artistAddress,
      maxSupply,
      devReserve,
      artistReserve,
      0,
    );

    nftFactory2 = await NFT.deploy(
      "MM456YY_name2",
      "MM456YY2",
      "https://something.com/metatadata",
      devMultisig,
      royalty,
    );

    newContractAddress = nftFactory2.address;

    // Update the project contract address
    await nftSale.updateProjectContractAddress(projectId, newContractAddress);

    // Retrieve the updated project details
    const projectDetails = await nftSale.projectDetails(projectId);

    // Verify the updated project contract address
    expect(projectDetails.contractAddress).to.equal(newContractAddress);
  });

  // Test case 3: Test updateProjectArtistName function
  it("should update the project artist name", async () => {
    // Add a new project
    await nftSale.addProject(
      nftFactory.address,
      artistAddress,
      maxSupply,
      devReserve,
      artistReserve,
      0,
    );

    // Update the project artist name
    await nftSale.updateProjectArtistName(projectId, "New Artist Name");

    // Retrieve the updated project details
    const projectDetails = await nftSale.projectDetails(projectId);

    // Verify the updated project artist name
    expect(projectDetails.artist).to.equal("New Artist Name");
  });

  // Test case 5: Test toggleProjectIsLocked function
  it("should toggle the project locked status", async () => {
    // Add a new project
    await nftSale.addProject(
      nftFactory.address,
      artistAddress,
      maxSupply,
      devReserve,
      artistReserve,
      0,
    );

    // Verify the initial project locked status
    expect((await nftSale.projects(projectId)).locked).to.be.false;

    // Toggle the project locked status
    await nftSale.toggleProjectIsLocked(projectId);

    // Verify the updated project locked status
    expect((await nftSale.projects(projectId)).locked).to.be.true;
  });

  // Test case 7: Test addDev function
  it("should add a new dev", async () => {
    // Add a new dev
    await nftSale.addDev(devAddress);

    // Verify the dev status
    expect(await nftSale.isDev(devAddress)).to.be.true;
  });

  // Test case 8: Test removeDev function
  it("should remove an existing dev", async () => {
    // Add a new dev
    await nftSale.addDev(devAddress);

    // Verify the dev status
    expect(await nftSale.isDev(devAddress)).to.be.true;

    // Remove the dev
    await nftSale.removeDev(devAddress);

    // Verify the updated dev status
    expect(await nftSale.isDev(devAddress)).to.be.false;
  });

  // Test case 9: Test setDevMultiSigAddress function
  it("should set the devMultiSigWallet address", async () => {
    const newDevMultiSigWallet = addr5.address;
    // Set the devMultiSigWallet address
    await nftSale.setDevMultiSigAddress(newDevMultiSigWallet);
  });

  // Test case 10: Test withdrawETHBalanceToDev function
  it("should withdraw the ETH balance to the devMultiSigWallet", async () => {
    // Send some ETH to the NFTSale contract
    const tx = {
      to: nftSale.address,
      // Convert currency unit from ether to wei
      value: ethers.utils.parseEther("1.0"),
    };

    await addr1.sendTransaction(tx);

    // Get the initial ETH balance of the devMultiSigWallet
    const initialBalance = await ethers.provider.getBalance(devMultisig);

    // Withdraw the ETH balance to the devMultiSigWallet
    await nftSale.withdrawETHBalanceToDev();

    // Get the updated ETH balance of the devMultiSigWallet
    const updatedBalance = await ethers.provider.getBalance(devMultisig);

    // Verify the ETH transfer
    expect(updatedBalance).to.be.gt(initialBalance);
  });

  // Test case 11: Test projectDetails function
  it("should return the project details", async () => {
    // Add a new project
    await nftSale.addProject(
      nftFactory.address,
      artistAddress,
      maxSupply,
      devReserve,
      artistReserve,
      0,
    );

    await nftSale.updateProjectDescription(projectId, "Project Description");

    // Get the project details
    const projectDetails = await nftSale.projectDetails(projectId);

    // Verify the project details
    expect(projectDetails.contractAddress).to.equal(nftFactory.address);
    expect(await nftSale.projectIdToArtistAddress(projectId)).to.equal(
      artistAddress,
    );
    expect(projectDetails.projectName).to.equal("MM456YY_name"); // Replace with the actual project name
    expect(projectDetails.description).to.equal("Project Description"); // Replace with the actual project description
    expect(projectDetails.totalSupply).to.equal(0); // Assuming the initial total supply is 0
    expect(projectDetails.maxSupply).to.equal(maxSupply);
    expect(projectDetails.devReserve).to.equal(devReserve);
    expect(projectDetails.artistReserve).to.equal(artistReserve);
  });

  // Test case 12: Test updateProjectContractAddress function
  it("should update the project contract address", async () => {
    // Add a new project
    await nftSale.addProject(
      nftFactory.address,
      artistAddress,
      maxSupply,
      devReserve,
      artistReserve,
      0,
    );

    // Update the project contract address
    await nftSale.updateProjectContractAddress(projectId, newContractAddress);

    // Get the updated project details
    const projectDetails = await nftSale.projectDetails(projectId);

    // Verify the updated project contract address
    expect(projectDetails.contractAddress).to.equal(newContractAddress);
  });
});
