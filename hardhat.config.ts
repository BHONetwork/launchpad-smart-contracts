import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    bsc: {
      url: process.env.BSC_URL,
      chainId: 97,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    "bsc-mainnet": {
      url: process.env.MAINNET_BSC_URL,
      chainId: 56,
      accounts:
        process.env.MAINNET_PRIVATE_KEY !== undefined
          ? [process.env.MAINNET_PRIVATE_KEY]
          : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: process.env.COINMARTKETCAP_API_KEY,
    token: "BNB",
    gasPriceApi: `https://api.bscscan.com/api?module=proxy&action=eth_gasPrice&apikey=${process.env.BSCSCAN_API_KEY}`,
  },
  etherscan: {
    apiKey: process.env.BSCSCAN_API_KEY,
  },
};

export default config;
