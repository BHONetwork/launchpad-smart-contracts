/* eslint-disable node/no-unsupported-features/es-syntax */
/* eslint-disable node/no-missing-import */

import { BigNumber, BigNumberish, ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import Big from "big.js";
import { ERC20, TokenSale, TokenSaleFactory } from "../typechain";
import { expect } from "chai";

export const addressZero = ethers.constants.AddressZero;

export const getRandomAddress = () => ethers.Wallet.createRandom().address;

export const getNow = async (): Promise<number> =>
  (await ethers.provider.getBlock("latest")).timestamp;

export const getAmount = (amount: string, decimals: number = 18): BigNumber => {
  if (amount.includes(".")) {
    return ethers.BigNumber.from(Big(10).pow(decimals).mul(amount).toFixed());
  }
  return ethers.BigNumber.from(10).pow(decimals).mul(amount);
};

export const increaseTime = async (bySeconds: number): Promise<void> => {
  await ethers.provider.send("evm_increaseTime", [bySeconds]);
};

export const createSnapshot = async (): Promise<any> => {
  return await ethers.provider.send("evm_snapshot", []);
};

export const revertSnapshot = async (snapshotId: any): Promise<void> => {
  return await ethers.provider.send("evm_revert", [snapshotId]);
};

export type CreateTokenSaleParams = {
  tokenSaleImplementationAddress: string;
  name: string;
  admin: string;
  hardcap: BigNumberish;
  whitelistSaleTimeFrame: {
    startTime: number;
    endTime: number;
  };
  purchaseLevels: BigNumberish[];
  purchaseToken: string;
};

export type OverrideCreateTokenSaleParams = {
  tokenSaleImplementationAddress?: string;
  name?: string;
  admin?: string;
  hardcap?: BigNumberish;
  whitelistSaleTimeFrame?: {
    startTime: number;
    endTime: number;
  };
  purchaseLevels?: BigNumberish[];
  purchaseToken?: string;
};

export const createTokenSale = (
  tokenSaleFactory: TokenSaleFactory,
  defaultParams: CreateTokenSaleParams,
  overrideParams: OverrideCreateTokenSaleParams = {}
): Promise<ContractTransaction> => {
  const params: CreateTokenSaleParams = { ...defaultParams, ...overrideParams };
  return tokenSaleFactory.createTokenSale(
    params.tokenSaleImplementationAddress,
    params.name,
    params.admin,
    params.hardcap,
    params.whitelistSaleTimeFrame,
    params.purchaseLevels,
    params.purchaseToken
  );
};

export type ConfigureTokenSaleParams = {
  hardcap: BigNumberish;
  whitelistSaleTimeFrame: {
    startTime: number;
    endTime: number;
  };
  purchaseLevels: BigNumberish[];
  purchaseToken: string;
  status: number;
};

export type OverrideConfigureTokenSaleParams = {
  hardcap?: BigNumberish;
  whitelistSaleTimeFrame?: {
    startTime: number;
    endTime: number;
  };
  purchaseLevels?: BigNumberish[];
  purchaseToken?: string;
  status?: number;
};

export const configureTokenSale = (
  tokenSale: TokenSale,
  defaultParams: ConfigureTokenSaleParams,
  overrideParams: OverrideConfigureTokenSaleParams = {}
) => {
  const params: ConfigureTokenSaleParams = {
    ...defaultParams,
    ...overrideParams,
  };

  return tokenSale.configureTokenSale(
    params.hardcap,
    params.whitelistSaleTimeFrame,
    params.purchaseLevels,
    params.status
  );
};

export const verifyTokenSaleData = async (
  tokenSale: TokenSale,
  erc20: ERC20,
  expectedTotalSaleAmount: BigNumberish
) => {
  const [tokenSaleBalance, tokenSaleData] = await Promise.all([
    erc20.balanceOf(tokenSale.address),
    tokenSale.tokenSaleData(),
  ]);
  expect(tokenSaleBalance).to.equal(tokenSaleData.totalSaleAmount_);
  expect(tokenSaleData.totalSaleAmount_).to.equal(expectedTotalSaleAmount);
};

export const verifyInvestorAmounts = (
  investor: any,
  expectedTotalInvestment: BigNumberish
) => {
  expect(investor.totalInvestment).to.equal(expectedTotalInvestment);
};
