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
import jwtAuthorize from './middleware/jwt-authorize.js'
import UserRepository from './repository/user.repository.js'
import { TypePositiveOrZeroNumberError } from './error/type-positive-number.error.js'
import { isPositiveOrZeroNumber, isValidTrackerType } from './utils/validators.js'
import TrackerRepository from './repository/tracker.repository.js'
import { mintToken } from './utils/token-minter.js'
import { getTokenWithUserInfo } from './utils/token-info.js'
import InvalidTrackerError from './error/invalid-tracker.error.js'
import { makeZeroTransactionToSelf } from './utils/transaction-maker.js'
import { aes256decrypt, aes256encrypt } from './utils/crypto-utils.js'
import AlgoIndexer from './network/algo-indexer.js'
import ReadingNotFoundError from './error/reading-not-found.error.js'
import { UtilityAccountNotFound } from './error/utility-account-not-found.js'
import OctopusEnergyApi from './network/octopus-energy-api.js'

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
    const tokenInfo = await getTokenWithUserInfo(ctx.params.tokenId, user.walletAddress)

    ctx.body = {
        ...place,
        ...tokenInfo
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
    if (!ctx.request.body.type) throw new MissingParameterError('type')
    if (!ctx.request.body.cid) throw new MissingParameterError('cid')
    if (!ctx.request.body.offChainImageUrl) throw new MissingParameterError('offChainImageUrl')
    if (!ctx.request.body.placeId) throw new MissingParameterError('placeId')

    if (ctx.request.body.name.length > 128) throw new ParameterTooLongError('name')
    if (ctx.request.body.type.length > 128) throw new ParameterTooLongError('type')
    if (ctx.request.body.offChainImageUrl && ctx.request.body.offChainImageUrl.length > 128) throw new ParameterTooLongError('offChainImageUrl')
    if (!isValidTrackerType(ctx.request.body.type)) throw new InvalidTrackerError()

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
        type: ctx.request.body.type,
        offChainImageUrl: ctx.request.body.offChainImageUrl,
        isAdmin: user.permissions.includes(0)
    })

    ctx.body = { tokenId }
    ctx.status = 201
})

router.get('/places/:tokenId/trackers', async ctx => {
    const places = await new TrackerRepository().getTrackers({
        placeId: ctx.params.tokenId,
        sort: ctx.request.query.sort,
        status: ctx.request.query.status,
        type: ctx.request.query.type,
        pageSize: ctx.request.query.pageSize,
        nextPageKey: ctx.request.query.nextPageKey
    })
    ctx.body = places
    ctx.status = 200
})

router.get('/trackers/:tokenId', async ctx => {
    const tracker = await new TrackerRepository().getTracker(ctx.params.tokenId)
    const user = await new UserRepository().getUserById(tracker.userId)
    const tokenInfo = await getTokenWithUserInfo(ctx.params.tokenId, user.walletAddress)

    ctx.body = {
        ...tracker,
        ...tokenInfo
    }
})

router.put('/trackers/:tokenId', jwtAuthorize, bodyParser(), async ctx => {
    const trackerRepository = new TrackerRepository()
    const [tracker, user] = await Promise.all([trackerRepository.getTracker(ctx.params.tokenId), new UserRepository().getUserByOauthId(ctx.state.jwt.sub)])

    const isAdmin = user.permissions.includes(0)

    if (!isAdmin && user.id !== tracker.userId) throw new UserUnauthorizedError()

    await trackerRepository.updateTracker({
        tokenId: ctx.params.tokenId,
        utilityName: ctx.request.body.utilityName,
        utilityAccountId: ctx.request.body.utilityAccountId,
        utilityAccountApiKey: ctx.request.body.utilityAccountApiKey
    })

    ctx.status = 204
})

