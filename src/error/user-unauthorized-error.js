import GenericError from './generic-error.js'

export class UserUnauthorizedError extends GenericError {
    httpCode = 403
    message

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'UserUnauthorizedError',
            message: 'The authenticated user is not authorized to perform this action'
        }
    }
}
