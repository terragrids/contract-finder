import AssetNotFoundError from '../error/asset-not-found.error.js'
import AlgoIndexer from '../network/algo-indexer.js'
import ReachProvider from '../provider/reach-provider.js'
import { isTokenAccepted } from './wallet-utils.js'

export async function getTokenWithUserInfo(tokenId, walletAddress) {
    const stdlib = new ReachProvider().getStdlib()
    const algoIndexer = new AlgoIndexer()
    let tokenInfo

    if (walletAddress) {
        const tokenCreatorOptIn = await isTokenAccepted(stdlib, walletAddress, tokenId)

        const [assetResponse, balancesResponse] = await Promise.all([
            algoIndexer.callAlgonodeIndexerEndpoint(`assets/${tokenId}`),
            algoIndexer.callAlgonodeIndexerEndpoint(`assets/${tokenId}/balances`)
        ])

        if (!assetResponse || assetResponse.status !== 200 || assetResponse.json.asset.deleted || !balancesResponse || balancesResponse.status !== 200) {
            throw new AssetNotFoundError()
        }

        const userWalletOwned = balancesResponse.json.balances.some(balance => balance.amount > 0 && !balance.deleted && balance.address === walletAddress)

        tokenInfo = {
            url: assetResponse.json.asset.params.url,
            reserve: assetResponse.json.asset.params.reserve,
            tokenCreatorOptIn,
            userWalletOwned
        }
    } else {
        const assetResponse = await algoIndexer.callAlgonodeIndexerEndpoint(`assets/${tokenId}`)
        if (assetResponse.status !== 200 || assetResponse.json.asset.deleted) throw new AssetNotFoundError()

        tokenInfo = {
            url: assetResponse.json.asset.params.url,
            reserve: assetResponse.json.asset.params.reserve
        }
    }

    return tokenInfo
}
