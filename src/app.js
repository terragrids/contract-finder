'use strict'

import dotenv from 'dotenv'
import Koa from 'koa'
import Router from '@koa/router'
import errorHandler from './middleware/error-handler.js'
import requestLogger from './middleware/request-logger.js'
import { loadStdlib } from '@reach-sh/stdlib'

dotenv.config()
export const app = new Koa()
const router = new Router()

router.get('/', ctx => {
    ctx.body = 'terragrids project contract api'
})

router.get('/hc', async ctx => {
    const stdlib = loadStdlib({
        ...process.env,
        REACH_CONNECTOR_MODE: 'ALGO'
    })

    const env = process.env.ENV === 'prod' ? 'MainNet' : 'TestNet'

    stdlib.setProviderByName(env)
    const provider = await stdlib.getProvider()

    const [algoClientHC, algoIndexerHC, algoAccount] = await Promise.all([
        provider.algodClient.healthCheck().do(), // algo sdk client
        provider.indexer.makeHealthCheck().do(), // algo indexer client
        stdlib.newAccountFromMnemonic(process.env.ALGO_ACCOUNT_MNEMONIC) // reach account handle
    ])

    console.log(JSON.stringify(algoAccount, null, 4))

    const ok = 'ok'
    const error = 'error'

    ctx.body = {
        env: process.env.ENV,
        region: process.env.AWS_REGION,
        reach: {
            network: env,
            algoClient: JSON.stringify(algoClientHC) === '{}' ? ok : error,
            algoIndexer: algoIndexerHC.version ? ok : error,
            algoAccount: algoAccount.networkAccount ? ok : error
        }
    }
})

app.use(requestLogger).use(errorHandler).use(router.routes()).use(router.allowedMethods())
