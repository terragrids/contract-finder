'use strict'

import dotenv from 'dotenv'
import Koa from 'koa'
import Router from '@koa/router'
import bodyParser from 'koa-bodyparser'
import errorHandler from './middleware/error-handler.js'
import requestLogger from './middleware/request-logger.js'
import DeployContractError from './error/deploy-contract.error.js'
import ReachProvider from './provider/reach-provider.js'
import * as backend from '../reach/project-contract/build/index.main.mjs'
import { getContractFromJsonString, getJsonStringFromContract } from './utils/string-utils.js'
import { createPromise } from './utils/promise.js'
import MissingParameterError from './error/missing-parameter.error.js'
import ParameterTooLongError from './error/parameter-too-long.error.js'
import AddressMalformedError from './error/address-malformed.error.js'
import DynamoDbRepository from './repository/dynamodb.repository.js'
import ProjectRepository from './repository/project.repository.js'
import ReadContractError from './error/read-contract.error.js'
import UpdateContractError from './error/update-contract.error.js'
import authHandler from './middleware/auth-handler.js'
import { UserUnauthorizedError } from './error/user-unauthorized-error.js'
import MintTokenError from './error/mint-token.error.js'
import { algorandAddressFromCID, cidFromAlgorandAddress } from './utils/token-utils.js'
import AlgoIndexer from './network/algo-indexer.js'
import AssetNotFoundError from './error/asset-not-found.error.js'

dotenv.config()
export const app = new Koa()
const router = new Router()

