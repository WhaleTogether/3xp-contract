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

error NFTFactoryNotSet();
error SetDevMultiSigToZeroAddress();

error NoETHLeft();
error SaleNotEnabled();
error ETHTransferFailed();
error ExceedsMaxPerTransaction();
error InsufficientFunds();
error ExceedsMaxPerRound();
error CallerNotUser();
error ExceedMaxSupply();
error ExceedsDevReserve();
error ExceedsArtistReserve();
error InvalidSig();
error InvalidMintAmount();

error ResearchNotEnabled();
error IsNotTimeToFeed();

enum CurrencyType {
    ETH,
    ERC1155,
    ERC20
}

abstract contract NFTFactory {
    function name() public view virtual returns (string memory);

    function totalSupply() public view virtual returns (uint256);

    function mint(
        address to,
        uint256 amount
    ) external virtual returns (uint256 nextTokenId, uint256);
}

contract NFTSale is ReentrancyGuardUpgradeable, OwnableUpgradeable {
    using ECDSAUpgradeable for bytes32;
    using StringsUpgradeable for uint256;

    event Minted(address recipient, uint256 projectId, uint256 amount);

    address _devMultiSigWallet;
    uint256 public nextProjectId;
    uint256 constant PUBLIC_SALE_ID = 0; // public sale

    struct Project {
        address contractAddress;
        string artist;
        string description;
        uint256 maxSupply;
        uint256 devReserve;
        uint256 artistReserve;
        bool active;
        bool locked;
        bool paused;
    }

    struct SaleConfig {
        bool enabled;
        uint8 maxPerTransaction;
        address signerAddress;
        uint256 currentSupplyPerRound;
        uint256 maxSupplyPerRound;
        address erc20Address;
        address erc1155Address;
        uint256 unitPriceInEth;
        uint256 unitPriceInErc20;
        uint256 unitPriceInErc1155;
    }

    struct UserMintInfo {
        uint256 revenueShareAmount;
        uint256 claimedRevenueShareAmount;
        bool isExclusive;
    }

    struct WhitelistedUserInfo {
        uint256 mintedAmount;
    }

    // struct Referral {
    //     address addr;
    //     uint reward;
    //     bytes32 link;
    //     uint referredCount;
    //     mapping(bytes32 => bool) referred;
    // }

    mapping(address => bool) public isDev;

    mapping(uint256 => Project) public projects;
    mapping(uint256 => address) public projectIdToArtistAddress;

    // projectId -> saleId -> SaleConfig
    mapping(uint256 => mapping(uint256 => SaleConfig)) private _saleConfig;

    // projectId -> address -> UserMintInfo
    mapping(uint256 => mapping(address => UserMintInfo)) public userMintInfo;

    // projectId -> saleId -> address -> WhitelistedUserInfo
    mapping(uint256 => mapping(uint256 => mapping(address => WhitelistedUserInfo)))
        public whitelistedUserInfo;

    // mapping(bytes32 => Referral) private _referrals;
    // mapping(bytes32 => bool) private referred;
    // mapping(address => uint) private pending;

    // uint private referredCount;
    // uint private referrersCount;

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

    modifier canMint(
        uint256 projectId,
        uint256 saleId,
        uint256 amount
    ) {
        _guardMint(projectId, amount);

        unchecked {
            SaleConfig memory saleConfig = _saleConfig[projectId][saleId];
            if (!saleConfig.enabled) {
                revert SaleNotEnabled();
            }

            if (
                saleId > 0 &&
                NFTFactory(projects[projectId].contractAddress).totalSupply() +
                    amount >
                saleConfig.maxSupplyPerRound
            ) {
                revert ExceedsMaxPerRound();
            }

            if (amount > saleConfig.maxPerTransaction) {
                revert ExceedsMaxPerTransaction();
            }
        }
        _;
    }

    function _guardMint(
        uint256 projectId,
        uint256 amount
    ) internal view virtual {
        unchecked {
            require(tx.origin == _msgSender(), "Can't mint from contract");

            if (tx.origin != _msgSender()) {
                revert CallerNotUser();
            }

            if (
                NFTFactory(projects[projectId].contractAddress).totalSupply() +
                    amount >
                projects[projectId].maxSupply
            ) {
                revert ExceedMaxSupply();
            }
        }
    }

    function initialize(address devMultiSigWallet_) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        isDev[_msgSender()] = true;
        _devMultiSigWallet = devMultiSigWallet_;
        nextProjectId = 1;
    }

    receive() external payable {}

    fallback() external payable {}

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
            address contractAddress,
            string memory artist,
            string memory description,
            uint256 totalSupply,
            uint256 maxSupply,
            uint256 devReserve,
            uint256 artistReserve
        )
    {
        NFTFactory nft = NFTFactory(projects[_projectId].contractAddress);

        contractAddress = projects[_projectId].contractAddress;
        artist = projects[_projectId].artist;
        projectName = nft.name();
        description = projects[_projectId].description;
        totalSupply = nft.totalSupply();
        maxSupply = projects[_projectId].maxSupply;
        devReserve = projects[_projectId].devReserve;
        artistReserve = projects[_projectId].artistReserve;
    }

    function addProject(
        address _contractAddress,
        address _artistAddress,
        uint _maxSupply,
        uint _devReserve,
        uint _artistReserve
    ) external onlyDev {
        require(_contractAddress != address(0), "Invalid contract address");

        uint256 projectId = nextProjectId;

        projects[projectId].contractAddress = _contractAddress;
        projectIdToArtistAddress[projectId] = _artistAddress;
        projects[projectId].maxSupply = _maxSupply;
        projects[projectId].devReserve = _devReserve;
        projects[projectId].artistReserve = _artistReserve;
        projects[projectId].paused = true;
        nextProjectId += 1;
    }

    function updateProjectContractAddress(
        uint256 _projectId,
        address _contractAddress
    ) public onlyUnlocked(_projectId) onlyArtistOrDev(_projectId) {
        require(_contractAddress != address(0), "Invalid address");
        projects[_projectId].contractAddress = _contractAddress;
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

    function updateMaxSupply(
        uint256 _projectId,
        uint256 maxSupply_
    ) public onlyUnlocked(_projectId) onlyDev {
        projects[_projectId].maxSupply = maxSupply_;
    }

    function updateDevReserve(
        uint256 _projectId,
        uint256 devReserve_
    ) public onlyUnlocked(_projectId) onlyDev {
        projects[_projectId].devReserve = devReserve_;
    }

    function updateArtistReserve(
        uint256 _projectId,
        uint256 artistReserve_
    ) public onlyUnlocked(_projectId) onlyDev {
        projects[_projectId].artistReserve = artistReserve_;
    }

    function toggleProjectIsActive(uint256 _projectId) external onlyDev {
        projects[_projectId].active = !projects[_projectId].active;
    }

    function toggleProjectIsLocked(
        uint256 _projectId
    ) external onlyDev onlyUnlocked(_projectId) {
        projects[_projectId].locked = true;
    }

    function toggleProjectIsPaused(
        uint256 _projectId
    ) external onlyArtistOrDev(_projectId) {
        projects[_projectId].paused = !projects[_projectId].paused;
    }

    /*
        SALE CONFIG
    */
    function getPublicSaleConfig(
        uint256 projectId_
    ) external view returns (SaleConfig memory) {
        return _saleConfig[projectId_][PUBLIC_SALE_ID];
    }

    function setPublicSaleConfig(
        uint256 projectId_,
        uint256 maxPerTransaction_,
        address erc20Address_,
        address erc1155Address_,
        uint256 unitPriceInEth_,
        uint256 unitPriceInErc20_,
        uint256 unitPriceInErc1155_
    ) public onlyDev {
        _saleConfig[projectId_][PUBLIC_SALE_ID].maxPerTransaction = uint8(
            maxPerTransaction_
        );
        _saleConfig[projectId_][PUBLIC_SALE_ID].erc20Address = erc20Address_;
        _saleConfig[projectId_][PUBLIC_SALE_ID]
            .erc1155Address = erc1155Address_;
        _saleConfig[projectId_][PUBLIC_SALE_ID]
            .unitPriceInEth = unitPriceInEth_;
        _saleConfig[projectId_][PUBLIC_SALE_ID]
            .unitPriceInErc20 = unitPriceInErc20_;
        _saleConfig[projectId_][PUBLIC_SALE_ID]
            .unitPriceInErc1155 = unitPriceInErc1155_;
    }

    function getSaleConfig(
        uint256 projectId_,
        uint256 saleId_
    ) external view returns (SaleConfig memory) {
        return _saleConfig[projectId_][saleId_];
    }

    function setSaleConfig(
        uint256 projectId_,
        uint256 saleId_,
        uint256 maxPerTransaction_,
        address signerAddress_,
        uint256 maxSupplyPerRound_,
        address erc20Address_,
        address erc1155Address_,
        uint256 unitPriceInEth_,
        uint256 unitPriceInErc20_,
        uint256 unitPriceInErc1155_
    ) public onlyDev {
        _saleConfig[projectId_][saleId_].maxPerTransaction = uint8(
            maxPerTransaction_
        );
        _saleConfig[projectId_][saleId_].signerAddress = signerAddress_;
        _saleConfig[projectId_][saleId_].maxSupplyPerRound = maxSupplyPerRound_;
        _saleConfig[projectId_][saleId_].erc20Address = erc20Address_;
        _saleConfig[projectId_][saleId_].erc1155Address = erc1155Address_;
        _saleConfig[projectId_][saleId_].unitPriceInEth = unitPriceInEth_;
        _saleConfig[projectId_][saleId_].unitPriceInErc20 = unitPriceInErc20_;
        _saleConfig[projectId_][saleId_]
            .unitPriceInErc1155 = unitPriceInErc1155_;
    }

    function setSaleStatus(
        uint256 projectId_,
        uint256 saleId_,
        bool enabled
    ) external onlyDev {
        if (_saleConfig[projectId_][saleId_].enabled != enabled) {
            _saleConfig[projectId_][saleId_].enabled = enabled;
        }
    }

    /*
        MINT
    */
    function devMintTo(
        uint256 projectId,
        address to,
        uint256 amount
    ) external onlyOwner {
        if (amount > projects[projectId].devReserve) {
            revert ExceedsDevReserve();
        }
        projects[projectId].devReserve -= amount;

        _handleMint(to, projectId, amount);
    }

    function artistMintTo(
        uint256 projectId,
        address to,
        uint256 amount
    ) external onlyArtistOrDev(projectId) {
        if (amount > projects[projectId].artistReserve) {
            revert ExceedsArtistReserve();
        }
        projects[projectId].artistReserve -= amount;

        _handleMint(to, projectId, amount);
    }

    // TODO * Support ERC20 and ERC1155
    function privateMint(
        uint256 projectId,
        uint256 saleId,
        uint256 amount,
        CurrencyType currencyType,
        bytes memory signature
    ) external payable canMint(projectId, saleId, amount) {
        if (
            !_verify(
                _hash(projectId, saleId, _msgSender(), amount),
                projectId,
                saleId,
                signature
            )
        ) {
            revert InvalidSig();
        }

        uint256 mintedAmount = whitelistedUserInfo[projectId][saleId][
            _msgSender()
        ].mintedAmount;

        if (amount > mintedAmount) {
            revert InvalidMintAmount();
        }

        _handlePayment(currencyType, projectId, saleId, amount, address(0));
        _handleMint(_msgSender(), projectId, amount);
    }

    function publicMint(
        uint256 projectId,
        uint256 amount,
        address referralWalletAddress
    ) external payable canMint(projectId, PUBLIC_SALE_ID, amount) {
        if (referralWalletAddress == _msgSender()) {
            revert InvalidReferral();
        }

        uint256 totalPrice = amount *
            _saleConfig[projectId][PUBLIC_SALE_ID].unitPriceInEth;

        if (msg.value < totalPrice) {
            revert InsufficientFunds();
        }

        // _calculateAndHandleRevenueShare(
        //     typeId,
        //     referralWalletAddress,
        //     totalPrice
        // );

        _handleMint(_msgSender(), projectId, amount);
    }

    function _handlePayment(
        CurrencyType currencyType,
        uint256 projectId,
        uint256 saleId,
        uint256 amount,
        address referralWalletAddress
    ) internal {
        SaleConfig memory saleConfig = _saleConfig[projectId][saleId];

        if (currencyType == CurrencyType.ETH) {
            uint256 unitPriceInEth = saleConfig.unitPriceInEth;
            uint256 totalPrice = amount * unitPriceInEth;

            if (msg.value < totalPrice) {
                revert InsufficientFunds();
            }
        }
        if (currencyType == CurrencyType.ERC20) {
            uint256 unitPriceInEth = saleConfig.unitPriceInErc20;
            uint256 totalPrice = amount * unitPriceInEth;

            // if (msg.value < totalPrice) {
            //     revert InsufficientFunds();
            // }
        }
        if (currencyType == CurrencyType.ERC1155) {
            uint256 unitPriceInEth = saleConfig.unitPriceInErc1155;
            uint256 totalPrice = amount * unitPriceInEth;

            // if (msg.value < totalPrice) {
            //     revert InsufficientFunds();
            // }
        }

        uint256 devShareAmount = totalPrice;
        if (referralWalletAddress != address(0)) {
            // uint256 revenueSharePercentage = userMintInfo[typeId][
            //     referralWalletAddress
            // ].isExclusive
            //     ? _saleConfig[typeId].exclusiveRevenueSharePercentage
            //     : _saleConfig[typeId].revenueSharePercentage;
            // uint256 referrerRevenueShareAmount = (msg.value *
            //     revenueSharePercentage) / 10000;
            // devShareAmount = totalPrice - referrerRevenueShareAmount;
            // _recordRefferal(
            //     typeId,
            //     referralWalletAddress,
            //     referrerRevenueShareAmount
            // );
        }

        // address to = _devMultiSigWalletAddress;
        // require(to != address(0), "Transfer to zero address");
        // (bool success, ) = payable(to).call{value: devShareAmount}("");
        // if (!success) {
        //     revert ETHTransferFailed();
        // }
    }

    function _handleMint(
        address recipient,
        uint256 projectId,
        uint256 amount
    ) internal {
        NFTFactory(projects[projectId].contractAddress).mint(recipient, amount);
        emit Minted(recipient, projectId, amount);
    }

    /*
        WHITELIST CHECK
    */
    function _hash(
        uint256 projectId,
        uint256 saleId,
        address account,
        uint256 amount
    ) internal pure returns (bytes32) {
        return
            ECDSAUpgradeable.toEthSignedMessageHash(
                keccak256(abi.encodePacked(projectId, saleId, account, amount))
            );
    }

    function _verify(
        bytes32 digest,
        uint256 projectId,
        uint256 saleId,
        bytes memory signature
    ) internal view returns (bool) {
        return
            _saleConfig[projectId][saleId].signerAddress ==
            ECDSAUpgradeable.recover(digest, signature);
    }

    /*
        Referral
    */
    // function _calculateAndHandleRevenueShare(
    //     uint256 typeId,
    //     address referralWalletAddress,
    //     uint256 totalPrice
    // ) internal {
    //     uint256 devShareAmount = totalPrice;
    //     if (referralWalletAddress != address(0)) {
    //         uint256 revenueSharePercentage = userMintInfo[typeId][
    //             referralWalletAddress
    //         ].isExclusive
    //             ? _saleConfig[typeId].exclusiveRevenueSharePercentage
    //             : _saleConfig[typeId].revenueSharePercentage;

    //         uint256 referrerRevenueShareAmount = (msg.value *
    //             revenueSharePercentage) / 10000;

    //         devShareAmount = totalPrice - referrerRevenueShareAmount;

    //         _recordRefferal(
    //             typeId,
    //             referralWalletAddress,
    //             referrerRevenueShareAmount
    //         );
    //     }

    //     address to = _devMultiSigWalletAddress;
    //     require(to != address(0), "Transfer to zero address");
    //     (bool success, ) = payable(to).call{value: devShareAmount}("");
    //     if (!success) {
    //         revert ETHTransferFailed();
    //     }
    // }

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
        if (_address == address(0)) revert SetDevMultiSigToZeroAddress();
        _devMultiSigWallet = _address;
    }

    function withdrawETHBalanceToDev() public onlyDev {
        if (address(this).balance <= 0) {
            revert NoETHLeft();
        }

        (bool success, ) = address(_devMultiSigWallet).call{
            value: address(this).balance
        }("");

        if (!success) {
            revert ETHTransferFailed();
        }
    }
}
