export function getJsonStringFromContract(contract) {
    return Buffer.from(JSON.stringify(contract)).toString('base64')
}
