import GenericError from './generic-error.js'

export class UtilityMeterPointNotFoundError extends GenericError {
    httpCode = 404
    message

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'UtilityMeterPointNotFoundError',
            message: 'No utility meter points found'
        }
    }
}
