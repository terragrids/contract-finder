import ContractIdMalformedError from '../error/contract-id-malformed.error.js'
import TimeFormatNotValidError from '../error/time-format-not-valid.error.js'

export function getJsonStringFromContract(contract) {
    return Buffer.from(JSON.stringify(contract)).toString('base64')
}

export function getContractFromJsonString(contractInfo) {
    try {
        return JSON.parse(Buffer.from(contractInfo, 'base64'))
    } catch (e) {
        throw new ContractIdMalformedError()
    }
}

export function truncateString(s, maxLength) {
    if (s.length > maxLength) {
        s = s.substring(0, maxLength - 3) + '…'
    }
    return s
}

// eslint-disable-next-line no-control-regex
export const removePadding = s => s.replace(/\x00/g, '')

export function makeQueryString(parameters) {
    const query = []
    if (parameters) {
        for (const param in parameters) {
            if (parameters[param] !== undefined) query.push(`${param}=${parameters[param]}`)
        }
    }
    let queryString = ''
    if (query.length > 0) {
        queryString = `?${query.join('&')}`
    }

    return queryString
}

export function convertUnixTimestampToIsoTimeString(timestamp) {
    try {
        return new Date(parseInt(timestamp)).toISOString()
    } catch (e) {
        throw new TimeFormatNotValidError()
    }
}

export function convertIsoTimeStringToUnixTimestamp(isoTime) {
    try {
        return new Date(isoTime).getTime()
    } catch (e) {
        throw new TimeFormatNotValidError()
    }
}
