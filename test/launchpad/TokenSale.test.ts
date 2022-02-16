/* eslint-disable no-unused-expressions */
/* eslint-disable node/no-missing-import */
/* eslint-disable node/no-unsupported-features/es-syntax */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { ERC20, TokenSale } from "../../typechain";
import {
  addressZero,
  getAmount,
  ConfigureTokenSaleParams,
  configureTokenSale,
  getRandomAddress,
  verifyTokenSaleData,
  verifyInvestorAmounts,
  getNow,
  increaseTime,
} from "../test-utils";

describe("TokenSale", () => {
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let signer1: SignerWithAddress;
  let signer2: SignerWithAddress;
  let signer3: SignerWithAddress;
  let signer4: SignerWithAddress;

  let tokenSale: TokenSale;
  let erc20: ERC20;

  let configureTokenSaleParams: ConfigureTokenSaleParams;

  before(async () => {
    [owner, admin, signer1, signer2, signer3, signer4] =
      await ethers.getSigners();
  });

  beforeEach(async () => {
    const tokenSaleFactory_ = await ethers.getContractFactory(
      "TokenSaleFactory"
    );
    const tokenSaleFactory = await tokenSaleFactory_.deploy();
    await tokenSaleFactory.deployed();

    const tokenSale_ = await ethers.getContractFactory("TokenSale");
    tokenSale = await tokenSale_.deploy();
    await tokenSale.deployed();

    const erc20_ = await ethers.getContractFactory("ERC20");
    erc20 = await erc20_.deploy("Test", "TEST");
    await erc20.deployed();

    const now = await getNow();

    configureTokenSaleParams = {
      hardcap: getAmount("20"),
      whitelistSaleTimeFrame: {
        startTime: now,
        endTime: now + 3600 * 1,
      },
      purchaseLevels: [
        getAmount("5"),
        getAmount("10"),
        getAmount("15"),
        getAmount("20"),
        getAmount("25"),
      ],
      purchaseToken: erc20.address,
      status: 1,
    };

    const tx = await tokenSaleFactory.createTokenSale(
      tokenSale.address,
      "GameFi",
      admin.address,
      configureTokenSaleParams.hardcap,
      configureTokenSaleParams.whitelistSaleTimeFrame,
      configureTokenSaleParams.purchaseLevels,
      configureTokenSaleParams.purchaseToken
    );
    const txReceipt = await tx.wait();
    const tokenSaleCreatedEvent = txReceipt.events?.find(
      (event) => event.event === "TokenSaleCreated"
    );
    tokenSale = tokenSale.attach(tokenSaleCreatedEvent?.args?.proxy);
  });

  describe("initialize", () => {
    it("should not be able to initialize once deployed", async () => {
      expect(
        tokenSale.initialize(
          owner.address,
          "GameFi",
          admin.address,
          configureTokenSaleParams.hardcap,
          configureTokenSaleParams.whitelistSaleTimeFrame,
          configureTokenSaleParams.purchaseLevels,
          configureTokenSaleParams.purchaseToken
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("configureTokenSale", () => {
    it("should be able to configure token sale hardcap", async () => {
      const newHardcap = getAmount("20000");
      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          hardcap: getAmount("20000"),
        })
      ).wait();
      expect((await tokenSale.tokenSaleData()).hardcap_).to.equal(newHardcap);
    });

    it("should be able to configure token sale time frames", async () => {
      const newWhitelistSaleTimeFrame = {
        startTime: (await getNow()) + 3600 * 10,
        endTime: (await getNow()) + 3600 * 11,
      };
      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          whitelistSaleTimeFrame: newWhitelistSaleTimeFrame,
        })
      ).wait();

      const tokenSaleData = await tokenSale.tokenSaleData();
      expect(tokenSaleData.whitelistSaleTimeFrame_.startTime).to.equal(
        newWhitelistSaleTimeFrame.startTime.toString()
      );
      expect(tokenSaleData.whitelistSaleTimeFrame_.endTime).to.equal(
        newWhitelistSaleTimeFrame.endTime.toString()
      );
    });

    it("should be able to configure purchase levels", async () => {
      const newPurchaseLevels = [
        getAmount("1"),
        getAmount("2"),
        getAmount("3"),
      ];
      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          purchaseLevels: newPurchaseLevels,
        })
      ).wait();
      expect((await tokenSale.tokenSaleData()).purchaseLevels_).to.deep.equal(
        newPurchaseLevels
      );
    });

    it("should be able to configure status", async () => {
      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          status: 0,
        })
      ).wait();
      expect((await tokenSale.tokenSaleData()).status_.toString()).to.equal(
        "0"
      );

      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          status: 1,
        })
      ).wait();
      expect((await tokenSale.tokenSaleData()).status_.toString()).to.equal(
        "1"
      );
    });

    it("should not be able to configure with incorrect params", async () => {
      // Hardcap is zero
      expect(
        configureTokenSale(tokenSale, configureTokenSaleParams, {
          hardcap: 0,
        })
      ).to.be.revertedWith("TokenSale: hardcap is zero");

      // Whitelist sale start time is 0
      expect(
        configureTokenSale(tokenSale, configureTokenSaleParams, {
          whitelistSaleTimeFrame: {
            startTime: 0,
            endTime: configureTokenSaleParams.whitelistSaleTimeFrame.startTime,
          },
        })
      ).to.be.revertedWith("TokenSale: invalid whitelist sale time frame");

      // Whitelist sale end time is 0
      expect(
        configureTokenSale(tokenSale, configureTokenSaleParams, {
          whitelistSaleTimeFrame: {
            startTime:
              configureTokenSaleParams.whitelistSaleTimeFrame.startTime,
            endTime: 0,
          },
        })
      ).to.be.revertedWith("TokenSale: invalid whitelist sale time frame");

      // Both whitelist sale start and end are 0
      expect(
        configureTokenSale(tokenSale, configureTokenSaleParams, {
          whitelistSaleTimeFrame: {
            startTime: 0,
            endTime: 0,
          },
        })
      ).to.be.revertedWith("TokenSale: invalid whitelist sale time frame");

      // Whitelist sale start time > end time
      expect(
        configureTokenSale(tokenSale, configureTokenSaleParams, {
          whitelistSaleTimeFrame: {
            startTime: configureTokenSaleParams.whitelistSaleTimeFrame.endTime,
            endTime: configureTokenSaleParams.whitelistSaleTimeFrame.startTime,
          },
        })
      ).to.be.revertedWith("TokenSale: invalid whitelist sale time frame");

      // Empty purchase level
      expect(
        configureTokenSale(tokenSale, configureTokenSaleParams, {
          purchaseLevels: [],
        })
      ).to.be.revertedWith("TokenSale: empty purchase levels");

      // Invalid status
      expect(
        configureTokenSale(tokenSale, configureTokenSaleParams, {
          status: 2,
        })
      ).to.be.revertedWith("TokenSale: invalid status");
      expect(
        configureTokenSale(tokenSale, configureTokenSaleParams, {
          status: 3,
        })
      ).to.be.revertedWith("TokenSale: invalid status");
    });

    it("should revert if caller is not the owner", async () => {
      expect(
        configureTokenSale(tokenSale.connect(signer1), configureTokenSaleParams)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("registerInvestors", () => {
    beforeEach(async () => {
      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          whitelistSaleTimeFrame: {
            startTime:
              configureTokenSaleParams.whitelistSaleTimeFrame.startTime +
              3600 * 1,
            endTime:
              configureTokenSaleParams.whitelistSaleTimeFrame.startTime +
              3600 * 2,
          },
        })
      ).wait();
    });

    it("should be able to register investor", async () => {
      const investors = [
        getRandomAddress(),
        getRandomAddress(),
        getRandomAddress(),
      ];
      const whitelistPurchaseLevels = [1, 2, 3];
      await (
        await tokenSale.registerInvestors(investors, whitelistPurchaseLevels)
      ).wait();

      expect(await tokenSale.investorCount()).to.equal(3);
      expect(await tokenSale.investorAddresses(0)).to.equal(investors[0]);
      expect(await tokenSale.investorAddresses(1)).to.equal(investors[1]);
      expect(await tokenSale.investorAddresses(2)).to.equal(investors[2]);

      const [investor0, investor1, investor2] = await Promise.all([
        tokenSale.investors(investors[0]),
        tokenSale.investors(investors[1]),
        tokenSale.investors(investors[2]),
      ]);

      expect(investor0.investor).to.equal(investors[0]);
      expect(investor0.whitelistPurchaseLevel).to.equal(
        whitelistPurchaseLevels[0]
      );

      expect(investor1.investor).to.equal(investors[1]);
      expect(investor1.whitelistPurchaseLevel).to.equal(
        whitelistPurchaseLevels[1]
      );

      expect(investor2.investor).to.equal(investors[2]);
      expect(investor2.whitelistPurchaseLevel).to.equal(
        whitelistPurchaseLevels[2]
      );
    });

    it("should override old data when register investor once sale has not started", async () => {
      const investor = getRandomAddress();
      await (await tokenSale.registerInvestors([investor], [1])).wait();

      const investorBefore = await tokenSale.investors(investor);
      expect(investorBefore.whitelistPurchaseLevel).to.equal(1);

      await (await tokenSale.registerInvestors([investor], [2])).wait();
      const investorAfter = await tokenSale.investors(investor);
      expect(investorAfter.whitelistPurchaseLevel).to.equal(2);

      expect(await tokenSale.investorCount()).to.equal(1);
    });

    it("should not override old data once sale has started and investor is existed", async () => {
      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams)
      ).wait();

      const investor = getRandomAddress();
      await (await tokenSale.registerInvestors([investor], [1])).wait();

      const investorBefore = await tokenSale.investors(investor);
      expect(investorBefore.whitelistPurchaseLevel).to.equal(1);

      await (await tokenSale.registerInvestors([investor], [2])).wait();
      const investorAfter = await tokenSale.investors(investor);
      expect(investorAfter.whitelistPurchaseLevel).to.equal(1);

      expect(await tokenSale.investorCount()).to.equal(1);
    });

    it("should be able to register investor once sale has started but investor is not existed", async () => {
      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams)
      ).wait();

      const investor = getRandomAddress();
      await (await tokenSale.registerInvestors([investor], [1])).wait();

      const investorBefore = await tokenSale.investors(investor);
      expect(investorBefore.investor).to.equal(investor);
      expect(investorBefore.whitelistPurchaseLevel).to.equal(1);
      expect(await tokenSale.investorCount()).to.equal(1);
    });

    it("should revert if params are incorrect", async () => {
      // Lengths do not match
      expect(
        tokenSale.registerInvestors([getRandomAddress()], [1, 2])
      ).to.be.revertedWith("TokenSale: lengths do not match");

      // Investor address is zero
      expect(
        tokenSale.registerInvestors([getRandomAddress(), addressZero], [1, 2])
      ).to.be.revertedWith("TokenSale: investor address is zero");

      // Invalid ưhitelist purchase level (exceed max level)
      expect(
        tokenSale.registerInvestors(
          [getRandomAddress(), getRandomAddress(), getRandomAddress()],
          [6, 1, 2]
        )
      ).to.be.revertedWith("TokenSale: invalid whitelist purchase level");

      // Invalid ưhitelist purchase level (level is zero)
      expect(
        tokenSale.registerInvestors(
          [getRandomAddress(), getRandomAddress(), getRandomAddress()],
          [0, 1, 2]
        )
      ).to.be.revertedWith("TokenSale: invalid whitelist purchase level");
    });

    it("should revert if caller is not the owner", async () => {
      expect(
        tokenSale.connect(signer1).registerInvestors([], [])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("purchaseTokenWhitelistSale", () => {
    beforeEach(async () => {
      const balanceEach = (await erc20.balanceOf(owner.address)).div(4);
      await Promise.all([
        (
          await erc20.connect(signer1).approve(tokenSale.address, balanceEach)
        ).wait(),
        (await erc20.transfer(signer1.address, balanceEach)).wait(),
        (
          await erc20.connect(signer2).approve(tokenSale.address, balanceEach)
        ).wait(),
        (await erc20.transfer(signer2.address, balanceEach)).wait(),
        (
          await erc20.connect(signer3).approve(tokenSale.address, balanceEach)
        ).wait(),
        (await erc20.transfer(signer3.address, balanceEach)).wait(),
        (await configureTokenSale(tokenSale, configureTokenSaleParams)).wait(),
        await tokenSale.registerInvestors(
          [signer1.address, signer2.address, signer3.address],
          [3, 1, 2]
        ),
      ]);
    });

    it("should be able to purchase", async () => {
      const signer1PurchaseAmount = getAmount("10");
      const signer2PurchaseAmount = getAmount("5");

      await Promise.all([
        tokenSale
          .connect(signer1)
          .purchaseTokenWhitelistSale(signer1PurchaseAmount),
        tokenSale
          .connect(signer2)
          .purchaseTokenWhitelistSale(signer2PurchaseAmount),
      ]);

      const [investor1Record, investor2Record] = await Promise.all([
        tokenSale.investors(signer1.address),
        tokenSale.investors(signer2.address),
      ]);

      await verifyTokenSaleData(
        tokenSale,
        erc20,
        signer1PurchaseAmount.add(signer2PurchaseAmount)
      );
      verifyInvestorAmounts(investor1Record, signer1PurchaseAmount);
      verifyInvestorAmounts(investor2Record, signer2PurchaseAmount);
    });

    it("should be able to purchase multiple times until reach max cap", async () => {
      await (
        await tokenSale
          .connect(signer1)
          .purchaseTokenWhitelistSale(getAmount("5"))
      ).wait();
      await (
        await tokenSale
          .connect(signer1)
          .purchaseTokenWhitelistSale(getAmount("10"))
      ).wait();

      const [investorRecord] = await Promise.all([
        tokenSale.investors(signer1.address),
      ]);
      const totalAmount = getAmount("5").add(getAmount("10"));

      await verifyTokenSaleData(tokenSale, erc20, totalAmount);
      verifyInvestorAmounts(investorRecord, totalAmount);

      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("5"))
      ).to.be.revertedWith("TokenSale: exceed maximum investment");
    });

    it("should be able to buy remaining of hardcap", async () => {
      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          hardcap: getAmount("5"),
        })
      ).wait();

      await (
        await tokenSale
          .connect(signer1)
          .purchaseTokenWhitelistSale(getAmount("10"))
      ).wait();

      const [investorRecord] = await Promise.all([
        tokenSale.investors(signer1.address),
      ]);
      const expectedAmount = getAmount("5");

      await verifyTokenSaleData(tokenSale, erc20, expectedAmount);
      verifyInvestorAmounts(investorRecord, expectedAmount);
    });

    it("should be able to buy remaining of personal cap", async () => {
      await (
        await tokenSale
          .connect(signer1)
          .purchaseTokenWhitelistSale(getAmount("5"))
      ).wait();
      await (
        await tokenSale
          .connect(signer1)
          .purchaseTokenWhitelistSale(getAmount("15"))
      ).wait();

      const [investorRecord] = await Promise.all([
        tokenSale.investors(signer1.address),
      ]);
      const expectedAmount = getAmount("15");

      await verifyTokenSaleData(tokenSale, erc20, expectedAmount);
      verifyInvestorAmounts(investorRecord, expectedAmount);
    });

    it("should be able to buy remaining of the combination of personal and hard caps", async () => {
      (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          hardcap: getAmount("15"),
        })
      ).wait();

      await (
        await tokenSale
          .connect(signer3)
          .purchaseTokenWhitelistSale(getAmount("5"))
      ).wait();
      await (
        await tokenSale
          .connect(signer3)
          .purchaseTokenWhitelistSale(getAmount("10"))
      ).wait();

      const [investorRecord] = await Promise.all([
        tokenSale.investors(signer3.address),
      ]);
      const expectedAmount = getAmount("10");

      await verifyTokenSaleData(tokenSale, erc20, expectedAmount);
      verifyInvestorAmounts(investorRecord, expectedAmount);
    });

    it("should emit event on successful purchase", async () => {
      const amount = getAmount("5");
      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("5"))
      )
        .to.emit(tokenSale, "NewInvestment")
        .withArgs(signer1.address, amount, amount);
    });

    it("should revert if token sale is not active", async () => {
      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          status: 0,
        })
      ).wait();

      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("5"))
      ).to.be.revertedWith("TokenSale: inactive");
    });

    it("should revert if hardcap is reached", async () => {
      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          hardcap: getAmount("10"),
        })
      ).wait();

      await (
        await tokenSale
          .connect(signer1)
          .purchaseTokenWhitelistSale(getAmount("10"))
      ).wait();

      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("5"))
      ).to.be.revertedWith("TokenSale: sold out");
    });

    it("should revert if investor is not registered", async () => {
      expect(
        tokenSale.connect(signer4).purchaseTokenWhitelistSale(getAmount("5"))
      ).to.be.revertedWith("TokenSale: not registered");
    });

    it("should revert if not within time frame", async () => {
      const now = await getNow();

      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          whitelistSaleTimeFrame: {
            startTime: now + 3600 * 0.4,
            endTime: now + 3600 * 0.5,
          },
        })
      ).wait();
      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("5"))
      ).to.be.revertedWith("TokenSale: not in whitelist sale time");

      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          whitelistSaleTimeFrame: {
            startTime: now - 3600 * 2,
            endTime: now - 3600 * 1,
          },
        })
      ).wait();
      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("5"))
      ).to.be.revertedWith("TokenSale: not in whitelist sale time");
    });

    it("should revert if purchase amount is invalid", async () => {
      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("0"))
      ).to.be.revertedWith("TokenSale: invalid purchase amount");
      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("1"))
      ).to.be.revertedWith("TokenSale: invalid purchase amount");
      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("4"))
      ).to.be.revertedWith("TokenSale: invalid purchase amount");
      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("7"))
      ).to.be.revertedWith("TokenSale: invalid purchase amount");
      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("16"))
      ).to.be.revertedWith("TokenSale: invalid purchase amount");
      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("20"))
      ).to.be.revertedWith("TokenSale: invalid purchase amount");
      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("25"))
      ).to.be.revertedWith("TokenSale: invalid purchase amount");
      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("25.1"))
      ).to.be.revertedWith("TokenSale: invalid purchase amount");
    });
  });

  describe("purchaseTokenWhitelistSale controlled by configureTokenSale", () => {
    beforeEach(async () => {
      await Promise.all([
        (await configureTokenSale(tokenSale, configureTokenSaleParams)).wait(),
        (await tokenSale.registerInvestors([signer1.address], [1])).wait(),
      ]);
    });

    it("should revert if not within time frame", async () => {
      const now = await getNow();

      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          whitelistSaleTimeFrame: {
            startTime: now - 3600 * 2,
            endTime: now - 3600 * 1,
          },
        })
      ).wait();
      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("5"))
      ).to.be.revertedWith("TokenSale: not in whitelist sale time");

      await (
        await configureTokenSale(tokenSale, configureTokenSaleParams, {
          whitelistSaleTimeFrame: {
            startTime: now + 3600 * 0.4,
            endTime: now + 3600 * 0.5,
          },
        })
      ).wait();
      expect(
        tokenSale.connect(signer1).purchaseTokenWhitelistSale(getAmount("5"))
      ).to.be.revertedWith("TokenSale: not in whitelist sale time");
    });
  });

  describe("finalize", () => {
    beforeEach(async () => {
      const balance = await erc20.balanceOf(owner.address);
      await Promise.all([
        (
          await erc20.connect(signer1).approve(tokenSale.address, balance)
        ).wait(),
        (await erc20.transfer(signer1.address, balance)).wait(),
        await tokenSale.registerInvestors([signer1.address], [5]),
      ]);
    });

    it("should be able to finalize when hardcap is reached", async () => {
      await (
        await tokenSale
          .connect(signer1)
          .purchaseTokenWhitelistSale(getAmount("20"))
      ).wait();

      const balanceOfTokenSale = await erc20.balanceOf(tokenSale.address);
      expect(tokenSale.finalize())
        .to.emit(tokenSale, "Finalized")
        .withArgs(admin.address, balanceOfTokenSale);
      expect(await erc20.balanceOf(admin.address)).to.equal(balanceOfTokenSale);
    });

    it("should be able to finalize when whitelist sale has ended", async () => {
      await Promise.all([
        (
          await tokenSale
            .connect(signer1)
            .purchaseTokenWhitelistSale(getAmount("5"))
        ).wait(),
        increaseTime(
          configureTokenSaleParams.whitelistSaleTimeFrame.endTime -
            configureTokenSaleParams.whitelistSaleTimeFrame.startTime +
            1
        ),
      ]);

      const balanceOfTokenSale = await erc20.balanceOf(tokenSale.address);
      expect(tokenSale.finalize())
        .to.emit(tokenSale, "Finalized")
        .withArgs(admin.address, balanceOfTokenSale);
      expect(await erc20.balanceOf(admin.address)).to.equal(balanceOfTokenSale);
    });

    it("should revert if none condition is met", async () => {
      expect(tokenSale.finalize()).to.be.revertedWith(
        "TokenSale: can not finalize"
      );
    });

    it("should only be able to finalize once", async () => {
      await (
        await tokenSale
          .connect(signer1)
          .purchaseTokenWhitelistSale(getAmount("25"))
      ).wait();
      await (await tokenSale.finalize()).wait();

      expect(tokenSale.finalize()).to.be.revertedWith("TokenSale: finalized");
    });

    it("should revert if caller is not the owner", async () => {
      expect(tokenSale.connect(signer1).finalize()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("emergencyWithdraw", () => {
    let balanceOfContract: BigNumber;

    beforeEach(async () => {
      const balance = await erc20.balanceOf(owner.address);
      await Promise.all([
        (
          await erc20.connect(signer1).approve(tokenSale.address, balance)
        ).wait(),
        (await erc20.transfer(signer1.address, balance)).wait(),
        await tokenSale.registerInvestors([signer1.address], [1]),
      ]);
      await (
        await tokenSale
          .connect(signer1)
          .purchaseTokenWhitelistSale(getAmount("5"))
      ).wait();
      balanceOfContract = await erc20.balanceOf(tokenSale.address);
    });

    it("should be able to do emergency withdrawal", async () => {
      expect(tokenSale.connect(admin).emergencyWithdraw())
        .to.emit(tokenSale, "EmergencyWithdrawal")
        .withArgs(admin.address, balanceOfContract);
      expect(await erc20.balanceOf(admin.address)).to.equal(balanceOfContract);
      expect(await tokenSale.status()).to.equal(0);
    });

    it("should revert if caller is not admin", async () => {
      expect(tokenSale.emergencyWithdraw()).to.be.revertedWith(
        "TokenSale: caller is not the admin"
      );
    });
  });

  describe("changeInvestorWalletAddress", () => {
    let totalInvestment: BigNumber;

    beforeEach(async () => {
      const balance = await erc20.balanceOf(owner.address);
      await Promise.all([
        (
          await erc20.connect(signer1).approve(tokenSale.address, balance)
        ).wait(),
        (await erc20.transfer(signer1.address, balance)).wait(),
        await tokenSale.registerInvestors([signer1.address], [1]),
      ]);

      totalInvestment = getAmount("5");
      await (
        await tokenSale
          .connect(signer1)
          .purchaseTokenWhitelistSale(totalInvestment)
      ).wait();
    });

    it("should be able to change investor address correctly", async () => {
      const investorBefore = await tokenSale.investors(signer1.address);

      expect(investorBefore.totalInvestment).to.equal(totalInvestment);
      expect(investorBefore.whitelistPurchaseLevel).to.equal(1);

      await (
        await tokenSale
          .connect(admin)
          .changeInvestorWalletAddress(signer1.address, signer2.address)
      ).wait();

      const investorAfter = await tokenSale.investors(signer2.address);
      expect(investorAfter.totalInvestment).to.equal(
        investorBefore.totalInvestment
      );
      expect(investorAfter.whitelistPurchaseLevel).to.equal(
        investorBefore.whitelistPurchaseLevel
      );
      expect(await tokenSale.investorCount()).to.equal(1);
      expect((await tokenSale.investors(signer1.address)).investor).to.equal(
        addressZero
      );
      expect(await tokenSale.investorAddresses(0)).to.equal(signer2.address);
    });

    it("should revert if token sale has already been finalized", async () => {
      await increaseTime(
        configureTokenSaleParams.whitelistSaleTimeFrame.endTime -
          configureTokenSaleParams.whitelistSaleTimeFrame.startTime +
          1
      );
      await (await tokenSale.finalize()).wait();
      expect(
        tokenSale
          .connect(admin)
          .changeInvestorWalletAddress(signer1.address, signer2.address)
      ).to.be.revertedWith("TokenSale: finalized");
    });

    it("should revert if old address is invalid", async () => {
      expect(
        tokenSale
          .connect(admin)
          .changeInvestorWalletAddress(signer2.address, signer3.address)
      ).to.be.revertedWith("TokenSale: invalid old address");
      expect(
        tokenSale
          .connect(admin)
          .changeInvestorWalletAddress(addressZero, signer3.address)
      ).to.be.revertedWith("TokenSale: invalid old address");
    });

    it("should revert if new address is already taken", async () => {
      await (await tokenSale.registerInvestors([signer2.address], [1])).wait();
      expect(
        tokenSale
          .connect(admin)
          .changeInvestorWalletAddress(signer1.address, signer2.address)
      ).to.be.revertedWith("TokenSale: new address is already taken");
    });

    it("should revert if new address is zero", async () => {
      expect(
        tokenSale
          .connect(admin)
          .changeInvestorWalletAddress(signer1.address, addressZero)
      ).to.be.revertedWith("TokenSale: new address is zero");
    });

    it("should revert if call is not admin", async () => {
      expect(
        tokenSale.changeInvestorWalletAddress(signer1.address, signer2.address)
      ).to.be.revertedWith("TokenSale: caller is not the admin");
    });
  });

  describe("refundAll", () => {
    const signer1InvestmentAmount = getAmount("5");
    const signer2InvestmentAmount = getAmount("10");
    const signer3InvestmentAmount = getAmount("5");
    const signer4InvestmentAmount = getAmount("0");
    const totalInvestment = signer1InvestmentAmount
      .add(signer2InvestmentAmount)
      .add(signer3InvestmentAmount)
      .add(signer4InvestmentAmount);
    let balanceEach: BigNumber;

    beforeEach(async () => {
      balanceEach = (await erc20.balanceOf(owner.address)).div(4);
      await Promise.all([
        (
          await erc20.connect(signer1).approve(tokenSale.address, balanceEach)
        ).wait(),
        (await erc20.transfer(signer1.address, balanceEach)).wait(),
        (
          await erc20.connect(signer2).approve(tokenSale.address, balanceEach)
        ).wait(),
        (await erc20.transfer(signer2.address, balanceEach)).wait(),
        (
          await erc20.connect(signer3).approve(tokenSale.address, balanceEach)
        ).wait(),
        (await erc20.transfer(signer3.address, balanceEach)).wait(),
        (
          await erc20.connect(signer4).approve(tokenSale.address, balanceEach)
        ).wait(),
        (await erc20.transfer(signer4.address, balanceEach)).wait(),
        await tokenSale.registerInvestors(
          [signer1.address, signer2.address, signer3.address, signer4.address],
          [1, 2, 3, 4]
        ),
      ]);

      await Promise.all([
        (
          await tokenSale
            .connect(signer1)
            .purchaseTokenWhitelistSale(signer1InvestmentAmount)
        ).wait(),
        (
          await tokenSale
            .connect(signer2)
            .purchaseTokenWhitelistSale(signer2InvestmentAmount)
        ).wait(),
        (
          await tokenSale
            .connect(signer3)
            .purchaseTokenWhitelistSale(signer3InvestmentAmount)
        ).wait(),
        increaseTime(
          configureTokenSaleParams.whitelistSaleTimeFrame.startTime -
            configureTokenSaleParams.whitelistSaleTimeFrame.startTime +
            1
        ),
      ]);
    });

    it("should be able to refund all correctly", async () => {
      const [
        signer1RefundedBefore,
        signer2RefundedBefore,
        signer3RefundedBefore,
        signer4RefundedBefore,
        signer1BalanceBefore,
        signer2BalanceBefore,
        signer3BalanceBefore,
        signer4BalanceBefore,
        tokenSaleContractBalanceBefore,
        nextRefundIdxBefore,
      ] = await Promise.all([
        tokenSale.refunded(signer1.address),
        tokenSale.refunded(signer2.address),
        tokenSale.refunded(signer3.address),
        tokenSale.refunded(signer4.address),
        erc20.balanceOf(signer1.address),
        erc20.balanceOf(signer2.address),
        erc20.balanceOf(signer3.address),
        erc20.balanceOf(signer4.address),
        erc20.balanceOf(tokenSale.address),
        tokenSale.nextRefundIdx(),
      ]);

      expect(signer1RefundedBefore).to.be.false;
      expect(signer2RefundedBefore).to.be.false;
      expect(signer3RefundedBefore).to.be.false;
      expect(signer4RefundedBefore).to.be.false;
      expect(signer1BalanceBefore).to.equal(
        balanceEach.sub(signer1InvestmentAmount)
      );
      expect(signer2BalanceBefore).to.equal(
        balanceEach.sub(signer2InvestmentAmount)
      );
      expect(signer3BalanceBefore).to.equal(
        balanceEach.sub(signer3InvestmentAmount)
      );
      expect(signer4BalanceBefore).to.equal(
        balanceEach.sub(signer4InvestmentAmount)
      );
      expect(tokenSaleContractBalanceBefore).to.equal(totalInvestment);
      expect(nextRefundIdxBefore).to.equal(0);
      expect(await tokenSale.status()).to.equal(1);

      await (await tokenSale.connect(admin).refundAll()).wait();

      const [
        signer1RefundedAfter,
        signer2RefundedAfter,
        signer3RefundedAfter,
        signer4RefundedAfter,
        signer1BalanceAfter,
        signer2BalanceAfter,
        signer3BalanceAfter,
        signer4BalanceAfter,
        tokenSaleContractBalanceAfter,
        nextRefundIdxAfter,
      ] = await Promise.all([
        tokenSale.refunded(signer1.address),
        tokenSale.refunded(signer2.address),
        tokenSale.refunded(signer3.address),
        tokenSale.refunded(signer4.address),
        erc20.balanceOf(signer1.address),
        erc20.balanceOf(signer2.address),
        erc20.balanceOf(signer3.address),
        erc20.balanceOf(signer4.address),
        erc20.balanceOf(tokenSale.address),
        tokenSale.nextRefundIdx(),
      ]);

      expect(signer1RefundedAfter).to.be.true;
      expect(signer2RefundedAfter).to.be.true;
      expect(signer3RefundedAfter).to.be.true;
      expect(signer4RefundedAfter).to.be.false;
      expect(signer1BalanceAfter).to.equal(balanceEach);
      expect(signer2BalanceAfter).to.equal(balanceEach);
      expect(signer3BalanceAfter).to.equal(balanceEach);
      expect(signer4BalanceAfter).to.equal(balanceEach);
      expect(tokenSaleContractBalanceAfter).to.equal(0);
      expect(nextRefundIdxAfter).to.equal(4);
      expect(await tokenSale.status()).to.equal(0);

      // The next refund wont change the status
      await (await tokenSale.connect(admin).refundAll()).wait();
      expect(await tokenSale.status()).to.equal(0);
    });

    it("should revert if caller is not admin", async () => {
      expect(tokenSale.refundAll()).to.be.revertedWith(
        "TokenSale: caller is not the admin"
      );
    });
  });
});
