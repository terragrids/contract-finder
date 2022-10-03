import { loadStdlib } from '@reach-sh/stdlib'

export default class ReachProvider {
    stdlib
    env

    constructor() {
        this.stdlib = loadStdlib({
            ...process.env,
            REACH_CONNECTOR_MODE: 'ALGO'
        })

        this.env = process.env.ENV === 'prod' ? 'MainNet' : 'TestNet'

        this.stdlib.setProviderByName(this.env)
    }

    getStdlib = () => this.stdlib
    getEnv = () => this.env
}
