import NotFoundError from '../error/not-found.error'
import errorHandler from './error-handler'

describe('errorHandler', function () {
    it('should call next', async () => {
        const next = jest.fn()
        const ctx = {}

        await errorHandler(ctx, next)

        expect(next).toHaveBeenCalledTimes(1)
    })

    it('should set http status when status code is a number', async () => {
        const next = jest.fn().mockImplementationOnce(() => {
            throw new NotFoundError()
        })
        const ctx = {}

        await errorHandler(ctx, next)

        expect(ctx.status).toEqual(404)
        expect(ctx.body).toEqual({
            error: 'NotFoundError',
            message: 'Item specified not found'
        })
    })

    it('should set http status to 500 when status code is not a number', async () => {
        const next = jest.fn().mockImplementationOnce(() => {
            throw new Error('error')
        })
        const ctx = {}

        await errorHandler(ctx, next)

        expect(ctx.status).toEqual(500)
        expect(ctx.body).toEqual('')
    })
})
