'use strict'

import dotenv from 'dotenv'
import Koa from 'koa'
import Router from '@koa/router'
import bodyParser from 'koa-bodyparser'
import errorHandler from './middleware/error-handler.js'
import requestLogger from './middleware/request-logger.js'
import ReachProvider from './provider/reach-provider.js'
import MissingParameterError from './error/missing-parameter.error.js'
import ParameterTooLongError from './error/parameter-too-long.error.js'
import DynamoDbRepository from './repository/dynamodb.repository.js'
import PlaceRepository from './repository/place.repository.js'
import UpdatePlaceTokenError from './error/update-contract.error.js'
import { UserUnauthorizedError } from './error/user-unauthorized-error.js'
import { algorandAddressFromCID, cidFromAlgorandAddress } from './utils/token-utils.js'
import AlgoIndexer from './network/algo-indexer.js'
import AssetNotFoundError from './error/asset-not-found.error.js'
import { isTokenAccepted } from './utils/wallet-utils.js'
import jwtAuthorize from './middleware/jwt-authorize.js'
import UserRepository from './repository/user.repository.js'
import { TypePositiveOrZeroNumberError } from './error/type-positive-number.error.js'
import { isPositiveOrZeroNumber } from './utils/validators.js'
import TrackerRepository from './repository/tracker.repository.js'
import { mintToken } from './utils/token-minter.js'

dotenv.config()
export const app = new Koa()
const router = new Router()

router.get('/', ctx => {
    ctx.body = 'terragrids place contract api'
})

router.get('/hc', async ctx => {
    const reachProvider = new ReachProvider()

    const stdlib = reachProvider.getStdlib()
    const provider = await stdlib.getProvider()

    const [algoClientHC, algoIndexerHC, algoAccount, dynamoDb] = await Promise.all([
        provider.algodClient.healthCheck().do(), // algo sdk client
        provider.indexer.makeHealthCheck().do(), // algo indexer client
        stdlib.newAccountFromMnemonic(process.env.ALGO_ACCOUNT_MNEMONIC), // reach account handle
        new DynamoDbRepository().testConnection() // DynamoDB client
    ])

    const ok = 'ok'
    const error = 'error'

    ctx.body = {
        env: process.env.ENV,
        region: process.env.AWS_REGION,
        db: {
            status: dynamoDb.status === 200 ? ok : error,
            region: dynamoDb.region
        },
        reach: {
            network: reachProvider.getEnv(),
            algoClient: JSON.stringify(algoClientHC) === '{}' ? ok : error,
            algoIndexer: algoIndexerHC.version ? ok : error,
            algoAccount: algoAccount.networkAccount ? ok : error
        }
    }
})

router.post('/places', jwtAuthorize, bodyParser(), async ctx => {
    if (!ctx.request.body.name) throw new MissingParameterError('name')
    if (!ctx.request.body.cid) throw new MissingParameterError('cid')
    if (!ctx.request.body.offChainImageUrl) throw new MissingParameterError('offChainImageUrl')
    if (!isPositiveOrZeroNumber(ctx.request.body.positionX)) throw new TypePositiveOrZeroNumberError('positionX')
    if (!isPositiveOrZeroNumber(ctx.request.body.positionY)) throw new TypePositiveOrZeroNumberError('positionY')

    if (ctx.request.body.name.length > 128) throw new ParameterTooLongError('name')
    if (ctx.request.body.offChainImageUrl && ctx.request.body.offChainImageUrl.length > 128) throw new ParameterTooLongError('offChainImageUrl')

    const stdlib = new ReachProvider().getStdlib()
    const [algoAccount, user] = await Promise.all([stdlib.newAccountFromMnemonic(process.env.ALGO_ACCOUNT_MNEMONIC), new UserRepository().getUserByOauthId(ctx.state.jwt.sub)])

    // Mint place token
    const tokenId = await mintToken(stdlib, algoAccount, ctx.request.body.cid, ctx.request.body.name, 'TRPLC')

    // Save place off-chain
    await new PlaceRepository().createPlace({
        tokenId,
        userId: user.id,
        name: ctx.request.body.name,
        offChainImageUrl: ctx.request.body.offChainImageUrl,
        positionX: ctx.request.body.positionX,
        positionY: ctx.request.body.positionY
    })

    ctx.body = { tokenId }
    ctx.status = 201
})

router.put('/places/:tokenId', jwtAuthorize, bodyParser(), async ctx => {
    if (!ctx.request.body.name) throw new MissingParameterError('name')
    if (!ctx.request.body.cid) throw new MissingParameterError('cid')
    if (!ctx.request.body.offChainImageUrl) throw new MissingParameterError('offChainImageUrl')

    if (ctx.request.body.name.length > 128) throw new ParameterTooLongError('name')
    if (ctx.request.body.offChainImageUrl && ctx.request.body.offChainImageUrl.length > 128) throw new ParameterTooLongError('offChainImageUrl')

    const userRepository = new UserRepository()
    const placeRepository = new PlaceRepository()
    const [user, place] = await Promise.all([userRepository.getUserByOauthId(ctx.state.jwt.sub), placeRepository.getPlace(ctx.params.tokenId)])

    // Only creators can update place details. TODO: add admins
    if (user.id !== place.userId) throw new UserUnauthorizedError()

    try {
        const stdlib = new ReachProvider().getStdlib()
        const algoAccount = await stdlib.newAccountFromMnemonic(process.env.ALGO_ACCOUNT_MNEMONIC)

        const cid = ctx.request.body.cid
        const { address } = algorandAddressFromCID(stdlib.algosdk, cid)
        const cidFromAddress = cidFromAlgorandAddress(stdlib.algosdk, address)
        if (cid !== cidFromAddress) throw new Error('Error verifying cid')

        const algoClient = (await stdlib.getProvider()).algodClient
        const params = await algoClient.getTransactionParams().do()
        const managerAddress = algoAccount.networkAccount.addr

        // The change has to come from the existing manager
        const transaction = stdlib.algosdk.makeAssetConfigTxnWithSuggestedParamsFromObject({
            assetIndex: parseInt(place.id),
            from: managerAddress,
            manager: managerAddress,
            freeze: managerAddress,
            clawback: managerAddress,
            reserve: address,
            suggestedParams: params
        })

        // This transaction must be signed by the current manager
        const rawSignedTxn = transaction.signTxn(algoAccount.networkAccount.sk)

        let txnResponse = await algoClient.sendRawTransaction(rawSignedTxn).do()
        await stdlib.algosdk.waitForConfirmation(algoClient, txnResponse.txId, 4)

        await placeRepository.updatePlace({
            tokenId: place.id,
            name: ctx.request.body.name,
            offChainImageUrl: ctx.request.body.offChainImageUrl
        })

        ctx.status = 204
    } catch (e) {
        throw new UpdatePlaceTokenError(e)
    }
})

