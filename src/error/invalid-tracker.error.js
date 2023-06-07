import GenericError from './generic-error.js'

export default class InvalidTrackerError extends GenericError {
    httpCode = 400
    message

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'InvalidTrackerError',
            message: 'Invalid tracker type'
        }
    }
}
