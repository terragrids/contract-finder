import GenericError from './generic-error.js'

export class UtilityMeterConsumptionNotFoundError extends GenericError {
    httpCode = 404
    message

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'UtilityMeterConsumptionNotFoundError',
            message: 'No utility meter consumption found'
        }
    }
}
