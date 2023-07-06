import GenericError from './generic-error.js'

export class UtilityAccountNotFoundError extends GenericError {
    httpCode = 404
    message

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'UtilityAccountNotFoundError',
            message: 'No utility account details found'
        }
    }
}
