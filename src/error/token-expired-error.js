import GenericError from './generic-error.js'

export class TokenExpiredError extends GenericError {
    httpCode = 401
    message

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'TokenExpiredError',
            message: 'Token expired'
        }
    }
}
