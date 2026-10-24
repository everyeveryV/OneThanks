// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { OneThanks } from "../OneThanks.sol";

contract PayoutReceiver {
    OneThanks public escrow;
    uint256 public cardId;
    bool public rejectPayment;
    bool public reentrySucceeded;

    constructor(OneThanks target_) {
        escrow = target_;
    }
    function send() external payable {
        cardId = escrow.sendThanks{ value: msg.value }(42, "alice", "Thank you");
    }
    function setReject(bool reject_) external {
        rejectPayment = reject_;
    }
    function refund() external {
        escrow.refund(cardId);
    }
    receive() external payable {
        require(!rejectPayment, "Payment rejected");
        (reentrySucceeded, ) = address(escrow).call(abi.encodeCall(escrow.refund, (cardId)));
    }
}
