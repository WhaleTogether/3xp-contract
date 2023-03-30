// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "hardhat/console.sol";

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import "erc721a-upgradeable/contracts/IERC721AUpgradeable.sol";
import "erc721a-upgradeable/contracts/extensions/ERC721AQueryableUpgradeable.sol";
import "operator-filter-registry/src/upgradeable/DefaultOperatorFiltererUpgradeable.sol";

import "./lib/OnlyDevMultiSigUpgradeable.sol";

error __3XP__SetDevMultiSigToZeroAddress();
error __3XP__NotTokenOwner();
error __3XP__NotExists();
error __3XP__NoETHLeft();
error __3XP__ETHTransferFailed();
error __3XP__NotMinter();

//   .--,-``-.                                   ,-.----.
//  /   /     '.           ,--,     ,--,         \    /  \
// / ../        ;          |'. \   / .`|         |   :    \
// \ ``\  .`-    '         ; \ `\ /' / ;         |   |  .\ :
//  \___\/   \   :         `. \  /  / .'         .   :  |: |
//       \   :   |          \  \/  / ./          |   |   \ :
//       /  /   /            \  \.'  /           |   : .   /
//       \  \   \             \  ;  ;            ;   | |`-'
//   ___ /   :   |           / \  \  \           |   | ;
//  /   /\   /   :          ;  /\  \  \          :   ' |
// / ,,/  ',-    .        ./__;  \  ;  \         :   : :
// \ ''\        ;         |   : / \  \  ;        |   | :
//  \   \     .'          ;   |/   \  ' |        `---'.|
//   `--`-,,-'            `---'     `--`           `---`
// 3XP - https://3XP.art
// Follow us at https://twitter.com/3XPart
//

contract __3XPMint is
    OwnableUpgradeable,
    OnlyDevMultiSigUpgradeable,
    ERC721AQueryableUpgradeable,
    DefaultOperatorFiltererUpgradeable,
    ERC2981Upgradeable
{
    using StringsUpgradeable for uint256;

    string private baseURI;
    address internal _devMultiSigWallet;

    mapping(address => bool) public minters;

    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _initBaseURI,
        address devMultiSigWallet_,
        uint96 royalty_
    ) public initializerERC721A initializer {
        __OnlyDevMultiSig_init(devMultiSigWallet_);
        __ERC721A_init(_name, _symbol);
        __ERC721AQueryable_init();
        __ERC2981_init();
        __Ownable_init();
        __DefaultOperatorFilterer_init();

        _devMultiSigWallet = devMultiSigWallet_;
        setBaseURI(_initBaseURI);
        _setDefaultRoyalty(devMultiSigWallet_, royalty_);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(ERC721AUpgradeable, IERC721AUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return
            ERC721AUpgradeable.supportsInterface(interfaceId) ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IERC721-transferFrom}.
     *      In this example the added modifier ensures that the operator is allowed by the OperatorFilterRegistry.
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    )
        public
        override(ERC721AUpgradeable, IERC721AUpgradeable)
        onlyAllowedOperator(from)
    {
        super.transferFrom(from, to, tokenId);
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     *      In this example the added modifier ensures that the operator is allowed by the OperatorFilterRegistry.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    )
        public
        override(ERC721AUpgradeable, IERC721AUpgradeable)
        onlyAllowedOperator(from)
    {
        super.safeTransferFrom(from, to, tokenId);
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     *      In this example the added modifier ensures that the operator is allowed by the OperatorFilterRegistry.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    )
        public
        override(ERC721AUpgradeable, IERC721AUpgradeable)
        onlyAllowedOperator(from)
    {
        super.safeTransferFrom(from, to, tokenId, data);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    function setBaseURI(string memory _newBaseURI) public onlyOwner {
        baseURI = _newBaseURI;
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721AUpgradeable, IERC721AUpgradeable)
        returns (string memory)
    {
        if (!_exists(tokenId)) {
            revert __3XP__NotExists();
        }
        return string(abi.encodePacked(baseURI, tokenId.toString()));
    }

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

    function setRoyaltyInfo(
        address receiver,
        uint96 feeBasisPoints
    ) external onlyDevMultiSig {
        _setDefaultRoyalty(receiver, feeBasisPoints);
    }

    function burnMany(uint256[] memory tokenIds) public {
        uint256 n = tokenIds.length;
        for (uint256 i = 0; i < n; ++i) {
            address to = ownerOf(tokenIds[i]);
            if (to != _msgSenderERC721A()) {
                revert __3XP__NotTokenOwner();
            }

            _burn(tokenIds[i], true);
        }
    }

    /*
        MINT
    */
    modifier onlyMinter() {
        if (!minters[_msgSender()]) {
            revert __3XP__NotMinter();
        }
        _;
    }

    function mint(
        address to,
        uint256 amount
    ) external onlyMinter returns (uint256 nextTokenId, uint256) {
        _mint(to, amount);
        return (_nextTokenId(), amount);
    }

    // Owner functions
    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
    }

    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
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
}
