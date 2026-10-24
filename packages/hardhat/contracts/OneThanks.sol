// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @notice Testnet thank-you escrow. GitHub ownership is attested by a trusted signer.
contract OneThanks is ReentrancyGuard {
    enum Status {
        Pending,
        Claimed,
        Refunded
    }
    struct Thanks {
        address sender;
        uint64 githubId;
        uint256 amount;
        uint256 refundAt;
        Status status;
        string message;
        string githubLogin;
    }

    address public immutable signer;
    uint256 public immutable refundAfter;
    uint256 public thanksCount;
    mapping(uint256 => Thanks) public thanks;
    mapping(uint64 => uint256) public claimNonce;
    mapping(uint64 => uint256[]) private authorIds;

    error InvalidInput();
    error NotPending();
    error Expired();
    error InvalidSignature();
    error RefundUnavailable();
    error TransferFailed();

    event ThanksSent(
        uint256 indexed id,
        uint64 indexed githubId,
        address indexed sender,
        uint256 amount,
        uint256 refundAt
    );
    event ThanksClaimed(uint256 indexed id, uint64 indexed githubId, address indexed to, uint256 amount);
    event ThanksRefunded(uint256 indexed id, address indexed sender, uint256 amount);

    constructor(address signer_, uint256 refundAfter_) {
        if (signer_ == address(0) || refundAfter_ == 0) revert InvalidInput();
        signer = signer_;
        refundAfter = refundAfter_;
    }

    function sendThanks(
        uint64 githubId,
        string calldata githubLogin,
        string calldata message
    ) external payable nonReentrant returns (uint256 id) {
        if (
            githubId == 0 ||
            msg.value < 0.0001 ether ||
            bytes(message).length == 0 ||
            bytes(message).length > 280 ||
            bytes(githubLogin).length == 0 ||
            bytes(githubLogin).length > 39
        ) revert InvalidInput();
        id = ++thanksCount;
        uint256 refundAt = block.timestamp + refundAfter;
        thanks[id] = Thanks(msg.sender, githubId, msg.value, refundAt, Status.Pending, message, githubLogin);
        authorIds[githubId].push(id);
        emit ThanksSent(id, githubId, msg.sender, msg.value, refundAt);
    }

    function claim(uint256 id, address to, uint256 deadline, bytes calldata sig) external nonReentrant {
        Thanks storage card = thanks[id];
        if (card.sender == address(0) || card.status != Status.Pending) revert NotPending();
        if (to == address(0)) revert InvalidInput();
        if (block.timestamp >= card.refundAt || block.timestamp >= deadline || deadline > card.refundAt)
            revert Expired();
        bytes32 digest = keccak256(
            abi.encode(block.chainid, address(this), id, card.githubId, to, claimNonce[card.githubId], deadline)
        );
        if (ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(digest), sig) != signer) revert InvalidSignature();
        card.status = Status.Claimed;
        ++claimNonce[card.githubId];
        (bool ok, ) = to.call{ value: card.amount }("");
        if (!ok) revert TransferFailed();
        emit ThanksClaimed(id, card.githubId, to, card.amount);
    }

    function refund(uint256 id) external nonReentrant {
        Thanks storage card = thanks[id];
        if (card.sender == address(0) || card.status != Status.Pending) revert NotPending();
        if (msg.sender != card.sender || block.timestamp < card.refundAt) revert RefundUnavailable();
        card.status = Status.Refunded;
        (bool ok, ) = card.sender.call{ value: card.amount }("");
        if (!ok) revert TransferFailed();
        emit ThanksRefunded(id, card.sender, card.amount);
    }

    /// @notice Offset counts from the newest card. No funds operation iterates history.
    function getIds(uint64 githubId, uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        if (limit == 0 || limit > 20) revert InvalidInput();
        uint256 length = authorIds[githubId].length;
        if (offset >= length) return new uint256[](0);
        uint256 count = length - offset;
        if (count > limit) count = limit;
        ids = new uint256[](count);
        for (uint256 i; i < count; ++i) ids[i] = authorIds[githubId][length - offset - i - 1];
    }
}
