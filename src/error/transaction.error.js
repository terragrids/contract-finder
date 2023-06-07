import GenericError from './generic-error.js'

export default class TransactionError extends GenericError {
    httpCode = 500
    error

    constructor(error) {
        super()
        this.error = error
    }

    toJson() {
        return {
            error: 'TransactionError',
            message: 'Unable to create transaction'
        }
    }
}
