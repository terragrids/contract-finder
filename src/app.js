'use strict'

import dotenv from 'dotenv'
import Koa from 'koa'
import Router from '@koa/router'
import bodyParser from 'koa-bodyparser'
import errorHandler from './middleware/error-handler.js'
import requestLogger from './middleware/request-logger.js'
import LaunchTokenError from './error/launchtoken.error.js'
import ReachProvider from './provider/reach-provider.js'

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
    const stdlib = new ReachProvider().getStdlib()

    try {
        const algoAccount = await stdlib.newAccountFromMnemonic(process.env.ALGO_ACCOUNT_MNEMONIC)
        const projectToken = await stdlib.launchToken(algoAccount, 'Terragrids Project', 'TRPRJ', { supply: 1, decimals: 0, url: 'https://terragrids.org', manager: process.env.ALGO_ACCOUNT_ADDRESS })
        ctx.body = { projectToken: projectToken.id.toNumber() }
        ctx.status = 201
    } catch (e) {
        throw new LaunchTokenError()
    }
})

app.use(requestLogger).use(errorHandler).use(router.routes()).use(router.allowedMethods())
