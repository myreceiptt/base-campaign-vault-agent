// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CampaignVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_MILESTONE_COUNT = 20;
    uint16 public constant MAX_ENS_NAME_LENGTH = 64;

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
        uint16 milestoneCount;
        uint16 deliveredMilestones;
        uint16 releasedMilestones;
        uint256 releasedAmount;
        uint256 feePaid;
    }

    IERC20 public immutable usdc;
    address public treasury;
    uint16 public feeBps;

    uint256 public nextCampaignId = 1;
    mapping(uint256 campaignId => Campaign) public campaigns;
    mapping(uint256 campaignId => mapping(uint16 milestoneIndex => bytes32 proofHash)) public milestoneProofs;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed advertiser,
        address indexed publisher,
        uint256 budget,
        uint64 deadline,
        bytes32 metadataHash
    );
    event MilestonesConfigured(uint256 indexed campaignId, uint16 milestoneCount);
    event PublisherAssigned(uint256 indexed campaignId, address indexed publisher);
    event Deposited(uint256 indexed campaignId, address indexed advertiser, uint256 amount);
    event Delivered(uint256 indexed campaignId, address indexed publisher, bytes32 proofHash);
    event EnsTagged(uint256 indexed campaignId, address indexed actor, bytes4 indexed action, string ensName);
    event MilestoneDelivered(
        uint256 indexed campaignId, address indexed publisher, uint16 indexed milestoneIndex, bytes32 proofHash
    );
    event MilestoneReleased(
        uint256 indexed campaignId,
        address indexed advertiser,
        address indexed publisher,
        uint16 milestoneIndex,
        uint256 grossAmount,
        uint256 payout,
        uint256 fee
    );
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
    error InvalidMilestoneCount();
    error InvalidMilestoneIndex();
    error MilestoneNotDelivered(uint16 expected, uint16 actual);
    error NothingToRelease();
    error InvalidEnsName();

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
        return _createCampaign(publisher, budget, deadline, metadataHash, 1);
    }

    function createCampaignWithEns(
        address publisher,
        uint256 budget,
        uint64 deadline,
        bytes32 metadataHash,
        string calldata advertiserEnsName
    ) external returns (uint256 campaignId) {
        campaignId = _createCampaign(publisher, budget, deadline, metadataHash, 1);
        _emitEnsTagged(campaignId, this.createCampaign.selector, advertiserEnsName);
    }

    function createCampaignWithMilestones(
        address publisher,
        uint256 budget,
        uint64 deadline,
        bytes32 metadataHash,
        uint16 milestoneCount
    ) external returns (uint256 campaignId) {
        return _createCampaign(publisher, budget, deadline, metadataHash, milestoneCount);
    }

    function createCampaignWithMilestonesAndEns(
        address publisher,
        uint256 budget,
        uint64 deadline,
        bytes32 metadataHash,
        uint16 milestoneCount,
        string calldata advertiserEnsName
    ) external returns (uint256 campaignId) {
        campaignId = _createCampaign(publisher, budget, deadline, metadataHash, milestoneCount);
        _emitEnsTagged(campaignId, this.createCampaignWithMilestones.selector, advertiserEnsName);
    }

    function assignPublisher(uint256 campaignId, address publisher) external {
        _assignPublisher(campaignId, publisher);
    }

    function assignPublisherWithEns(uint256 campaignId, address publisher, string calldata advertiserEnsName) external {
        _assignPublisher(campaignId, publisher);
        _emitEnsTagged(campaignId, this.assignPublisher.selector, advertiserEnsName);
    }

    function deposit(uint256 campaignId) external nonReentrant {
        _deposit(campaignId);
    }

    function depositWithEns(uint256 campaignId, string calldata advertiserEnsName) external nonReentrant {
        _deposit(campaignId);
        _emitEnsTagged(campaignId, this.deposit.selector, advertiserEnsName);
    }

    function markDelivered(uint256 campaignId, bytes32 proofHash) external {
        _markDelivered(campaignId, proofHash);
    }

    function markDeliveredWithEns(uint256 campaignId, bytes32 proofHash, string calldata publisherEnsName) external {
        _markDelivered(campaignId, proofHash);
        _emitEnsTagged(campaignId, this.markDelivered.selector, publisherEnsName);
    }

    function release(uint256 campaignId) external nonReentrant {
        _release(campaignId);
    }

    function releaseWithEns(uint256 campaignId, string calldata advertiserEnsName) external nonReentrant {
        _release(campaignId);
        _emitEnsTagged(campaignId, this.release.selector, advertiserEnsName);
    }

    function markMilestoneDelivered(uint256 campaignId, bytes32 proofHash, uint16 milestoneIndex) external {
        _markMilestoneDeliveredExplicit(campaignId, proofHash, milestoneIndex);
    }

    function markMilestoneDeliveredWithEns(
        uint256 campaignId,
        bytes32 proofHash,
        uint16 milestoneIndex,
        string calldata publisherEnsName
    ) external {
        _markMilestoneDeliveredExplicit(campaignId, proofHash, milestoneIndex);
        _emitEnsTagged(campaignId, this.markMilestoneDelivered.selector, publisherEnsName);
    }

    function releaseMilestone(uint256 campaignId) external nonReentrant {
        _releaseMilestone(campaignId);
    }

    function releaseMilestoneWithEns(uint256 campaignId, string calldata advertiserEnsName) external nonReentrant {
        _releaseMilestone(campaignId);
        _emitEnsTagged(campaignId, this.releaseMilestone.selector, advertiserEnsName);
    }

    function refund(uint256 campaignId) external nonReentrant {
        _refund(campaignId);
    }

    function refundWithEns(uint256 campaignId, string calldata advertiserEnsName) external nonReentrant {
        _refund(campaignId);
        _emitEnsTagged(campaignId, this.refund.selector, advertiserEnsName);
    }

    function getMilestoneState(uint256 campaignId)
        external
        view
        returns (
            uint16 milestoneCount,
            uint16 deliveredMilestones,
            uint16 releasedMilestones,
            uint256 releasedAmount,
            uint256 remainingAmount
        )
    {
        Campaign storage c = campaigns[campaignId];
        milestoneCount = c.milestoneCount;
        deliveredMilestones = c.deliveredMilestones;
        releasedMilestones = c.releasedMilestones;
        releasedAmount = c.releasedAmount;
        remainingAmount = _remainingBudget(c);
    }

    function _createCampaign(address publisher, uint256 budget, uint64 deadline, bytes32 metadataHash, uint16 milestoneCount)
        internal
        returns (uint256 campaignId)
    {
        // publisher can be address(0) - will be assigned later via assignPublisher
        if (budget == 0) revert InvalidBudget();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (milestoneCount == 0 || milestoneCount > MAX_MILESTONE_COUNT) revert InvalidMilestoneCount();

        campaignId = nextCampaignId++;
        campaigns[campaignId] = Campaign({
            advertiser: msg.sender,
            publisher: publisher,
            budget: budget,
            deadline: deadline,
            status: Status.CREATED,
            metadataHash: metadataHash,
            proofHash: bytes32(0),
            milestoneCount: milestoneCount,
            deliveredMilestones: 0,
            releasedMilestones: 0,
            releasedAmount: 0,
            feePaid: 0
        });

        emit CampaignCreated(campaignId, msg.sender, publisher, budget, deadline, metadataHash);
        emit MilestonesConfigured(campaignId, milestoneCount);
    }

    function _emitEnsTagged(uint256 campaignId, bytes4 action, string calldata ensName) internal {
        uint256 len = bytes(ensName).length;
        if (len == 0) return;
        if (len > MAX_ENS_NAME_LENGTH) revert InvalidEnsName();
        emit EnsTagged(campaignId, msg.sender, action, ensName);
    }

    function _assignPublisher(uint256 campaignId, address publisher) internal {
        Campaign storage c = campaigns[campaignId];
        if (c.status != Status.CREATED) revert InvalidStatus(Status.CREATED, c.status);
        if (msg.sender != c.advertiser) revert Unauthorized();
        if (publisher == address(0)) revert InvalidAddress();
        if (c.publisher != address(0)) revert PublisherAlreadyAssigned();

        c.publisher = publisher;
        emit PublisherAssigned(campaignId, publisher);
    }

    function _deposit(uint256 campaignId) internal {
        Campaign storage c = campaigns[campaignId];
        if (c.status != Status.CREATED) revert InvalidStatus(Status.CREATED, c.status);
        if (msg.sender != c.advertiser) revert Unauthorized();
        if (c.publisher == address(0)) revert InvalidAddress(); // Publisher must be assigned before deposit

        c.status = Status.DEPOSITED;
        usdc.safeTransferFrom(msg.sender, address(this), c.budget);

        emit Deposited(campaignId, msg.sender, c.budget);
    }

    function _markDelivered(uint256 campaignId, bytes32 proofHash) internal {
        Campaign storage c = campaigns[campaignId];
        if (c.milestoneCount > 1) {
            _markMilestoneDelivered(campaignId, c, proofHash, c.deliveredMilestones + 1);
            return;
        }
        if (c.status != Status.DEPOSITED) revert InvalidStatus(Status.DEPOSITED, c.status);
        if (msg.sender != c.publisher) revert Unauthorized();

        c.status = Status.DELIVERED;
        c.proofHash = proofHash;
        c.deliveredMilestones = 1;
        milestoneProofs[campaignId][1] = proofHash;

        emit MilestoneDelivered(campaignId, msg.sender, 1, proofHash);
        emit Delivered(campaignId, msg.sender, proofHash);
    }

    function _markMilestoneDeliveredExplicit(uint256 campaignId, bytes32 proofHash, uint16 milestoneIndex) internal {
        Campaign storage c = campaigns[campaignId];
        if (c.milestoneCount <= 1) revert InvalidMilestoneCount();
        _markMilestoneDelivered(campaignId, c, proofHash, milestoneIndex);
    }

    function _release(uint256 campaignId) internal {
        Campaign storage c = campaigns[campaignId];
        if (msg.sender != c.advertiser) revert Unauthorized();
        if (c.status != Status.DELIVERED) revert InvalidStatus(Status.DELIVERED, c.status);
        if (c.releasedAmount >= c.budget) revert NothingToRelease();

        uint16 milestoneIndex = c.milestoneCount;
        uint256 grossAmount = _remainingBudget(c);
        (uint256 payout, uint256 fee) = _releaseAmount(campaignId, c, milestoneIndex, grossAmount);
        c.releasedMilestones = c.milestoneCount;
        c.status = Status.RELEASED;

        emit Released(campaignId, msg.sender, c.publisher, payout, fee);
    }

    function _releaseMilestone(uint256 campaignId) internal {
        Campaign storage c = campaigns[campaignId];
        if (c.milestoneCount <= 1) revert InvalidMilestoneCount();
        if (msg.sender != c.advertiser) revert Unauthorized();
        if (c.status != Status.DEPOSITED && c.status != Status.DELIVERED) {
            revert InvalidStatus(Status.DEPOSITED, c.status);
        }
        if (c.releasedMilestones >= c.milestoneCount) revert NothingToRelease();

        uint16 nextMilestone = c.releasedMilestones + 1;
        if (c.deliveredMilestones < nextMilestone) {
            revert MilestoneNotDelivered(nextMilestone, c.deliveredMilestones);
        }

        uint256 grossAmount = _milestoneAmount(c, nextMilestone);
        _releaseAmount(campaignId, c, nextMilestone, grossAmount);

        c.releasedMilestones = nextMilestone;
        if (nextMilestone == c.milestoneCount) {
            c.status = Status.RELEASED;
        }
    }

    function _refund(uint256 campaignId) internal {
        Campaign storage c = campaigns[campaignId];
        if (c.status != Status.DEPOSITED) revert InvalidStatus(Status.DEPOSITED, c.status);
        if (msg.sender != c.advertiser) revert Unauthorized();
        if (block.timestamp <= c.deadline) revert InvalidDeadline();
        uint256 remaining = _remainingBudget(c);
        if (remaining == 0) revert NothingToRelease();

        c.status = Status.REFUNDED;
        usdc.safeTransfer(c.advertiser, remaining);

        emit Refunded(campaignId, msg.sender, remaining);
    }

    function _markMilestoneDelivered(uint256 campaignId, Campaign storage c, bytes32 proofHash, uint16 milestoneIndex)
        internal
    {
        if (c.status != Status.DEPOSITED) revert InvalidStatus(Status.DEPOSITED, c.status);
        if (msg.sender != c.publisher) revert Unauthorized();
        if (milestoneIndex == 0 || milestoneIndex > c.milestoneCount) revert InvalidMilestoneIndex();
        if (milestoneIndex != c.deliveredMilestones + 1) revert InvalidMilestoneIndex();

        c.deliveredMilestones = milestoneIndex;
        c.proofHash = proofHash;
        milestoneProofs[campaignId][milestoneIndex] = proofHash;
        if (milestoneIndex == c.milestoneCount) {
            c.status = Status.DELIVERED;
        }

        emit MilestoneDelivered(campaignId, msg.sender, milestoneIndex, proofHash);
        if (milestoneIndex == c.milestoneCount) {
            emit Delivered(campaignId, msg.sender, proofHash);
        }
    }

    function _releaseAmount(uint256 campaignId, Campaign storage c, uint16 milestoneIndex, uint256 grossAmount)
        internal
        returns (uint256 payout, uint256 fee)
    {
        if (grossAmount == 0) revert NothingToRelease();

        uint256 newReleasedAmount = c.releasedAmount + grossAmount;
        uint256 cumulativeFee = (newReleasedAmount * feeBps) / 10_000;
        fee = cumulativeFee - c.feePaid;
        payout = grossAmount - fee;

        c.releasedAmount = newReleasedAmount;
        c.feePaid = cumulativeFee;

        if (fee > 0) usdc.safeTransfer(treasury, fee);
        if (payout > 0) usdc.safeTransfer(c.publisher, payout);

        emit MilestoneReleased(campaignId, msg.sender, c.publisher, milestoneIndex, grossAmount, payout, fee);
    }

    function _milestoneAmount(Campaign storage c, uint16 milestoneIndex) internal view returns (uint256) {
        if (milestoneIndex == c.milestoneCount) {
            return _remainingBudget(c);
        }
        return c.budget / c.milestoneCount;
    }

    function _remainingBudget(Campaign storage c) internal view returns (uint256) {
        return c.budget - c.releasedAmount;
    }
}
