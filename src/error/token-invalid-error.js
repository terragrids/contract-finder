import GenericError from './generic-error.js'

export class TokenInvalidError extends GenericError {
    httpCode = 401
    message

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'TokenInvalidError',
            message: 'Invalid token'
        }
    }
}
