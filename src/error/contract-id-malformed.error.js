import GenericError from './generic-error.js'

export default class ContractIdMalformedError extends GenericError {
    httpCode = 400
    error

    constructor(error) {
        super()
        this.error = error
    }

    toJson() {
        return {
            error: 'ContractIdMalformedError',
            message: 'The specified contract identifier is malformed'
        }
    }
}
