import GenericError from './generic-error.js'

export class TypePositiveNumberError extends GenericError {
    httpCode = 400
    message

    constructor(parameter) {
        super()
        this.message = `${parameter} must be a positive number`
    }

    toJson() {
        return {
            error: 'TypePositiveNumberError',
            message: this.message
        }
    }
}
