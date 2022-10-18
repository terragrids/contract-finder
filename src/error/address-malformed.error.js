import GenericError from './generic-error.js'

export default class AddressMalformedError extends GenericError {
    httpCode = 400
    error

    constructor(error) {
        super()
        this.error = error
    }

    toJson() {
        return {
            error: 'AddressMalformedError',
            message: 'The specified address is malformed'
        }
    }
}
