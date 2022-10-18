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
import { getJsonStringFromContract } from './utils/string-utils.js'
import { createPromise } from './utils/promise.js'
import MissingParameterError from './error/missing-parameter.error.js'
import ParameterTooLongError from './error/parameter-too-long.error.js'
import AddressMalformedError from './error/address-malformed.error.js'

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

    const [algoClientHC, algoIndexerHC, algoAccount] = await Promise.all([
        provider.algodClient.healthCheck().do(), // algo sdk client
        provider.indexer.makeHealthCheck().do(), // algo indexer client
        stdlib.newAccountFromMnemonic(process.env.ALGO_ACCOUNT_MNEMONIC) // reach account handle
    ])

    const ok = 'ok'
    const error = 'error'

    ctx.body = {
        env: process.env.ENV,
        region: process.env.AWS_REGION,
        reach: {
            network: reachProvider.getEnv(),
            algoClient: JSON.stringify(algoClientHC) === '{}' ? ok : error,
            algoIndexer: algoIndexerHC.version ? ok : error,
            algoAccount: algoAccount.networkAccount ? ok : error
        }
    }
})

router.post('/project', bodyParser(), async ctx => {
    if (!ctx.request.body.name) throw new MissingParameterError('name')
    if (!ctx.request.body.url) throw new MissingParameterError('url')
    if (!ctx.request.body.hash) throw new MissingParameterError('hash')
    if (!ctx.request.body.creator) throw new MissingParameterError('creator')

    if (ctx.request.body.name.length > 128) throw new ParameterTooLongError('name')
    if (ctx.request.body.url.length > 128) throw new ParameterTooLongError('url')
    if (ctx.request.body.hash.length > 32) throw new ParameterTooLongError('hash')
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
                onReady: contract => {
                    try {
                        succeed(getJsonStringFromContract(contract))
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

app.use(requestLogger).use(errorHandler).use(router.routes()).use(router.allowedMethods())
