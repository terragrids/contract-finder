import GenericError from './generic-error.js'

export default class DeployContractError extends GenericError {
    httpCode = 500
    message

    constructor(message) {
        super()
        this.message = message
    }

    toJson() {
        return {
            error: 'DeployContractError',
            message: 'Unable to deploy project contract'
        }
    }
}
