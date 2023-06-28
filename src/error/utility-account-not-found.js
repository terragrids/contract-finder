import GenericError from './generic-error.js'

export class UtilityAccountNotFound extends GenericError {
    httpCode = 404
    message

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'UtilityAccountNotFound',
            message: 'No utility account details found'
        }
    }
}
