import GenericError from './generic-error.js'

export default class AssetNotFoundError extends GenericError {
    httpCode = 404

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'AssetNotFoundError',
            message: 'Asset specified not found'
        }
    }
}