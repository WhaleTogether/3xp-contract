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

import "./lib/OnlyDevMultiSigUpgradeable.sol";

error __3XPMintFactoryNotSet();
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

abstract contract __3XPMintFactory {
    function mint(
        address to,
        uint256 amount
    ) external virtual returns (uint256 nextTokenId, uint256);
}

contract Sale is
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    OnlyDevMultiSigUpgradeable,
    DefaultOperatorFiltererUpgradeable
{
    using ECDSAUpgradeable for bytes32;
    using StringsUpgradeable for uint256;

    address internal _devMultiSigWallet;

    struct PuclicSaleConfigCreate {
        uint8 maxPerTransaction;
        uint64 unitPrice;
    }

    struct SaleConfigCreate {
        uint256 saleId;
        uint8 maxPerWallet;
        uint8 maxPerTransaction;
        uint64 unitPrice;
        address signerAddress;
        uint256 supply;
        uint256 maxSupply;
    }

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

    // projectId -> saleId -> SaleConfig
    // mapping(uint256 => mapping(uint256 => SaleConfig)) private _saleConfig;
    mapping(uint256 => SaleConfig) private _saleConfig;
    uint256 constant PUBLIC_SALE_ID = 0; // public sale

    // projectId -> saleId -> address -> whitelisted
    mapping(uint256 => mapping(uint256 => mapping(address => WhitelistedUser))) public whitelisted;

    mapping(uint256 => mapping(address => bool)) public _addressExist;

    struct Referral {
        address addr;
        uint reward;
        bytes32 link;
        uint referredCount;
        mapping (bytes32 => bool) referred;
    }

    mapping (bytes32 => Referral) private _referrals;
    mapping (bytes32 => bool) private referred;
    mapping (address => uint) private pending;

    uint private referredCount;
    uint private referrersCount;


    struct Project {
        string name;
        string artist;
        string description;
        string website;
        string license;
        uint256 supply;
        uint256 maxSupply;
        uint256 devReserve;
        uint256 artistReserve;
        bool active;
        bool locked;
        bool paused;
        // address contractAddress;
    }

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
            uint256 artistReserve
            // address contractAddress
        )
    {
        projectName = projects[_projectId].name;
        artist = projects[_projectId].artist;
        description = projects[_projectId].description;
        website = projects[_projectId].website;
        license = projects[_projectId].license;
        supply = projects[_projectId].supply;
        maxSupply = projects[_projectId].maxSupply;
        devReserve = projects[_projectId].devReserve;
        artistReserve = projects[_projectId].artistReserve;
        // contractAddress = projects[_projectId].artistReserve;
    }

    function updateProjectArtistName(
        uint256 _projectId,
        string memory _projectArtistName
    ) public onlyUnlocked(_projectId) onlyArtist(_projectId) {
        projects[_projectId].artist = _projectArtistName;
    }

    function updateProjectDescription(
        uint256 _projectId,
        string memory _projectDescription
    ) public onlyArtist(_projectId) {
        projects[_projectId].description = _projectDescription;
    }

    function updateProjectWebsite(
        uint256 _projectId,
        string memory _projectWebsite
    ) public onlyArtist(_projectId) {
        projects[_projectId].website = _projectWebsite;
    }

    function updateProjectLicense(
        uint256 _projectId,
        string memory _projectLicense
    ) public onlyUnlocked(_projectId) onlyArtist(_projectId) {
        projects[_projectId].license = _projectLicense;
    }

    // function updateProjectPricePerTokenInWei(
    //     uint256 _projectId,
    //     uint256 _pricePerTokenInWei
    // ) public onlyUnlocked(_projectId) onlyArtistOrDev(_projectId) {
    //     projectIdToPricePerTokenInWei[_projectId] = _pricePerTokenInWei;
    // }

    // function updateProjectContractAddress(
    //     uint256 _projectId,
    //     address _contractAddress
    // ) public onlyUnlocked(_projectId) onlyArtist(_projectId) {
    //     projects[_projectId].contractAddress = _contractAddress;
    // }

    mapping(uint256 => Project) projects;
    mapping(uint256 => address) public projectIdToArtistAddress;
    // mapping(uint256 => uint256) public projectIdToPricePerTokenInWei;
    mapping(uint256 => string) public projectIdToProvenanceHash;

    mapping(address => bool) public isDev;

    uint256 public nextProjectId = 1;

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
        require(msg.sender == _msgSender(), "Only whitelisted");
        _;
    }

    // modifier onlyArtistOrDev(uint256 _projectId) {
    //     require(
    //         isWhitelisted[msg.sender] ||
    //             msg.sender == projectIdToArtistAddress[_projectId],
    //         "Only artist or whitelisted"
    //     );
    //     _;
    // }

    // function addDev(address _address) external onlyOwner {
    //     isWhitelisted[_address] = true;
    // }

    // function removeDev(address _address) external onlyOwner {
    //     isWhitelisted[_address] = false;
    // }

    function addProject(
        string memory _projectName,
        // address _contractAddress,
        address _artistAddress,
        uint _maxSupply,
        uint _devReserve,
        uint _artistReserve
    ) external onlyDev {
        uint256 projectId = nextProjectId;

        projects[projectId].name = _projectName;
        // projects[projectId].contractAddress = _contractAddress;
        projectIdToArtistAddress[projectId] = _artistAddress;
        projects[projectId].maxSupply = _maxSupply;
        projects[projectId].devReserve = _devReserve;
        projects[projectId].artistReserve = _artistReserve;
        projects[projectId].paused = true;
        nextProjectId += 1;

        console.log("projects", projectId);

        // TODO add price to saleConfig
        // projectIdToPricePerTokenInWei[projectId] = _pricePerTokenInWei;
    }

    function toggleProjectIsLocked(
        uint256 _projectId
    ) external onlyOwner onlyUnlocked(_projectId) {
        projects[_projectId].locked = true;
    }

    function toggleProjectIsActive(uint256 _projectId) external onlyOwner {
        projects[_projectId].active = !projects[_projectId].active;
    }

    function toggleProjectIsPaused(
        uint256 _projectId
    ) external onlyArtist(_projectId) {
        projects[_projectId].paused = !projects[_projectId].paused;
    }

    function setProvenanceHash(
        uint256 _projectId,
        string memory provenanceHash
    ) external onlyArtist(_projectId) onlyUnlocked(_projectId) {
        projectIdToProvenanceHash[_projectId] = provenanceHash;
    }

    function initialize(address devMultiSigWallet_) public initializer {
        __OnlyDevMultiSig_init(devMultiSigWallet_);
        __Ownable_init();
        __ReentrancyGuard_init();
        __DefaultOperatorFilterer_init();

        _devMultiSigWallet = devMultiSigWallet_;

        // setPublicSaleConfig(
        //     publicSaleConfig.maxPerTransaction,
        //     publicSaleConfig.unitPrice
        // );

        // // exclusive round
        // setSaleConfig(
        //     exclusiveSaleConfig.saleId,
        //     exclusiveSaleConfig.maxPerWallet,
        //     exclusiveSaleConfig.maxPerTransaction,
        //     exclusiveSaleConfig.unitPrice,
        //     exclusiveSaleConfig.signerAddress,
        //     exclusiveSaleConfig.maxPerRound
        // );
    }

    /* 
        MINT
    */
    // modifier canMint(
    //     uint256 projectId,
    //     uint256 saleId,
    //     address to,
    //     uint256 amount
    // ) {
    //     _guardMint(projectId, amount);
    //     unchecked {
    //         require(
    //             projects[_projectId].active ||
    //                 msg.sender == projectIdToArtistAddress[_projectId],
    //             "Project must exist and be active"
    //         );
    //         require(
    //             !projects[_projectId].paused ||
    //                 msg.sender == projectIdToArtistAddress[_projectId],
    //             "Purchases are paused."
    //         );

    //         SaleConfig memory saleConfig = _saleConfig[projectId][saleId];
    //         if (!saleConfig.enabled) {
    //             revert __3XP__SaleNotEnabled();
    //         }
    //         if (amount > saleConfig.maxPerTransaction) {
    //             revert __3XP__ExceedsMaxPerTransaction();
    //         }

    //         if (saleConfig.currency == Currency.ETH) {
    //             if (msg.value < (amount * saleConfig.unitPrice)) {
    //                 revert __3XP__ETHAmountIsNotSufficient();
    //             }
    //         }

    //         // if (saleConfig.currency == Currency.ERC20) {
    //         //     IERC20 erc20 = IERC20(saleConfig.erc20Address);
    //         //     if (
    //         //         erc20.allowance(_msgSenderERC721A(), address(this)) <
    //         //         (amount * saleConfig.unitPrice)
    //         //     ) {
    //         //         revert __3XP__ERC20AllowanceIsNotSufficient();
    //         //     }
    //         //     if (
    //         //         erc20.balanceOf(_msgSenderERC721A()) <
    //         //         (amount * saleConfig.unitPrice)
    //         //     ) {
    //         //         revert __3XP__ERC20BalanceIsNotSufficient();
    //         //     }
    //         //     erc20.transferFrom(
    //         //         _msgSenderERC721A(),
    //         //         _devMultiSigWallet,
    //         //         amount * saleConfig.unitPrice
    //         //     );
    //         // }

    //         // if (saleConfig.currency == Currency.ERC1155) {
    //         //     //
    //         // }

    //         if (
    //             saleId > 0 &&
    //             (saleConfig.supply == 0 || saleConfig.supply - amount < 0)
    //         ) {
    //             revert __3XP__ExceedsMaxPerRound();
    //         }
    //     }
    //     _;
    // }

    // function _guardMint(
    //     uint256 projectId,
    //     uint256 _amount
    // ) internal view virtual {
    //     unchecked {
    //         if (tx.origin != _msgSender()) {
    //             revert __3XP__CallerNotUser();
    //         }

    //         if (
    //             projects[_projectId].supply + amount >
    //             projects[_projectId].maxSupply
    //         ) {
    //             revert __3XP__ExceedMaxSupply();
    //         }
    //     }
    // }

    // function devMintTo(
    //     uint256 projectId,
    //     uint256 amount,
    //     address to
    // ) external onlyDev {
    //     if (amount > projects[_projectId].devReserve) {
    //         revert __3XP__ExceedsDevReserve();
    //     }
    //     // _guardMint(projectId, amount);
    //     // _safeMint(to, amount);
    //     projects[_projectId].devReserve -= amount;
    // }

    // function mint(
    //     uint256 _projectId,
    //     uint256 _saleId,
    //     uint256 _amount
    // )
    //     public
    //     payable
    //     canMint(_projectId, _saleId, _msgSender(), _amount)
    //     returns (uint256)
    // {
    //     projects[_projectId].supply += amount;

    //     if (projects[_projectId].contractAddress == address(0)) {
    //         revert __3XPMintFactoryNotSet();
    //     }
    //     __3XPMintFactory factory = __3XPMintFactory(
    //         projects[_projectId].contractAddress
    //     );
    //     factory.mint(recipient, _amount);

    //     // emit Mint(recipient, tokenIdToBe, _projectId);

    //     // return tokenIdToBe;
    // }

    // function exclusiveMint(
    //     uint256 saleId,
    //     uint256 amount,
    //     bytes calldata signature
    // ) external payable canMint(saleId, _msgSender(), amount) {
    //     // _feedCarrots(0, adoptionPlan.carrotAmountRequiredPerAdoption * amount);

    //     if (!_verify(saleId, _hash(_msgSender(), saleId), signature)) {
    //         revert __3XP__InvalidSig();
    //     } // check if this is a correct WL address

    //     if (!_addressExist[saleId][_msgSender()]) {
    //         // After verify the signature - check if address is already exist yet then create one
    //         setWhitelistUser(
    //             saleId,
    //             _msgSender(),
    //             _saleConfig[saleId].maxPerWallet
    //         );
    //     }

    //     if (amount > whitelisted[saleId][_msgSender()].mintAmount) {
    //         revert __3XP__ExceedsMaxPerWallet();
    //     }

    //     if (whitelisted[saleId][_msgSender()].mintAmount <= 0) {
    //         revert __3XP__ExceedsMaxPerWallet();
    //     }

    //     whitelisted[saleId][_msgSender()].mintAmount -= amount;

    //     uint256 startTokenId = _nextTokenId();
    //     _safeMint(_msgSender(), amount);

    //     _saleConfig[saleId].maxPerRound -= amount;
    // }

    // function publicMint(
    //     uint256 amount
    // ) external payable canMint(PUBLIC_SALE_ID, _msgSender(), amount) {
    //     // if (amount > adoptionPlan.fcfsSupply) {
    //     //     revert __3XP__ExceedsFCFSSupply();
    //     // }
    //     // adoptionPlan.fcfsSupply -= uint16(amount);
    //     // _safeMint(_msgSender(), amount);
    // }

    function getPublicSaleConfig() external view returns (SaleConfig memory) {
        return _saleConfig[PUBLIC_SALE_ID];
    }

    function setPublicSaleConfig(
        uint256 maxPerTransaction,
        uint256 unitPrice
    ) public onlyOwner {
        _saleConfig[PUBLIC_SALE_ID].maxPerTransaction = uint8(
            maxPerTransaction
        );
        _saleConfig[PUBLIC_SALE_ID].unitPrice = uint64(unitPrice);
    }

    function getSaleConfig(
        uint256 saleId
    ) external view returns (SaleConfig memory) {
        return _saleConfig[saleId];
    }

    function setSaleConfig(
        uint256 saleId,
        uint256 maxPerWallet,
        uint256 maxPerTransaction,
        uint256 unitPrice,
        uint256 supply,
        uint256 maxSupply,
        address signerAddress
    ) public onlyOwner {
        _saleConfig[saleId].maxPerWallet = uint8(maxPerWallet);
        _saleConfig[saleId].maxPerTransaction = uint8(maxPerTransaction);
        _saleConfig[saleId].unitPrice = uint64(unitPrice);
        _saleConfig[saleId].supply = uint64(supply);
        _saleConfig[saleId].maxSupply = uint64(maxSupply);
        _saleConfig[saleId].signerAddress = signerAddress;
    }

    function setSaleStatus(uint256 saleId, bool enabled) external onlyOwner {
        if (_saleConfig[saleId].enabled != enabled) {
            _saleConfig[saleId].enabled = enabled;
        }
    }

    function isWhitelisted(
        uint256 saleId,
        uint256 projectId,
        bytes calldata signature
    ) public view returns (bool, uint256) {
        // check if this address is whitelisted or not
        uint256 mintAmount = 0;
        bool isWhitelistedBool;

        // if (_verify(saleId, _hash(_msgSender(), saleId), signature)) {
        //     isWhitelistedBool = true;
        //     if (!_addressExist[saleId][_msgSender()]) {
        //         // After verify the signature - check if address is already exist yet then create one
        //         mintAmount = _saleConfig[saleId].maxPerWallet;
        //     } else {
        //         mintAmount = whitelisted[projectId][saleId][_msgSender()].mintAmount;
        //     }
        // } else {
        //     isWhitelistedBool = false;
        // }
        return (isWhitelistedBool, mintAmount);
    }

    function _hash(
        address account,
        uint256 saleId
    ) internal pure returns (bytes32) {
        return
            ECDSAUpgradeable.toEthSignedMessageHash(
                keccak256(abi.encodePacked(account, saleId))
            );
    }

    function _verify(
        uint256 saleId,
        bytes32 digest,
        bytes memory signature
    ) internal view returns (bool) {
        return
            _saleConfig[saleId].signerAddress ==
            ECDSAUpgradeable.recover(digest, signature);
    }

    // function setWhitelistUser(
    //     uint256 saleId,
    //     address _walletAddress,
    //     uint256 _mintAmount
    // ) private {
    //     whitelisted[saleId][_walletAddress].walletAddress = _walletAddress;
    //     whitelisted[saleId][_walletAddress].mintAmount = _mintAmount;
    //     _addressExist[saleId][_walletAddress] = true; // winner address;
    // }

    /* 
        BACK OFFICE
    */
    function setDevMultiSigAddress(
        address payable _address
    ) external onlyDevMultiSig {
        if (_address == address(0)) revert __3XP__SetDevMultiSigToZeroAddress();
        _devMultiSigWallet = _address;
        updateDevMultiSigWallet(_address);
    }

    function withdrawETHBalanceToDev() public onlyDevMultiSig {
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
    function getBalanceOfReferrer(bytes32 link) view public returns (uint256) {
        Referral storage refer = _referrals[link];
        if (refer.link == link) {
            address referAddr = address(refer.addr);
            if (referAddr != 0) {
                return referAddr.balance;
            }
        }

        return 0;
    }

    function getReferrersCount() view public returns (uint256) { return referrersCount; }

    function isReferrer(bytes32 link) view public returns (bool) { 
        return _referrals[link].link == link; 
    }

    function getReferrerReward(bytes32 link) view public returns (uint) { 
        return _referrals[link].reward; 
    }

    function getReferrerAddress(bytes32 link) view public returns (address) {
        return _referrals[link].addr; 
    }

    function isAlreadyReferred(bytes32 link) view public returns (bool) { 
        return _referrals[link] == true; 
    }
}
