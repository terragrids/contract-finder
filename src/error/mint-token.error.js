import GenericError from './generic-error.js'

export default class MintTokenError extends GenericError {
    httpCode = 500
    error

    constructor(error) {
        super()
        this.error = error
    }

    toJson() {
        return {
            error: 'MintTokenError',
            message: 'Unable to mint token'
        }
    }
}
