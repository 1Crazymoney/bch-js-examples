/*
  Send tokens of type TOKENID to user with SLPADDR address.
*/

// CUSTOMIZE THESE VALUES FOR YOUR USE
const TOKENQTY = 1;
const TOKENID =
  "0ebe9dd7f8367e1ee3c8341cc3f5257a8609cf5118f85e8e0626eadf4454e054";
let TO_SLPADDR = "";

// Set NETWORK to either testnet or mainnet
const NETWORK = "testnet";

// REST API servers.
const MAINNET_API = "https://api.fullstack.cash/v3/";
const TESTNET_API = "http://tapi.fullstack.cash/v3/";

// bch-js-examples require code from the main bch-js repo
const BCHJS = require("@chris.troutner/bch-js");

// Instantiate bch-js based on the network.
let bchjs;
if (NETWORK === "mainnet") bchjs = new BCHJS({ restURL: MAINNET_API });
else bchjs = new BCHJS({ restURL: TESTNET_API });

// Open the wallet generated with create-wallet.
let walletInfo;
try {
  walletInfo = require("../create-wallet/wallet.json");
} catch (err) {
  console.log(
    "Could not open wallet.json. Generate a wallet with create-wallet first."
  );
  process.exit(0);
}
// console.log(`walletInfo: ${JSON.stringify(walletInfo, null, 2)}`)

