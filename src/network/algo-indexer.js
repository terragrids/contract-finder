import fetch from 'node-fetch'

function algonodeIndexerEndpoint(path) {
    const algonodeEnv = process.env.ENV === 'dev' ? 'testnet' : 'mainnet'
    return `https://${algonodeEnv}-idx.algonode.cloud/v2/${path}`
}

export default class AlgoIndexer {
    async callAlgonodeIndexerEndpoint(path) {
        const response = await fetch(algonodeIndexerEndpoint(path))
        return {
            status: response.status,
            json: await response.json()
        }
    }
}
