import GenericError from './generic-error.js'

export default class ReadingNotFoundError extends GenericError {
    httpCode = 404

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'ReadingNotFoundError',
            message: 'Reading specified not found'
        }
    }
}
