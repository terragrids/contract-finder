export default class GenericError extends Error {
    httpCode = 500

    constructor() {
        super()
    }

    toJson() {
        return {}
    }

    toString() {
        return JSON.stringify(this.toJson())
    }
}
