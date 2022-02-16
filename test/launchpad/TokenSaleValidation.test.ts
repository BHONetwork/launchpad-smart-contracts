/* eslint-disable no-unused-expressions */
/* eslint-disable node/no-missing-import */

import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { addressZero, getAmount, getRandomAddress } from "../test-utils";
import { TokenSaleValidationImpl } from "../../typechain";

describe("TokenSaleValidation", () => {
  let tokenSaleValidationImpl: TokenSaleValidationImpl;
  let address1: string;
  let address2: string;

  before(async () => {
    address1 = getRandomAddress();
    address2 = getRandomAddress();

    const tokenSaleValidationImplFactory = await ethers.getContractFactory(
      "TokenSaleValidationImpl"
    );
    tokenSaleValidationImpl = await tokenSaleValidationImplFactory.deploy();
    await tokenSaleValidationImpl.deployed();
  });

  describe("nonZeroAddresses", () => {
    it("should return true when all addresses are non-zero", async () => {
      expect(
        await tokenSaleValidationImpl.nonZeroAddresses([address1, address2])
      ).to.be.true;
    });

    it("should return false when one of the addresses is zero", async () => {
      expect(
        await tokenSaleValidationImpl.nonZeroAddresses([
          addressZero,
          address1,
          address2,
        ])
      ).to.be.false;

      expect(
        await tokenSaleValidationImpl.nonZeroAddresses([
          address1,
          addressZero,
          address2,
        ])
      ).to.be.false;

      expect(
        await tokenSaleValidationImpl.nonZeroAddresses([
          address1,
          address2,
          addressZero,
        ])
      ).to.be.false;
    });
  });

  describe("validWhitelistPurchaseLevels", () => {
    it("should return true when all levels <= max level", async () => {
      const purchaseLevels = [1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1];

      expect(
        await tokenSaleValidationImpl.validWhitelistPurchaseLevels(
          purchaseLevels,
          6
        )
      ).to.be.true;

      expect(
        await tokenSaleValidationImpl.validWhitelistPurchaseLevels(
          purchaseLevels,
          7
        )
      ).to.be.true;
    });

    it("should return false when one of the levels > max level", async () => {
      expect(
        await tokenSaleValidationImpl.validWhitelistPurchaseLevels(
          [1, 7, 2, 3, 4, 5, 6],
          6
        )
      ).to.be.false;

      expect(
        await tokenSaleValidationImpl.validWhitelistPurchaseLevels([4, 1, 2], 3)
      ).to.be.false;
      expect(
        await tokenSaleValidationImpl.validWhitelistPurchaseLevels([1, 4, 2], 3)
      ).to.be.false;
      expect(
        await tokenSaleValidationImpl.validWhitelistPurchaseLevels([1, 2, 4], 3)
      ).to.be.false;
    });
  });

  describe("validPurchaseAmount", () => {
    let purchaseLevels: BigNumber[];
    let investorPurchaseLevel: number;

    before(() => {
      purchaseLevels = [
        getAmount("5"),
        getAmount("10"),
        getAmount("15"),
        getAmount("20"),
        getAmount("25"),
        getAmount("30"),
        getAmount("35"),
        getAmount("40"),
        getAmount("45"),
      ];
      investorPurchaseLevel = 4;
    });

    it("should return true when purchase amount is one of the allowed purchase amounts", async () => {
      expect(
        await tokenSaleValidationImpl.validPurchaseAmount(
          purchaseLevels,
          investorPurchaseLevel - 1,
          getAmount("5")
        )
      ).to.be.true;

      expect(
        await tokenSaleValidationImpl.validPurchaseAmount(
          purchaseLevels,
          investorPurchaseLevel - 1,
          getAmount("10")
        )
      ).to.be.true;

      expect(
        await tokenSaleValidationImpl.validPurchaseAmount(
          purchaseLevels,
          investorPurchaseLevel - 1,
          getAmount("15")
        )
      ).to.be.true;

      expect(
        await tokenSaleValidationImpl.validPurchaseAmount(
          purchaseLevels,
          investorPurchaseLevel - 1,
          getAmount("20")
        )
      ).to.be.true;
    });

    it("should return false when purchase amount does not fall in any allowed amount", async () => {
      expect(
        await tokenSaleValidationImpl.validPurchaseAmount(
          purchaseLevels,
          investorPurchaseLevel - 1,
          getAmount("5.5")
        )
      ).to.be.false;

      expect(
        await tokenSaleValidationImpl.validPurchaseAmount(
          purchaseLevels,
          investorPurchaseLevel - 1,
          getAmount("19")
        )
      ).to.be.false;

      expect(
        await tokenSaleValidationImpl.validPurchaseAmount(
          purchaseLevels,
          investorPurchaseLevel - 1,
          getAmount("25")
        )
      ).to.be.false;

      expect(
        await tokenSaleValidationImpl.validPurchaseAmount(
          purchaseLevels,
          investorPurchaseLevel - 1,
          getAmount("30")
        )
      ).to.be.false;
    });
  });
});
