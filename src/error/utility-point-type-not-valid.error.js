import GenericError from './generic-error.js'

export class UtilityPointTypeNotValidError extends GenericError {
    httpCode = 400
    message

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'UtilityPointTypeNotValidError',
            message: 'Utility point type not valid'
        }
    }
}
