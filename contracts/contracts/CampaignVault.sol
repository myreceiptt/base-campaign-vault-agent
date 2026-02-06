// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CampaignVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        NONE,
        CREATED,
        DEPOSITED,
        DELIVERED,
        RELEASED,
        REFUNDED
    }

    struct Campaign {
        address advertiser;
        address publisher;
        uint256 budget;
        uint64 deadline;
        Status status;
        bytes32 metadataHash;
        bytes32 proofHash;
    }

    IERC20 public immutable usdc;
    address public treasury;
    uint16 public feeBps;

    uint256 public nextCampaignId = 1;
    mapping(uint256 campaignId => Campaign) public campaigns;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed advertiser,
        address indexed publisher,
        uint256 budget,
        uint64 deadline,
        bytes32 metadataHash
    );
    event PublisherAssigned(uint256 indexed campaignId, address indexed publisher);
    event Deposited(uint256 indexed campaignId, address indexed advertiser, uint256 amount);
    event Delivered(uint256 indexed campaignId, address indexed publisher, bytes32 proofHash);
    event Released(
        uint256 indexed campaignId,
        address indexed advertiser,
        address indexed publisher,
        uint256 payout,
        uint256 fee
    );
    event Refunded(uint256 indexed campaignId, address indexed advertiser, uint256 amount);

    error InvalidAddress();
    error InvalidBudget();
    error InvalidDeadline();
    error InvalidFeeBps();
    error Unauthorized();
    error InvalidStatus(Status expected, Status actual);
    error PublisherAlreadyAssigned();

    constructor(address usdc_, address treasury_, uint16 feeBps_) {
        if (usdc_ == address(0) || treasury_ == address(0)) revert InvalidAddress();
        if (feeBps_ > 10_000) revert InvalidFeeBps();
        usdc = IERC20(usdc_);
        treasury = treasury_;
        feeBps = feeBps_;
    }

    function createCampaign(
        address publisher,
        uint256 budget,
        uint64 deadline,
        bytes32 metadataHash
    ) external returns (uint256 campaignId) {
        // publisher can be address(0) - will be assigned later via assignPublisher
        if (budget == 0) revert InvalidBudget();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        campaignId = nextCampaignId++;
        campaigns[campaignId] = Campaign({
            advertiser: msg.sender,
            publisher: publisher,
            budget: budget,
            deadline: deadline,
            status: Status.CREATED,
            metadataHash: metadataHash,
            proofHash: bytes32(0)
        });

        emit CampaignCreated(campaignId, msg.sender, publisher, budget, deadline, metadataHash);
    }

    function assignPublisher(uint256 campaignId, address publisher) external {
        Campaign storage c = campaigns[campaignId];
        if (c.status != Status.CREATED) revert InvalidStatus(Status.CREATED, c.status);
        if (msg.sender != c.advertiser) revert Unauthorized();
        if (publisher == address(0)) revert InvalidAddress();
        if (c.publisher != address(0)) revert PublisherAlreadyAssigned();

        c.publisher = publisher;
        emit PublisherAssigned(campaignId, publisher);
    }

    function deposit(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (c.status != Status.CREATED) revert InvalidStatus(Status.CREATED, c.status);
        if (msg.sender != c.advertiser) revert Unauthorized();
        if (c.publisher == address(0)) revert InvalidAddress(); // Publisher must be assigned before deposit

        c.status = Status.DEPOSITED;
        usdc.safeTransferFrom(msg.sender, address(this), c.budget);

        emit Deposited(campaignId, msg.sender, c.budget);
    }

    function markDelivered(uint256 campaignId, bytes32 proofHash) external {
        Campaign storage c = campaigns[campaignId];
        if (c.status != Status.DEPOSITED) revert InvalidStatus(Status.DEPOSITED, c.status);
        if (msg.sender != c.publisher) revert Unauthorized();

        c.status = Status.DELIVERED;
        c.proofHash = proofHash;

        emit Delivered(campaignId, msg.sender, proofHash);
    }

    function release(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (c.status != Status.DELIVERED) revert InvalidStatus(Status.DELIVERED, c.status);
        if (msg.sender != c.advertiser) revert Unauthorized();

        c.status = Status.RELEASED;

        uint256 fee = (c.budget * feeBps) / 10_000;
        uint256 payout = c.budget - fee;

        if (fee > 0) usdc.safeTransfer(treasury, fee);
        usdc.safeTransfer(c.publisher, payout);

        emit Released(campaignId, msg.sender, c.publisher, payout, fee);
    }

    function refund(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (c.status != Status.DEPOSITED) revert InvalidStatus(Status.DEPOSITED, c.status);
        if (msg.sender != c.advertiser) revert Unauthorized();
        if (block.timestamp <= c.deadline) revert InvalidDeadline();

        c.status = Status.REFUNDED;
        usdc.safeTransfer(c.advertiser, c.budget);

        emit Refunded(campaignId, msg.sender, c.budget);
    }
}
