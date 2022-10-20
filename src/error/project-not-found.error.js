import GenericError from './generic-error.js'

export default class ProjectNotFoundError extends GenericError {
    httpCode = 404

    constructor() {
        super()
    }

    toJson() {
        return {
            error: 'ProjectNotFoundError',
            message: 'Project specified not found'
        }
    }
}
