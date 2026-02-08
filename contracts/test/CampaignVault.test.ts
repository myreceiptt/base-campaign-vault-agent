import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const ONE_USDC = 1_000_000n;

describe("CampaignVault", function () {
  it("creates, deposits, delivers, releases (fee)", async function () {
    const [advertiser, publisher, treasury] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const CampaignVault = await ethers.getContractFactory("CampaignVault");
    const vault = await CampaignVault.deploy(await usdc.getAddress(), treasury.address, 200);

    await usdc.mint(advertiser.address, 1000n * ONE_USDC);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const createTx = await vault
      .connect(advertiser)
      .createCampaign(publisher.address, 100n * ONE_USDC, deadline, ethers.ZeroHash);
    const receipt = await createTx.wait();
    const event = receipt?.logs
      .map((l) => vault.interface.parseLog(l))
      .find((e) => e?.name === "CampaignCreated");
    const campaignId = event?.args?.campaignId as bigint;

    await usdc.connect(advertiser).approve(await vault.getAddress(), 100n * ONE_USDC);
    await expect(vault.connect(advertiser).deposit(campaignId)).to.emit(vault, "Deposited");

    await expect(vault.connect(publisher).markDelivered(campaignId, ethers.id("proof"))).to.emit(
      vault,
      "Delivered",
    );

    const treasuryBefore = await usdc.balanceOf(treasury.address);
    const publisherBefore = await usdc.balanceOf(publisher.address);

    await expect(vault.connect(advertiser).release(campaignId)).to.emit(vault, "Released");

    const fee = (100n * ONE_USDC * 200n) / 10_000n;
    const payout = 100n * ONE_USDC - fee;

    expect(await usdc.balanceOf(treasury.address)).to.equal(treasuryBefore + fee);
    expect(await usdc.balanceOf(publisher.address)).to.equal(publisherBefore + payout);
  });

  it("refunds after deadline if not delivered", async function () {
    const [advertiser, publisher, treasury] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const CampaignVault = await ethers.getContractFactory("CampaignVault");
    const vault = await CampaignVault.deploy(await usdc.getAddress(), treasury.address, 0);

    await usdc.mint(advertiser.address, 10n * ONE_USDC);

    const now = await time.latest();
    const deadline = now + 5;
    const tx = await vault
      .connect(advertiser)
      .createCampaign(publisher.address, 5n * ONE_USDC, deadline, ethers.ZeroHash);
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map((l) => vault.interface.parseLog(l))
      .find((e) => e?.name === "CampaignCreated");
    const campaignId = event?.args?.campaignId as bigint;

    await usdc.connect(advertiser).approve(await vault.getAddress(), 5n * ONE_USDC);
    await vault.connect(advertiser).deposit(campaignId);

    await time.increaseTo(deadline + 1);

    await expect(vault.connect(advertiser).refund(campaignId)).to.emit(vault, "Refunded");
  });

  it("reverts deposit when publisher is not assigned", async function () {
    const [advertiser, treasury] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const CampaignVault = await ethers.getContractFactory("CampaignVault");
    const vault = await CampaignVault.deploy(await usdc.getAddress(), treasury.address, 0);

    await usdc.mint(advertiser.address, 10n * ONE_USDC);

    const now = await time.latest();
    const deadline = now + 3600;
    const tx = await vault
      .connect(advertiser)
      .createCampaign(ethers.ZeroAddress, 5n * ONE_USDC, deadline, ethers.ZeroHash);
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map((l) => vault.interface.parseLog(l))
      .find((e) => e?.name === "CampaignCreated");
    const campaignId = event?.args?.campaignId as bigint;

    await usdc.connect(advertiser).approve(await vault.getAddress(), 5n * ONE_USDC);

    await expect(vault.connect(advertiser).deposit(campaignId))
      .to.be.revertedWithCustomError(vault, "InvalidAddress");
  });

  it("reverts markDelivered when called by non-publisher", async function () {
    const [advertiser, publisher, attacker, treasury] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const CampaignVault = await ethers.getContractFactory("CampaignVault");
    const vault = await CampaignVault.deploy(await usdc.getAddress(), treasury.address, 0);

    await usdc.mint(advertiser.address, 10n * ONE_USDC);

    const now = await time.latest();
    const deadline = now + 3600;
    const tx = await vault
      .connect(advertiser)
      .createCampaign(publisher.address, 5n * ONE_USDC, deadline, ethers.ZeroHash);
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map((l) => vault.interface.parseLog(l))
      .find((e) => e?.name === "CampaignCreated");
    const campaignId = event?.args?.campaignId as bigint;

    await usdc.connect(advertiser).approve(await vault.getAddress(), 5n * ONE_USDC);
    await vault.connect(advertiser).deposit(campaignId);

    await expect(vault.connect(attacker).markDelivered(campaignId, ethers.id("proof")))
      .to.be.revertedWithCustomError(vault, "Unauthorized");
  });

  it("reverts release before delivered", async function () {
    const [advertiser, publisher, treasury] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const CampaignVault = await ethers.getContractFactory("CampaignVault");
    const vault = await CampaignVault.deploy(await usdc.getAddress(), treasury.address, 0);

    await usdc.mint(advertiser.address, 10n * ONE_USDC);

    const now = await time.latest();
    const deadline = now + 3600;
    const tx = await vault
      .connect(advertiser)
      .createCampaign(publisher.address, 5n * ONE_USDC, deadline, ethers.ZeroHash);
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map((l) => vault.interface.parseLog(l))
      .find((e) => e?.name === "CampaignCreated");
    const campaignId = event?.args?.campaignId as bigint;

    await usdc.connect(advertiser).approve(await vault.getAddress(), 5n * ONE_USDC);
    await vault.connect(advertiser).deposit(campaignId);

    await expect(vault.connect(advertiser).release(campaignId))
      .to.be.revertedWithCustomError(vault, "InvalidStatus");
  });

  it("reverts refund before deadline", async function () {
    const [advertiser, publisher, treasury] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const CampaignVault = await ethers.getContractFactory("CampaignVault");
    const vault = await CampaignVault.deploy(await usdc.getAddress(), treasury.address, 0);

    await usdc.mint(advertiser.address, 10n * ONE_USDC);

    const now = await time.latest();
    const deadline = now + 3600;
    const tx = await vault
      .connect(advertiser)
      .createCampaign(publisher.address, 5n * ONE_USDC, deadline, ethers.ZeroHash);
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map((l) => vault.interface.parseLog(l))
      .find((e) => e?.name === "CampaignCreated");
    const campaignId = event?.args?.campaignId as bigint;

    await usdc.connect(advertiser).approve(await vault.getAddress(), 5n * ONE_USDC);
    await vault.connect(advertiser).deposit(campaignId);

    await expect(vault.connect(advertiser).refund(campaignId))
      .to.be.revertedWithCustomError(vault, "InvalidDeadline");
  });

  it("supports milestone delivery + staged release with exact fee accounting", async function () {
    const [advertiser, publisher, treasury] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const CampaignVault = await ethers.getContractFactory("CampaignVault");
    const vault = await CampaignVault.deploy(await usdc.getAddress(), treasury.address, 200);

    await usdc.mint(advertiser.address, 1_000n * ONE_USDC);

    const now = await time.latest();
    const deadline = now + 3600;
    const budget = 100n * ONE_USDC;
    const tx = await vault
      .connect(advertiser)
      .createCampaignWithMilestones(publisher.address, budget, deadline, ethers.ZeroHash, 3);
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map((l) => vault.interface.parseLog(l))
      .find((e) => e?.name === "CampaignCreated");
    const campaignId = event?.args?.campaignId as bigint;

    await usdc.connect(advertiser).approve(await vault.getAddress(), budget);
    await vault.connect(advertiser).deposit(campaignId);

    await expect(vault.connect(advertiser).releaseMilestone(campaignId))
      .to.be.revertedWithCustomError(vault, "MilestoneNotDelivered");

    await vault.connect(publisher).markMilestoneDelivered(campaignId, ethers.id("proof-1"), 1);

    const treasuryBefore = await usdc.balanceOf(treasury.address);
    const publisherBefore = await usdc.balanceOf(publisher.address);

    await vault.connect(advertiser).releaseMilestone(campaignId);

    await vault.connect(publisher).markMilestoneDelivered(campaignId, ethers.id("proof-2"), 2);
    await vault.connect(advertiser).releaseMilestone(campaignId);

    await vault.connect(publisher).markMilestoneDelivered(campaignId, ethers.id("proof-3"), 3);
    await vault.connect(advertiser).releaseMilestone(campaignId);

    const campaign = await vault.campaigns(campaignId);
    expect(campaign.status).to.equal(4); // RELEASED
    expect(campaign.milestoneCount).to.equal(3);
    expect(campaign.deliveredMilestones).to.equal(3);
    expect(campaign.releasedMilestones).to.equal(3);
    expect(campaign.releasedAmount).to.equal(budget);
    expect(campaign.feePaid).to.equal((budget * 200n) / 10_000n);

    const expectedFee = (budget * 200n) / 10_000n;
    const expectedPayout = budget - expectedFee;
    expect(await usdc.balanceOf(treasury.address)).to.equal(treasuryBefore + expectedFee);
    expect(await usdc.balanceOf(publisher.address)).to.equal(publisherBefore + expectedPayout);
  });

  it("refunds only remaining budget after partial milestone releases", async function () {
    const [advertiser, publisher, treasury] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const CampaignVault = await ethers.getContractFactory("CampaignVault");
    const vault = await CampaignVault.deploy(await usdc.getAddress(), treasury.address, 200);

    const budget = 10n * ONE_USDC;
    await usdc.mint(advertiser.address, budget);

    const now = await time.latest();
    const deadline = now + 3600;
    const tx = await vault
      .connect(advertiser)
      .createCampaignWithMilestones(publisher.address, budget, deadline, ethers.ZeroHash, 2);
    const receipt = await tx.wait();
    const event = receipt?.logs
      .map((l) => vault.interface.parseLog(l))
      .find((e) => e?.name === "CampaignCreated");
    const campaignId = event?.args?.campaignId as bigint;

    await usdc.connect(advertiser).approve(await vault.getAddress(), budget);
    await vault.connect(advertiser).deposit(campaignId);

    await vault.connect(publisher).markMilestoneDelivered(campaignId, ethers.id("proof-1"), 1);
    await vault.connect(advertiser).releaseMilestone(campaignId);

    await time.increaseTo(deadline + 1);
    await expect(vault.connect(advertiser).refund(campaignId)).to.emit(vault, "Refunded");

    const campaign = await vault.campaigns(campaignId);
    expect(campaign.status).to.equal(5); // REFUNDED
    expect(campaign.releasedMilestones).to.equal(1);

    const remainingBudget = budget / 2n;
    expect(await usdc.balanceOf(advertiser.address)).to.equal(remainingBudget);
  });
});
