import GenericError from './generic-error.js'

export default class MissingParameterError extends GenericError {
    httpCode = 400
    message

    constructor(parameter) {
        super()
        this.message = `${parameter} must be specified`
    }

    toJson() {
        return {
            error: 'MissingParameterError',
            message: this.message
        }
    }
}
