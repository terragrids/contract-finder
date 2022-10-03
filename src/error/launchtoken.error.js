import GenericError from './generic-error.js'

export default class LaunchTokenError extends GenericError {
    httpCode = 500
    message

    constructor(message) {
        super()
        this.message = message
    }

    toJson() {
        return {
            error: 'LaunchTokenError',
            message: 'Unable to create project token'
        }
    }
}
