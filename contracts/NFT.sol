// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "hardhat/console.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "erc721a/contracts/extensions/ERC721AQueryable.sol";
import "operator-filter-registry/src/DefaultOperatorFilterer.sol";

error SetDevMultiSigToZeroAddress();
error NotTokenOwner();
error NotExists();
error NoETHLeft();
error ETHTransferFailed();
error NotMinter();

contract NFT is Ownable, ERC721AQueryable, DefaultOperatorFilterer, ERC2981 {
    using Strings for uint256;

    string private baseURI;
    address internal _devMultiSigWallet;

    mapping(address => bool) public minters;

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _initBaseURI,
        address devMultiSigWallet_,
        uint96 royalty_
    ) ERC721A(_name, _symbol) {
        _devMultiSigWallet = devMultiSigWallet_;
        setBaseURI(_initBaseURI);
        _setDefaultRoyalty(devMultiSigWallet_, royalty_);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721A, IERC721A, ERC2981) returns (bool) {
        return
            ERC721A.supportsInterface(interfaceId) ||
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
    ) public payable override(ERC721A, IERC721A) onlyAllowedOperator(from) {
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
    ) public payable override(ERC721A, IERC721A) onlyAllowedOperator(from) {
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
    ) public payable override(ERC721A, IERC721A) onlyAllowedOperator(from) {
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
    ) public view override(ERC721A, IERC721A) returns (string memory) {
        if (!_exists(tokenId)) {
            revert NotExists();
        }
        return string(abi.encodePacked(baseURI, tokenId.toString()));
    }

    /*
        BACK OFFICE
    */
    function setDevMultiSigAddress(
        address payable _address
    ) external onlyOwner {
        if (_address == address(0)) revert SetDevMultiSigToZeroAddress();
        _devMultiSigWallet = _address;
    }

    function setRoyaltyInfo(
        address receiver,
        uint96 feeBasisPoints
    ) external onlyOwner {
        _setDefaultRoyalty(receiver, feeBasisPoints);
    }

    function burnMany(uint256[] memory tokenIds) public {
        uint256 n = tokenIds.length;
        for (uint256 i = 0; i < n; ++i) {
            address to = ownerOf(tokenIds[i]);
            if (to != _msgSenderERC721A()) {
                revert NotTokenOwner();
            }

            _burn(tokenIds[i], true);
        }
    }

    /*
        MINT
    */
    modifier onlyMinter() {
        if (!minters[_msgSender()]) {
            revert NotMinter();
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

    function withdrawETHBalanceToDev() public onlyOwner {
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
