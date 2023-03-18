import GenericError from './generic-error.js'

export default class PlaceNotFoundError extends GenericError {
    httpCode = 404

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'PlaceNotFoundError',
            message: 'Place specified not found'
        }
    }
}