router.get('/', ctx => {
    ctx.body = 'terragrids project contract api'
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

router.post('/projects/token', authHandler, bodyParser(), async ctx => {
    if (!ctx.request.body.name) throw new MissingParameterError('name')
    if (!ctx.request.body.cid) throw new MissingParameterError('cid')

    if (ctx.request.body.name.length > 128) throw new ParameterTooLongError('name')

    const stdlib = new ReachProvider().getStdlib()

    try {
        const algoAccount = await stdlib.newAccountFromMnemonic(process.env.ALGO_ACCOUNT_MNEMONIC)

        const cid = ctx.request.body.cid
        const { address, url } = algorandAddressFromCID(stdlib.algosdk, cid)
        const cidFromAddress = cidFromAlgorandAddress(stdlib.algosdk, address)
        if (cid !== cidFromAddress) throw new Error('Error verifying cid')

        const token = await stdlib.launchToken(algoAccount, ctx.request.body.name, 'TRPRJ', {
            supply: 1,
            decimals: 0,
            url,
            reserve: address,
            manager: algoAccount.networkAccount.addr
        })

        ctx.body = { id: token.id.toNumber() }
        ctx.status = 201
    } catch (e) {
        throw new MintTokenError(e)
    }
})

router.post('/projects', authHandler, bodyParser(), async ctx => {
    if (!ctx.request.body.name) throw new MissingParameterError('name')
    if (!ctx.request.body.creator) throw new MissingParameterError('creator')
    if (!ctx.request.body.cid) throw new MissingParameterError('cid')
    if (!ctx.request.body.offChainImageUrl) throw new MissingParameterError('offChainImageUrl')

    if (ctx.request.body.name.length > 128) throw new ParameterTooLongError('name')
    if (ctx.request.body.creator.length > 64) throw new ParameterTooLongError('creator')
    if (ctx.request.body.offChainImageUrl && ctx.request.body.offChainImageUrl.length > 128) throw new ParameterTooLongError('offChainImageUrl')
    if (ctx.state.account !== ctx.request.body.creator) throw new UserUnauthorizedError()

    const stdlib = new ReachProvider().getStdlib()
    const algoAccount = await stdlib.newAccountFromMnemonic(process.env.ALGO_ACCOUNT_MNEMONIC)

    try {
        stdlib.protect(stdlib.T_Address, ctx.request.body.creator)
    } catch (e) {
        throw new AddressMalformedError(e)
    }

    /**
     * Mint project token
     */

    let tokenId
    try {
        const cid = ctx.request.body.cid
        const { address, url } = algorandAddressFromCID(stdlib.algosdk, cid)
        const cidFromAddress = cidFromAlgorandAddress(stdlib.algosdk, address)
        if (cid !== cidFromAddress) throw new Error('Error verifying cid')

        const token = await stdlib.launchToken(algoAccount, ctx.request.body.name, 'TRPRJ', {
            supply: 1,
            decimals: 0,
            url,
            reserve: address,
            manager: algoAccount.networkAccount.addr
        })

        tokenId = token.id.toNumber()
    } catch (e) {
        throw new MintTokenError(e)
    }

    /**
     * Deploy project contract
     */

    try {
        const { promise, succeed, fail } = createPromise()

        try {
            const contract = algoAccount.contract(backend)
            contract.p.Admin({
                log: () => {},
                onReady: async contract => {
                    try {
                        const contractId = getJsonStringFromContract(contract)
                        await new ProjectRepository().createProject({
                            contractId,
                            name: ctx.request.body.name,
                            offChainImageUrl: ctx.request.body.offChainImageUrl,
                            creator: ctx.request.body.creator,
                            tokenId: tokenId
                        })
                        succeed(contractId)
                    } catch (e) {
                        fail(e)
                    }
                },
                creator: ctx.request.body.creator,
                token: tokenId
            })
        } catch (e) {
            fail(e)
        }

        const contractInfo = await promise

        ctx.body = { contractInfo, tokenId }
        ctx.status = 201
    } catch (e) {
        throw new DeployContractError(e)
    }
})

router.put('/projects/:contractId', authHandler, bodyParser(), async ctx => {
    ctx.body = ''
    if (!ctx.request.body.name && !ctx.request.body.url && !ctx.request.body.hash && !ctx.request.body.offChainImageUrl) {
        ctx.status = 204
        return
    }

    if (ctx.request.body.url && !ctx.request.body.hash) throw new MissingParameterError('hash')
    if (ctx.request.body.hash && !ctx.request.body.url) throw new MissingParameterError('url')

    if (ctx.request.body.name && ctx.request.body.name.length > 128) throw new ParameterTooLongError('name')
    if (ctx.request.body.url && ctx.request.body.url.length > 128) throw new ParameterTooLongError('url')
    if (ctx.request.body.hash && ctx.request.body.hash.length > 64) throw new ParameterTooLongError('hash')
    if (ctx.request.body.offChainImageUrl && ctx.request.body.offChainImageUrl.length > 128) throw new ParameterTooLongError('offChainImageUrl')

    const repository = new ProjectRepository()
    const project = await repository.getProject(ctx.params.contractId)

    if (ctx.state.account !== project.creator) throw new UserUnauthorizedError()

    try {
        const stdlib = new ReachProvider().getStdlib()
        const algoAccount = await stdlib.newAccountFromMnemonic(process.env.ALGO_ACCOUNT_MNEMONIC)
        const infoObject = getContractFromJsonString(project.id)
        const contract = algoAccount.contract(backend, infoObject)
        const api = contract.a.Api
        if (ctx.request.body.name) await api.updateName(ctx.request.body.name)
        if (ctx.request.body.url && ctx.request.body.hash) await api.updateMetadata(ctx.request.body.url, ctx.request.body.hash)

        await repository.updateProject({
            contractId: ctx.params.contractId,
            name: ctx.request.body.name,
            offChainImageUrl: ctx.request.body.offChainImageUrl
        })

        ctx.status = 204
    } catch (e) {
        throw new UpdateContractError(e)
    }
})

router.get('/projects', async ctx => {
    const projects = await new ProjectRepository().getProjects({
        sort: ctx.request.query.sort,
        pageSize: ctx.request.query.pageSize,
        nextPageKey: ctx.request.query.nextPageKey
    })
    ctx.body = projects
    ctx.status = 200
})

router.get('/projects/:contractId', async ctx => {
    const project = await new ProjectRepository().getProject(ctx.params.contractId)

    let balance, tokenBalance, tokenId, creator
    try {
        const stdlib = new ReachProvider().getStdlib()
        const algoAccount = await stdlib.createAccount()

        const infoObject = getContractFromJsonString(project.id)
        const contract = algoAccount.contract(backend, infoObject)
        const view = contract.v.View

        // We need to read different view parameters sequentially
        balance = (await view.balance())[1].toNumber()
        tokenBalance = (await view.tokenBalance())[1].toNumber()
        tokenId = (await view.token())[1].toNumber()
        creator = stdlib.formatAddress((await view.creator())[1])
    } catch (e) {
        throw new ReadContractError(e)
    }

    const indexerResponse = await new AlgoIndexer().callAlgonodeIndexerEndpoint(`assets/${tokenId}`)
    if (indexerResponse.status !== 200 || indexerResponse.json.asset.deleted) throw new AssetNotFoundError()

    ctx.body = {
        ...project,
        balance,
        approved: tokenBalance === 0,
        tokenId,
        creator,
        name: indexerResponse.json.asset.params.name,
        url: indexerResponse.json.asset.params.url,
        reserve: indexerResponse.json.asset.params.reserve
    }
})

router.get('/creators/:creatorId/projects', async ctx => {
    const projects = await new ProjectRepository().getProjectsByCreator({
        creator: ctx.params.creatorId,
        sort: ctx.request.query.sort,
        pageSize: ctx.request.query.pageSize,
        nextPageKey: ctx.request.query.nextPageKey
    })
    ctx.body = projects
    ctx.status = 200
})

app.use(requestLogger).use(errorHandler).use(router.routes()).use(router.allowedMethods())
