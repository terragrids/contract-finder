import { truncateString } from './string-utils.js'
import MintTokenError from '../error/mint-token.error.js'
import { algorandAddressFromCID, cidFromAlgorandAddress } from './token-utils.js'

export async function mintToken(stdlib, algoAccount, cid, name, symbol) {
    try {
        const { address, url } = algorandAddressFromCID(stdlib.algosdk, cid)
        const cidFromAddress = cidFromAlgorandAddress(stdlib.algosdk, address)
        if (cid !== cidFromAddress) throw new Error('Error verifying cid')

        const managerAddress = algoAccount.networkAccount.addr
        const assetName = truncateString(name, 32)

        const token = await stdlib.launchToken(algoAccount, assetName, symbol, {
            supply: 1,
            decimals: 0,
            url,
            reserve: address,
            manager: managerAddress,
            freeze: managerAddress,
            clawback: managerAddress
        })

        return token.id.toNumber()
    } catch (e) {
        throw new MintTokenError(e)
    }
}