router.put('/places/:tokenId/approval', jwtAuthorize, async ctx => {
    await new PlaceRepository().approvePlace(ctx.state.jwt.sub, ctx.params.tokenId, true)
    ctx.body = ''
    ctx.status = 204
})

router.get('/places', async ctx => {
    const places = await new PlaceRepository().getPlaces({
        sort: ctx.request.query.sort,
        status: ctx.request.query.status,
        pageSize: ctx.request.query.pageSize,
        nextPageKey: ctx.request.query.nextPageKey
    })
    ctx.body = places
    ctx.status = 200
})

router.get('/places/:tokenId', async ctx => {
    const place = await new PlaceRepository().getPlace(ctx.params.tokenId)
    const user = await new UserRepository().getUserById(place.userId)

    const algoIndexer = new AlgoIndexer()
    let extraData

    if (user.walletAddress) {
        const stdlib = new ReachProvider().getStdlib()
        const tokenCreatorOptIn = await isTokenAccepted(stdlib, user.walletAddress, ctx.params.tokenId)

        const [assetResponse, balancesResponse] = await Promise.all([
            algoIndexer.callAlgonodeIndexerEndpoint(`assets/${ctx.params.tokenId}`),
            algoIndexer.callAlgonodeIndexerEndpoint(`assets/${ctx.params.tokenId}/balances`)
        ])

        if (!assetResponse || assetResponse.status !== 200 || assetResponse.json.asset.deleted || !balancesResponse || balancesResponse.status !== 200) {
            throw new AssetNotFoundError()
        }

        const userWalletOwned = balancesResponse.json.balances.some(balance => balance.amount > 0 && !balance.deleted && balance.address === user.walletAddress)

        extraData = {
            url: assetResponse.json.asset.params.url,
            reserve: assetResponse.json.asset.params.reserve,
            tokenCreatorOptIn,
            userWalletOwned
        }
    } else {
        const assetResponse = await new AlgoIndexer().callAlgonodeIndexerEndpoint(`assets/${ctx.params.tokenId}`)
        if (assetResponse.status !== 200 || assetResponse.json.asset.deleted) throw new AssetNotFoundError()

        extraData = {
            url: assetResponse.json.asset.params.url,
            reserve: assetResponse.json.asset.params.reserve
        }
    }

    ctx.body = {
        ...place,
        ...extraData
    }
})

router.delete('/places/:tokenId', jwtAuthorize, async ctx => {
    await new PlaceRepository().deletePlace(ctx.state.jwt.sub, ctx.params.tokenId)
    ctx.body = ''
    ctx.status = 204
})

router.get('/users/:userId/places', async ctx => {
    const places = await new PlaceRepository().getPlacesByUser({
        userId: ctx.params.userId,
        sort: ctx.request.query.sort,
        status: ctx.request.query.status,
        pageSize: ctx.request.query.pageSize,
        nextPageKey: ctx.request.query.nextPageKey
    })
    ctx.body = places
    ctx.status = 200
})

router.post('/trackers', jwtAuthorize, bodyParser(), async ctx => {
    if (!ctx.request.body.name) throw new MissingParameterError('name')
    if (!ctx.request.body.cid) throw new MissingParameterError('cid')
    if (!ctx.request.body.offChainImageUrl) throw new MissingParameterError('offChainImageUrl')
    if (!ctx.request.body.placeId) throw new MissingParameterError('placeId')

    if (ctx.request.body.name.length > 128) throw new ParameterTooLongError('name')
    if (ctx.request.body.offChainImageUrl && ctx.request.body.offChainImageUrl.length > 128) throw new ParameterTooLongError('offChainImageUrl')

    const stdlib = new ReachProvider().getStdlib()
    const [algoAccount, user] = await Promise.all([stdlib.newAccountFromMnemonic(process.env.ALGO_ACCOUNT_MNEMONIC), new UserRepository().getUserByOauthId(ctx.state.jwt.sub)])

    // Mint tracker token
    const tokenId = await mintToken(stdlib, algoAccount, ctx.request.body.cid, ctx.request.body.name, 'TRTRK')

    // Save place off-chain
    await new TrackerRepository().createTracker({
        tokenId,
        userId: user.id,
        placeId: ctx.request.body.placeId,
        name: ctx.request.body.name,
        offChainImageUrl: ctx.request.body.offChainImageUrl
    })

    ctx.body = { tokenId }
    ctx.status = 201
})

app.use(requestLogger).use(errorHandler).use(router.routes()).use(router.allowedMethods())
