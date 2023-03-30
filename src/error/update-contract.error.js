import GenericError from './generic-error.js'

export default class UpdatePlaceTokenError extends GenericError {
    httpCode = 500
    error

    constructor(error) {
        super()
        this.error = error
    }

    toJson() {
        return {
            error: 'UpdatePlaceTokenError',
            message: 'Unable to update place token'
        }
    }
}