async function sendToken() {
  try {
    const mnemonic = walletInfo.mnemonic;

    // root seed buffer
    const rootSeed = await bchjs.Mnemonic.toSeed(mnemonic);
    // master HDNode
    let masterHDNode;
    if (NETWORK === "mainnet") masterHDNode = bchjs.HDNode.fromSeed(rootSeed);
    else masterHDNode = bchjs.HDNode.fromSeed(rootSeed, "testnet"); // Testnet

    // HDNode of BIP44 account
    const account = bchjs.HDNode.derivePath(masterHDNode, "m/44'/245'/0'");
    const change = bchjs.HDNode.derivePath(account, "0/0");

    // Generate an EC key pair for signing the transaction.
    const keyPair = bchjs.HDNode.toKeyPair(change);

    // get the cash address
    const cashAddress = bchjs.HDNode.toCashAddress(change);
    const slpAddress = bchjs.HDNode.toSLPAddress(change);

    // Get UTXOs held by this address.
    const utxos = await bchjs.Blockbook.utxo(cashAddress);
    // console.log(`utxos: ${JSON.stringify(utxos, null, 2)}`);

    if (utxos.length === 0) throw new Error("No UTXOs to spend! Exiting.");

    // Identify the SLP token UTXOs.
    let tokenUtxos = await bchjs.SLP.Utils.tokenUtxoDetails(utxos);
    // console.log(`tokenUtxos: ${JSON.stringify(tokenUtxos, null, 2)}`);

    // Filter out the non-SLP token UTXOs.
    const bchUtxos = utxos.filter((utxo, index) => {
      const tokenUtxo = tokenUtxos[index];
      if (!tokenUtxo) return true;
    });
    // console.log(`bchUTXOs: ${JSON.stringify(bchUtxos, null, 2)}`);

    if (bchUtxos.length === 0) {
      throw new Error("Wallet does not have a BCH UTXO to pay miner fees.");
    }

    // Filter out the token UTXOs that match the user-provided token ID.
    tokenUtxos = tokenUtxos.filter((utxo, index) => {
      if (
        utxo && // UTXO is associated with a token.
        utxo.tokenId === TOKENID && // UTXO matches the token ID.
        utxo.utxoType === "token" // UTXO is not a minting baton.
      )
        return true;
    });
    // console.log(`tokenUtxos: ${JSON.stringify(tokenUtxos, null, 2)}`);

    if (tokenUtxos.length === 0) {
      throw new Error("No token UTXOs for the specified token could be found.");
    }

    // Choose a UTXO to pay for the transaction.
    const bchUtxo = findBiggestUtxo(bchUtxos);
    // console.log(`bchUtxo: ${JSON.stringify(bchUtxo, null, 2)}`);

    // Generate the OP_RETURN code.
    // const slpSendObj = bchjs.SLP.TokenType1.generateSendOpReturn(
    //   tokenUtxos,
    //   TOKENQTY
    // )
    // const slpData = bchjs.Script.encode(slpSendObj.script)

    const slpSendObj = bchjs.SLP.TokenType1.generateSendOpReturn(
      tokenUtxos,
      TOKENQTY
    );
    const slpData = slpSendObj.script;
    // console.log(`slpOutputs: ${slpSendObj.outputs}`);

    // BEGIN transaction construction.

    // instance of transaction builder
    let transactionBuilder;
    if (NETWORK === "mainnet") {
      transactionBuilder = new bchjs.TransactionBuilder();
    } else transactionBuilder = new bchjs.TransactionBuilder("testnet");

    // Add the BCH UTXO as input to pay for the transaction.
    const originalAmount = bchUtxo.satoshis;
    transactionBuilder.addInput(bchUtxo.txid, bchUtxo.vout);

    // add each token UTXO as an input.
    for (let i = 0; i < tokenUtxos.length; i++) {
      transactionBuilder.addInput(tokenUtxos[i].txid, tokenUtxos[i].vout);
    }

    // get byte count to calculate fee. paying 1 sat
    // Note: This may not be totally accurate. Just guessing on the byteCount size.
    // const byteCount = this.BITBOX.BitcoinCash.getByteCount(
    //   { P2PKH: 3 },
    //   { P2PKH: 5 }
    // )
    // //console.log(`byteCount: ${byteCount}`)
    // const satoshisPerByte = 1.1
    // const txFee = Math.floor(satoshisPerByte * byteCount)
    // console.log(`txFee: ${txFee} satoshis\n`)
    const txFee = 250;

    // amount to send back to the sending address. It's the original amount - 1 sat/byte for tx size
    const remainder = originalAmount - txFee - 546 * 2;
    if (remainder < 1) {
      throw new Error("Selected UTXO does not have enough satoshis");
    }
    // console.log(`remainder: ${remainder}`)

    // Add OP_RETURN as first output.
    transactionBuilder.addOutput(slpData, 0);

    // Send the token back to the same wallet if the user hasn't specified a
    // different address.
    if (TO_SLPADDR === "") TO_SLPADDR = walletInfo.slpAddress;

    // Send dust transaction representing tokens being sent.
    transactionBuilder.addOutput(
      bchjs.SLP.Address.toLegacyAddress(TO_SLPADDR),
      546
    );

    // Return any token change back to the sender.
    if (slpSendObj.outputs > 1) {
      transactionBuilder.addOutput(
        bchjs.SLP.Address.toLegacyAddress(slpAddress),
        546
      );
    }

    // Last output: send the BCH change back to the wallet.
    transactionBuilder.addOutput(
      bchjs.Address.toLegacyAddress(cashAddress),
      remainder
    );

    // Sign the transaction with the private key for the BCH UTXO paying the fees.
    let redeemScript;
    transactionBuilder.sign(
      0,
      keyPair,
      redeemScript,
      transactionBuilder.hashTypes.SIGHASH_ALL,
      originalAmount
    );

    // Sign each token UTXO being consumed.
    for (let i = 0; i < tokenUtxos.length; i++) {
      const thisUtxo = tokenUtxos[i];

      transactionBuilder.sign(
        1 + i,
        keyPair,
        redeemScript,
        transactionBuilder.hashTypes.SIGHASH_ALL,
        thisUtxo.satoshis
      );
    }

    // build tx
    const tx = transactionBuilder.build();

    // output rawhex
    const hex = tx.toHex();
    // console.log(`Transaction raw hex: `, hex)

    // END transaction construction.

    // Broadcast transation to the network
    const txidStr = await bchjs.RawTransactions.sendRawTransaction([hex]);
    console.log(`Transaction ID: ${txidStr}`);

    console.log("Check the status of your transaction on this block explorer:");
    if (NETWORK === "testnet") {
      console.log(`https://explorer.bitcoin.com/tbch/tx/${txidStr}`);
    } else console.log(`https://explorer.bitcoin.com/bch/tx/${txidStr}`);
  } catch (err) {
    console.error("Error in sendToken: ", err);
    console.log(`Error message: ${err.message}`);
  }
}
sendToken();

// Returns the utxo with the biggest balance from an array of utxos.
function findBiggestUtxo(utxos) {
  let largestAmount = 0;
  let largestIndex = 0;

  for (var i = 0; i < utxos.length; i++) {
    const thisUtxo = utxos[i];

    if (thisUtxo.satoshis > largestAmount) {
      largestAmount = thisUtxo.satoshis;
      largestIndex = i;
    }
  }

  return utxos[largestIndex];
}
