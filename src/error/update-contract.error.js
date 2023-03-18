import GenericError from './generic-error.js'

export default class UpdateContractError extends GenericError {
    httpCode = 500
    error

    constructor(error) {
        super()
        this.error = error
    }

    toJson() {
        return {
            error: 'UpdateContractError',
            message: 'Unable to update place contract'
        }
    }
}
