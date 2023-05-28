// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "hardhat/console.sol";

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import "operator-filter-registry/src/upgradeable/DefaultOperatorFiltererUpgradeable.sol";

error __NFTFactoryNotSet();
error __3XP__SetDevMultiSigToZeroAddress();
error __3XP__InvalidQueryRange();
error __3XP__NotTokenOwner();

error __3XP__NotExists();
error __3XP__NoETHLeft();
error __3XP__SaleNotEnabled();
error __3XP__ETHTransferFailed();
error __3XP__ExceedsMaxPerTransaction();
error __3XP__ETHAmountIsNotSufficient();
error __3XP__ExceedsMaxPerRound();
error __3XP__CallerNotUser();
error __3XP__ExceedMaxSupply();
error __3XP__ExceedsDevReserve();
error __3XP__ExceedsFCFSSupply();
error __3XP__ExceedsMaxPerWallet();
error __3XP__InvalidSig();

error __3XP__ResearchNotEnabled();
error __3XP__IsNotTimeToFeed();

enum Currency {
    ETH,
    ERC1155,
    ERC20
}

abstract contract NFTFactory {
    function mint(
        address to,
        uint256 amount
    ) external virtual returns (uint256 nextTokenId, uint256);

    function totalSupply() public view virtual override returns (uint256);
}

