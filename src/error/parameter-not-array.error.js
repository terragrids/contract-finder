import GenericError from './generic-error.js'

export default class ParameterNotArrayError extends GenericError {
    httpCode = 400
    message

    constructor(parameter) {
        super()
        this.message = `${parameter} must be an array of items`
    }

    toJson() {
        return {
            error: 'ParameterNotArrayError',
            message: this.message
        }
    }
}
