import GenericError from './generic-error.js'

export default class RepositoryError extends GenericError {
    error
    httpCode = 500
    message

    constructor(error, message) {
        super()
        this.error = error
        this.message = message
    }

    toJson() {
        return {
            error: 'RepositoryError',
            message: this.message,
            ...(process.env.ENV !== 'prod' && { info: this.error.message })
        }
    }
}
