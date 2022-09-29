'use strict'

import dotenv from 'dotenv'
import Koa from 'koa'
import Router from '@koa/router'
import errorHandler from './middleware/error-handler.js'
import requestLogger from './middleware/request-logger.js'

dotenv.config()
export const app = new Koa()
const router = new Router()

router.get('/', ctx => {
    ctx.body = 'terragrids project contractor api'
})

router.get('/hc', async ctx => {
    ctx.body = {
        env: process.env.ENV,
        region: process.env.AWS_REGION
    }
})

app.use(requestLogger).use(errorHandler).use(router.routes()).use(router.allowedMethods())
