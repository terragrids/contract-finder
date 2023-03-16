import GenericError from './generic-error.js'

export default class JwksFetchError extends GenericError {
    httpCode = 500

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'JwksFetchError',
            message: 'Error fetching jwks'
        }
    }
}
