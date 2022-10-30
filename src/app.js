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
import { getContractFromJsonString, getJsonStringFromContract, removePadding } from './utils/string-utils.js'
import { createPromise } from './utils/promise.js'
import MissingParameterError from './error/missing-parameter.error.js'
import ParameterTooLongError from './error/parameter-too-long.error.js'
import AddressMalformedError from './error/address-malformed.error.js'
import DynamoDbRepository from './repository/dynamodb.repository.js'
import ProjectRepository from './repository/project.repository.js'
import ReadContractError from './error/read-contract.error.js'
import UpdateContractError from './error/update-contract.error.js'

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

router.post('/projects', bodyParser(), async ctx => {
    if (!ctx.request.body.name) throw new MissingParameterError('name')
    if (!ctx.request.body.url) throw new MissingParameterError('url')
    if (!ctx.request.body.hash) throw new MissingParameterError('hash')
    if (!ctx.request.body.creator) throw new MissingParameterError('creator')

    if (ctx.request.body.name.length > 128) throw new ParameterTooLongError('name')
    if (ctx.request.body.url.length > 128) throw new ParameterTooLongError('url')
    if (ctx.request.body.offChainImageUrl && ctx.request.body.offChainImageUrl.length > 128) throw new ParameterTooLongError('offChainImageUrl')
    if (ctx.request.body.hash.length > 64) throw new ParameterTooLongError('hash')
    if (ctx.request.body.creator.length > 64) throw new ParameterTooLongError('creator')

    const stdlib = new ReachProvider().getStdlib()

    try {
        stdlib.protect(stdlib.T_Address, ctx.request.body.creator)
    } catch (e) {
        throw new AddressMalformedError(e)
    }

    try {
        const algoAccount = await stdlib.newAccountFromMnemonic(process.env.ALGO_ACCOUNT_MNEMONIC)

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
                            creator: ctx.request.body.creator
                        })
                        succeed(contractId)
                    } catch (e) {
                        fail(e)
                    }
                },
                name: ctx.request.body.name,
                url: ctx.request.body.url,
                hash: ctx.request.body.hash,
                creator: ctx.request.body.creator
            })
        } catch (e) {
            fail(e)
        }

        const contractInfo = await promise

        ctx.body = { contractInfo }
        ctx.status = 201
    } catch (e) {
        throw new DeployContractError(e)
    }
})

router.put('/projects/:contractId', bodyParser(), async ctx => {
    ctx.body = ''
    if (!ctx.request.body.name && !ctx.request.body.url && !ctx.request.body.hash) {
        ctx.status = 204
        return
    }

    if (ctx.request.body.url && !ctx.request.body.hash) throw new MissingParameterError('hash')
    if (ctx.request.body.hash && !ctx.request.body.url) throw new MissingParameterError('url')

    if (ctx.request.body.name && ctx.request.body.name.length > 128) throw new ParameterTooLongError('name')
    if (ctx.request.body.url && ctx.request.body.url.length > 128) throw new ParameterTooLongError('url')
    if (ctx.request.body.hash && ctx.request.body.hash.length > 64) throw new ParameterTooLongError('hash')

    const project = await new ProjectRepository().getProject(ctx.params.contractId)

    try {
        const stdlib = new ReachProvider().getStdlib()
        const algoAccount = await stdlib.newAccountFromMnemonic(process.env.ALGO_ACCOUNT_MNEMONIC)
        const infoObject = getContractFromJsonString(project.id)
        const contract = algoAccount.contract(backend, infoObject)
        const api = contract.a.Api
        if (ctx.request.body.name) await api.updateName(ctx.request.body.name)
        if (ctx.request.body.url && ctx.request.body.hash) await api.updateMetadata(ctx.request.body.url, ctx.request.body.hash)
        ctx.status = 204
    } catch (e) {
        throw new UpdateContractError(e)
    }
})

router.get('/projects/:contractId', async ctx => {
    const project = await new ProjectRepository().getProject(ctx.params.contractId)

    try {
        const stdlib = new ReachProvider().getStdlib()
        const algoAccount = await stdlib.createAccount()

        const infoObject = getContractFromJsonString(project.id)
        const contract = algoAccount.contract(backend, infoObject)
        const view = contract.v.View

        // We need to read different view parameters sequentially
        const name = removePadding((await view.name())[1])
        const url = removePadding((await view.url())[1])
        const hash = removePadding((await view.hash())[1])
        const creator = stdlib.formatAddress((await view.creator())[1])

        ctx.body = { ...project, creator, name, hash, url }
    } catch (e) {
        throw new ReadContractError(e)
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
