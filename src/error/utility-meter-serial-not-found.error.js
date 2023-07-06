import GenericError from './generic-error.js'

export class UtilityMeterSerialNotFoundError extends GenericError {
    httpCode = 404
    message

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'UtilityMeterSerialNotFoundError',
            message: 'No utility meter serial number found'
        }
    }
}
