import GenericError from './generic-error.js'

export default class TrackerNotFoundError extends GenericError {
    httpCode = 404

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'TrackerNotFoundError',
            message: 'Tracker specified not found'
        }
    }
}
