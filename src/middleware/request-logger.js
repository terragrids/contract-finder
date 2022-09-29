import Logger from '../logging/logger.js'

export default async function requestLogger(ctx, next) {
    new Logger().info(`${ctx.request.method} ${ctx.request.url}`)
    await next()
}
