This repository contains a series of small example apps that illustrate how to
code up common use cases for a Bitcoin Cash application using
the [bch-js](https://www.npmjs.com/package/@chris.troutner/bch-js) JavaScript
library and the [bch-api](https://api.bchjs.cash/) REST API.

The `low-level` directory
contains low-level applications exercising a single feature of bch-js. Think of
these examples like lego blocks that can be used to build a bigger app.

The `applications` directory contains example applications like wallets, voting,
and other ideas.

For a full-blown wallet, check out the [slp-cli-wallet](https://www.npmjs.com/package/slp-cli-wallet). This is both a command-line wallet as well as an NPM
JavaScript library for providing high-level wallet functionality to your own
applications.

If you want to chat with other developers interested in Bitcoin Cash, be sure
to [join our Telegram channel](https://t.me/bch_js_toolkit).

## Installation
Prior to running these examples, you need to setup this code repository. In the
root directory run this commands to install the required dependencies.
```
npm install
```

## Running Examples
You can run each example script by entering its directory and executing `npm start`

If you're new to Bitcoin Cash or need to brush up on your fundamentals, be sure
to read this free book: [Mastering Bitcoin Cash](https://developer.bitcoin.com/mastering-bitcoin-cash/)

## Basic BCH Wallet Functions
These basic examples in the `applications/wallet` directory are used to bootstrap
a BCH wallet for use with the other examples. Recommended path:

1. [Create a wallet](applications/wallet/create-wallet/create-wallet.js)
2. Fund it. Examples target mainnet by default ([additional instructions](applications/wallet)).
If targeting testnet, fund it with the [testnet faucet](https://developer.bitcoin.com/faucets/bch).
Otherwise fund with your own BCH to test the wallet on mainnet.
3. [Check the balance](applications/wallet/check-balance/check-balance.js)
4. [Send some BCH](applications/wallet/send-bch/send-bch.js)
