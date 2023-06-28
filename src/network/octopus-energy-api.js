import fetch from 'node-fetch'

export default class OctopusEnergyApi {
    async callOctopusEnergyApiEndpoint(path, apiKey) {
        const auth = Buffer.from(`${apiKey}:`).toString('base64')
        const response = await fetch(`https://api.octopus.energy/v1/${path}`, {
            headers: { Authorization: `Basic ${auth}` }
        })
        return {
            status: response.status,
            json: await response.json()
        }
    }
}
