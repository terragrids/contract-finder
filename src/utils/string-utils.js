export function getJsonStringFromContract(contract) {
    return Buffer.from(JSON.stringify(contract)).toString('base64')
}

export function getContractFromJsonString(contractInfo) {
    return JSON.parse(Buffer.from(contractInfo, 'base64'))
}

// eslint-disable-next-line no-control-regex
export const removePadding = s => s.replace(/\x00/g, '')
