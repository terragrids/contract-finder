import GenericError from './generic-error.js'

export default class DeployContractError extends GenericError {
    httpCode = 500
    error

    constructor(error) {
        super()
        this.error = error
    }

    toJson() {
        return {
            error: 'DeployContractError',
            message: 'Unable to deploy project contract'
        }
    }
}
