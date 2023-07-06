import GenericError from './generic-error.js'

export default class TimeFormatNotValidError extends GenericError {
    httpCode = 400

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'TimeFormatNotValidError',
            message: 'Time format not valid'
        }
    }
}
