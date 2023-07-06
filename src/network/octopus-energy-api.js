import fetch from 'node-fetch'
import { makeQueryString } from '../utils/string-utils.js'

export default class OctopusEnergyApi {
    async callOctopusEnergyApiEndpoint(path, apiKey, parameters) {
        const auth = Buffer.from(`${apiKey}:`).toString('base64')
        const url = `https://api.octopus.energy/v1/${path}${makeQueryString(parameters)}`
        const response = await fetch(url, {
            headers: { Authorization: `Basic ${auth}` }
        })
        return {
            status: response.status,
            json: await response.json()
        }
    }
}
