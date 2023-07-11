import GenericError from './generic-error.js'

export class TypePositiveOrZeroNumberError extends GenericError {
    httpCode = 400
    message

    constructor(parameter) {
        super()
        this.message = `${parameter} must be zero or a positive number`
    }

    toJson() {
        return {
            error: 'TypePositiveOrZeroNumberError',
            message: this.message
        }
    }
}