contract NFTSale is ReentrancyGuardUpgradeable, OwnableUpgradeable {
    using ECDSAUpgradeable for bytes32;
    using StringsUpgradeable for uint256;

    address internal _devMultiSigWallet;
    uint256 public nextProjectId = 1;
    uint256 constant PUBLIC_SALE_ID = 0; // public sale

    struct Project {
        string name;
        string artist;
        string description;
        string website;
        string license;
        uint256 maxSupply;
        uint256 devReserve;
        uint256 artistReserve;
        bool active;
        bool locked;
        bool paused;
        address contractAddress;
    }

    // struct PuclicSaleConfigCreate {
    //     uint8 maxPerTransaction;
    //     uint64 unitPrice;
    // }

    // struct SaleConfigCreate {
    //     uint256 saleId;
    //     uint8 maxPerWallet;
    //     uint8 maxPerTransaction;
    //     uint64 unitPrice;
    //     address signerAddress;
    //     uint256 supply;
    //     uint256 maxSupply;
    // }

    struct SaleConfig {
        bool enabled;
        uint8 maxPerWallet;
        uint8 maxPerTransaction;
        uint256 supply;
        uint256 maxSupply;
        address signerAddress;
        Currency currency; // ETH, ERC1155, ERC20
        address currencyAddress;
        uint64 unitPrice;
    }

    struct WhitelistedUser {
        uint256 mintedAmount;
    }

    struct Referral {
        address addr;
        uint reward;
        bytes32 link;
        uint referredCount;
        mapping(bytes32 => bool) referred;
    }

    mapping(address => bool) public isDev;

    // projectId -> saleId -> SaleConfig
    mapping(uint256 => mapping(uint256 => SaleConfig)) private _saleConfig;

    // projectId -> saleId -> address -> whitelisted
    mapping(uint256 => mapping(uint256 => mapping(address => WhitelistedUser)))
        public whitelisted;

    mapping(uint256 => mapping(address => bool)) public _addressExist;

    mapping(bytes32 => Referral) private _referrals;
    mapping(bytes32 => bool) private referred;
    mapping(address => uint) private pending;

    uint private referredCount;
    uint private referrersCount;

    mapping(uint256 => Project) projects;
    mapping(uint256 => address) public projectIdToArtistAddress;

    modifier onlyUnlocked(uint256 _projectId) {
        require(!projects[_projectId].locked, "Only unlocked");
        _;
    }

    modifier onlyArtist(uint256 _projectId) {
        require(
            msg.sender == projectIdToArtistAddress[_projectId],
            "Only artist"
        );
        _;
    }

    modifier onlyDev() {
        require(isDev[_msgSender()], "Only Dev");
        _;
    }

    modifier onlyArtistOrDev(uint256 _projectId) {
        require(
            isDev[_msgSender()] ||
                _msgSender() == projectIdToArtistAddress[_projectId],
            "Only artist or Dev"
        );
        _;
    }

    function initialize(address devMultiSigWallet_) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        isDev[_msgSender()] = true;
        _devMultiSigWallet = devMultiSigWallet_;
    }

    /* 
        PROJECT
    */
    function projectDetails(
        uint256 _projectId
    )
        public
        view
        returns (
            string memory projectName,
            string memory artist,
            string memory description,
            string memory website,
            string memory license,
            uint256 supply,
            uint256 maxSupply,
            uint256 devReserve,
            uint256 artistReserve,
            address contractAddress
        )
    {
        projectName = projects[_projectId].name;
        artist = projects[_projectId].artist;
        description = projects[_projectId].description;
        website = projects[_projectId].website;
        license = projects[_projectId].license;
        totalSupply = NFTFactory(projects[_projectId].contractAddress)
            .totalSupply();
        supply = maxSupply = projects[_projectId].maxSupply;
        devReserve = projects[_projectId].devReserve;
        artistReserve = projects[_projectId].artistReserve;
        contractAddress = projects[_projectId].contractAddress;
    }

    function addProject(
        string memory _projectName,
        address _contractAddress,
        address _artistAddress,
        uint _maxSupply,
        uint _devReserve,
        uint _artistReserve
    ) public onlyDev {
        uint256 projectId = nextProjectId;

        projects[projectId].name = _projectName;
        projects[projectId].contractAddress = _contractAddress;
        projectIdToArtistAddress[projectId] = _artistAddress;
        projects[projectId].maxSupply = _maxSupply;
        projects[projectId].devReserve = _devReserve;
        projects[projectId].artistReserve = _artistReserve;
        projects[projectId].paused = true;
        nextProjectId += 1;
    }

    function updateProjectArtistName(
        uint256 _projectId,
        string memory _projectArtistName
    ) public onlyUnlocked(_projectId) onlyArtistOrDev(_projectId) {
        projects[_projectId].artist = _projectArtistName;
    }

    function updateProjectDescription(
        uint256 _projectId,
        string memory _projectDescription
    ) public onlyArtistOrDev(_projectId) {
        projects[_projectId].description = _projectDescription;
    }

    function updateProjectWebsite(
        uint256 _projectId,
        string memory _projectWebsite
    ) public onlyArtistOrDev(_projectId) {
        projects[_projectId].website = _projectWebsite;
    }

    function updateProjectLicense(
        uint256 _projectId,
        string memory _projectLicense
    ) public onlyUnlocked(_projectId) onlyArtistOrDev(_projectId) {
        projects[_projectId].license = _projectLicense;
    }

    function updateProjectContractAddress(
        uint256 _projectId,
        address _contractAddress
    ) public onlyUnlocked(_projectId) onlyArtistOrDev(_projectId) {
        require(_contractAddress != address(0), "Invalid address");
        projects[_projectId].contractAddress = _contractAddress;
    }

    function toggleProjectIsLocked(
        uint256 _projectId
    ) external onlyDev onlyUnlocked(_projectId) {
        projects[_projectId].locked = true;
    }

    function toggleProjectIsActive(uint256 _projectId) external onlyDev {
        projects[_projectId].active = !projects[_projectId].active;
    }

    function toggleProjectIsPaused(
        uint256 _projectId
    ) external onlyArtistOrDev(_projectId) {
        projects[_projectId].paused = !projects[_projectId].paused;
    }

    /*
        BACK OFFICE
    */
    function addDev(address _address) external onlyOwner {
        isDev[_address] = true;
    }

    function removeDev(address _address) external onlyOwner {
        isDev[_address] = false;
    }

    function setDevMultiSigAddress(
        address payable _address
    ) external onlyOwner {
        if (_address == address(0)) revert __3XP__SetDevMultiSigToZeroAddress();
        _devMultiSigWallet = _address;
    }

    function withdrawETHBalanceToDev() public onlyDev {
        if (address(this).balance <= 0) {
            revert __3XP__NoETHLeft();
        }

        (bool success, ) = address(_devMultiSigWallet).call{
            value: address(this).balance
        }("");

        if (!success) {
            revert __3XP__ETHTransferFailed();
        }
    }

    /*
        Referral
    */
    // function getBalanceOfReferrer(bytes32 link) public view returns (uint256) {
    //     Referral storage refer = _referrals[link];
    //     if (refer.link == link) {
    //         address referAddr = address(refer.addr);
    //         if (referAddr != 0) {
    //             return referAddr.balance;
    //         }
    //     }

    //     return 0;
    // }

    // function getReferrersCount() public view returns (uint256) {
    //     return referrersCount;
    // }

    // function isReferrer(bytes32 link) public view returns (bool) {
    //     return _referrals[link].link == link;
    // }

    // function getReferrerReward(bytes32 link) public view returns (uint) {
    //     return _referrals[link].reward;
    // }

    // function getReferrerAddress(bytes32 link) public view returns (address) {
    //     return _referrals[link].addr;
    // }

    // function isAlreadyReferred(bytes32 link) public view returns (bool) {
    //     return _referrals[link] == true;
    // }
}
