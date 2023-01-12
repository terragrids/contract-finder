import ContractIdMalformedError from '../error/contract-id-malformed.error.js'

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

// eslint-disable-next-line no-control-regex
export const removePadding = s => s.replace(/\x00/g, '')