router.post('/readings', jwtAuthorize, bodyParser(), async ctx => {
    if (!ctx.request.body.trackerId) throw new MissingParameterError('trackerId')
    if (!ctx.request.body.value) throw new MissingParameterError('value')
    if (!ctx.request.body.unit) throw new MissingParameterError('unit')

    const stdlib = new ReachProvider().getStdlib()
    const [algoAccount, user] = await Promise.all([stdlib.newAccountFromMnemonic(process.env.ALGO_ACCOUNT_MNEMONIC), new UserRepository().getUserByOauthId(ctx.state.jwt.sub)])

    // Make reading transaction
    const { iv, encryptedData } = aes256encrypt(ctx.request.body.value)
    const note = { type: 'terragrids-reading', trackerId: ctx.request.body.trackerId, value: encryptedData, unit: ctx.request.body.unit, encryption: 'aes256' }
    const { id } = await makeZeroTransactionToSelf(stdlib, algoAccount, note)

    // Save reading off-chain
    await new TrackerRepository().createReading({
        id,
        trackerId: ctx.request.body.trackerId,
        userId: user.id,
        encryptionIV: iv,
        isAdmin: user.permissions.includes(0)
    })

    ctx.body = { id }
    ctx.status = 201
})

router.get('/trackers/:tokenId/readings', async ctx => {
    const repositoryResponse = await new TrackerRepository().getReadings({
        trackerId: ctx.params.tokenId,
        sort: ctx.request.query.sort,
        status: ctx.request.query.status,
        pageSize: ctx.request.query.pageSize,
        nextPageKey: ctx.request.query.nextPageKey
    })

    const promises = []
    const indexer = new AlgoIndexer()
    for (const reading of repositoryResponse.readings) {
        promises.push(
            (async () => {
                const response = await indexer.callAlgonodeIndexerEndpoint(`transactions/${reading.id}`)
                if (!response || response.status !== 200) {
                    return null
                }
                if (response.json.transaction.note) {
                    try {
                        var note = JSON.parse(Buffer.from(response.json.transaction.note, 'base64'))
                        const value = note.encryption === 'aes256' ? aes256decrypt(note.value, reading.iv) : note.value
                        return { ...reading, iv: undefined, value, unit: note.unit }
                    } catch (e) {
                        return null
                    }
                } else {
                    return reading
                }
            })()
        )
    }

    const readings = await Promise.all(promises)

    ctx.body = { readings: readings.filter(reading => reading !== null) }
    ctx.status = 200
})

/* istanbul ignore next */
router.get('/trackers/:tokenId/utility/meters', jwtAuthorize, async ctx => {
    const trackerRepository = new TrackerRepository()
    const [tracker, user] = await Promise.all([trackerRepository.getTracker(ctx.params.tokenId, true), new UserRepository().getUserByOauthId(ctx.state.jwt.sub)])

    const isAdmin = user.permissions.includes(0)

    if (!isAdmin && user.id !== tracker.userId) throw new UserUnauthorizedError()
    if (!tracker.utilityAccountId || !tracker.utilityAccountApiKey) throw new UtilityAccountNotFound()

    const response = await new OctopusEnergyApi().callOctopusEnergyApiEndpoint(`accounts/${tracker.utilityAccountId}`, tracker.utilityAccountApiKey)

    if (response.status !== 200 || !response.json.properties) throw new UtilityAccountNotFound()

    const electricityMeterPoints = []
    const gasMeterPoints = []

    response.json.properties.forEach(prop => {
        electricityMeterPoints.push(
            ...prop.electricity_meter_points.map(point => ({
                mpan: point.mpan,
                meters: point.meters.map(meter => ({ serialNumber: meter['serial_number'] }))
            }))
        )

        gasMeterPoints.push(
            ...prop.gas_meter_points.map(point => ({
                mprn: point.mprn,
                meters: point.meters.map(meter => ({ serialNumber: meter['serial_number'] }))
            }))
        )
    })

    ctx.body = {
        electricityMeterPoints,
        gasMeterPoints
    }
    ctx.status = 200
})

router.get('/readings/:txnId', async ctx => {
    const [reading, txnResponse] = await Promise.all([new TrackerRepository().getReading(ctx.params.txnId), new AlgoIndexer().callAlgonodeIndexerEndpoint(`transactions/${ctx.params.txnId}`)])
    if (!txnResponse || txnResponse.status !== 200) {
        throw new ReadingNotFoundError()
    }

    var note = JSON.parse(Buffer.from(txnResponse.json.transaction.note, 'base64'))
    const value = note.encryption === 'aes256' ? aes256decrypt(note.value, reading.iv) : note.value
    ctx.body = { ...reading, iv: undefined, value, unit: note.unit }
    ctx.status = 200
})

app.use(requestLogger).use(errorHandler).use(router.routes()).use(router.allowedMethods())
