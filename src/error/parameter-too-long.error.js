import GenericError from './generic-error.js'

export default class ParameterTooLongError extends GenericError {
    httpCode = 400
    message

    constructor(parameter) {
        super()
        this.message = `${parameter} is too long`
    }

    toJson() {
        return {
            error: 'ParameterTooLongError',
            message: this.message
        }
    }
}
