// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

error SaleNotEnabled();
error NotAuthorizedWallet();
error InsufficientFunds();
error InvalidTokenId();
error NoETHLeft();
error ExceedsMaxPerTransaction();
error ETHTransferFailed();
error InvalidSignature();
error InvalidInput();
error ExceedsDevReserve();
error NotForSale();
error PayoutNotActive();
error InvalidReferral();

contract Mock1155 is Ownable, ERC1155Supply, ERC2981 {
    using ECDSA for bytes32;
    using Strings for uint256;

    event SaleStatusChange(uint256 indexed typeId, bool enabled);
    event Minted(address recipient, uint256 typeId, uint256 amount);

    struct SaleConfig {
        bool enabled;
        uint8 maxPerTransaction;
        uint64 unitPrice;
        uint64 discountedUnitPrice;
        uint256 revenueSharePercentage;
        uint256 exclusiveRevenueSharePercentage;
        address signerAddress;
    }

    struct MintPlan {
        uint256 devReserve;
        string baseURI;
        bool isAvailable;
    }

    struct UserMintInfo {
        uint256 revenueShareAmount;
        uint256 claimedRevenueShareAmount;
        uint256 freeClaimedAmount;
        bool isExclusive;
    }

    address private _devMultiSigWalletAddress;

    uint256 public takeOverPrice;

    string public name;
    string public symbol;

    bool public isForSale;
    bool public isPayoutActive;

    mapping(uint256 => SaleConfig) public _saleConfig; // typeId => SaleConfig
    mapping(uint256 => MintPlan) public mintPlan; // typeId => MintPlan
    mapping(uint256 => mapping(address => UserMintInfo)) public userMintInfo;
    mapping(string => address) public referralAddresses;
    mapping(address => bool) public authorizedWallets;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory initBaseURI_
    ) ERC1155("") {
        name = name_;
        symbol = symbol_;

        mintPlan[0].baseURI = initBaseURI_;

        _mint(_msgSender(), 0, 200, "");
    }

    /* 
        interface
    */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC1155, ERC2981) returns (bool) {
        return
            ERC1155.supportsInterface(interfaceId) ||
            super.supportsInterface(interfaceId);
    }

    /* 
        uri
    */
    function uri(uint256 typeId) public view override returns (string memory) {
        if (!mintPlan[typeId].isAvailable) {
            revert InvalidTokenId();
        }
        return
            bytes(mintPlan[typeId].baseURI).length > 0
                ? string(
                    abi.encodePacked(
                        mintPlan[typeId].baseURI,
                        typeId.toString()
                    )
                )
                : mintPlan[typeId].baseURI;
    }

    function updateBaseUri(
        uint256 typeId,
        string memory _baseURI
    ) external onlyOwner {
        mintPlan[typeId].baseURI = _baseURI;
    }

    function setRoyaltyInfo(
        address receiver,
        uint96 feeBasisPoints
    ) public onlyOwner {
        _setDefaultRoyalty(receiver, feeBasisPoints);
    }
}
