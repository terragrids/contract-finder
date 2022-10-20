import GenericError from './generic-error.js'

export default class ReadContractError extends GenericError {
    httpCode = 500
    error

    constructor(error) {
        super()
        this.error = error
    }

    toJson() {
        return {
            error: 'ReadContractError',
            message: 'Unable to read project contract'
        }
    }
}
