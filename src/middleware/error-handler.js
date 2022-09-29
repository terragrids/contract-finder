import GenericError from '../error/generic-error.js'
import Logger from '../logging/logger.js'

export default async function errorHandler(ctx, next) {
    const logger = new Logger()
    try {
        await next()
    } catch (e) {
        logger.error(e.toString())
        if (e instanceof GenericError) {
            if (e.error) {
                logger.error(e.error.message)
            }
            ctx.status = e.httpCode
            ctx.body = e.toJson()
        } else {
            ctx.status = 500
            ctx.body = ''
        }
    }
}
