import GenericError from './generic-error.js'

export default class NotFoundError extends GenericError {
    httpCode = 404

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'NotFoundError',
            message: 'Item specified not found'
        }
    }
}
