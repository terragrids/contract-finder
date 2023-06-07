import TransactionError from '../error/transaction.error.js'

export async function makeZeroTransactionToSelf(stdlib, account, note) {
    try {
        const algosdk = stdlib.algosdk
        const address = account.networkAccount.addr
        const algoClient = (await stdlib.getProvider()).algodClient
        const suggestedParams = await algoClient.getTransactionParams().do()

        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            suggestedParams,
            from: address,
            to: address,
            amount: 0,
            note: new Uint8Array(Buffer.from(JSON.stringify(note)))
        })

        const signedTxn = txn.signTxn(account.networkAccount.sk)
        const { txId } = await algoClient.sendRawTransaction(signedTxn).do()
        const result = await stdlib.algosdk.waitForConfirmation(algoClient, txId, 4)

        return { id: txId, info: result.txn }
    } catch (e) {
        throw new TransactionError(e)
    }
}
