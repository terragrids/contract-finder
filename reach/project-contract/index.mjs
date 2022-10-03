/* eslint-disable no-console */
import { loadStdlib } from '@reach-sh/stdlib'
import assert from 'assert'
import * as backend from './build/index.main.mjs'

// Load Reach stdlib
const stdlib = loadStdlib()
if (stdlib.connector !== 'ALGO') {
    throw Error('stdlib.connector must be ALGO')
}

// Define utility functions
export class Signal {
    constructor() {
        const me = this
        this.p = new Promise(resolve => {
            me.r = resolve
        })
    }
    wait() {
        return this.p
    }
    notify() {
        this.r(true)
    }
}

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms))
const thread = async f => await f()

const algo = x => stdlib.formatCurrency(x, 4)
const fmt = x => `${algo(x)} ALGO`

const callAPI = async (name, f, successMsg, failureMsg) => {
    console.log(`${name} is calling the API`)
    await timeout(10 * Math.random())
    let result
    try {
        result = await f()
        console.log(successMsg)
    } catch (e) {
        console.log(e)
        console.log(failureMsg)
    }
    return result
}

const setup = async () => {
    const startingBalance = stdlib.parseCurrency(100)

    // Create test accounts
    const accAdmin = await stdlib.newTestAccount(startingBalance)

    return accAdmin
}

const getAndLogBalance = async (account, name) => {
    const balance = await stdlib.balanceOf(account)
    console.log(`${name} has ${fmt(balance)}`)
    return algo(balance)
}

const logProjectTokenAndAssert = async (name, view, expTokenId) => {
    const projectTokenId = (await view.projectToken())[1].toNumber()
    console.log(`${name} sees that project contract has token id ${projectTokenId}, expected ${expTokenId}`)
    assert(projectTokenId === expTokenId)
}

const userConnectAndStop = async (name, account, contract, startToken, ready) => {
    return async () => {
        console.log(`${name} is attaching to the contract...`)
        const ctc = account.contract(backend, contract.getInfo())
        const api = ctc.a.Api
        const view = ctc.v.View

        console.log(`${name} has ${fmt(await stdlib.balanceOf(account))}`)

        await ready.wait()

        // Initial state

        await logProjectTokenAndAssert(name, view, startToken.id.toNumber())

        console.log(`${name} has ${fmt(await stdlib.balanceOf(account))}`)

        // Stop the contract

        console.log(`${name} is trying to stop the contract...`)

        await callAPI(name, () => api.stop(), `${name} managed to stop the contract`, `${name} failed to stop the contract`)

        console.log(`${name} has ${fmt(await stdlib.balanceOf(account))}`)
    }
}

const userConnectUpdateAndStop = async (name, account, contract, startToken, ready) => {
    return async () => {
        console.log(`${name} is attaching to the contract...`)
        const ctc = account.contract(backend, contract.getInfo())
        const api = ctc.a.Api
        const view = ctc.v.View

        console.log(`${name} has ${fmt(await stdlib.balanceOf(account))}`)

        await ready.wait()

        // Initial state

        await logProjectTokenAndAssert(name, view, startToken.id.toNumber())

        console.log(`${name} has ${fmt(await stdlib.balanceOf(account))}`)

        // Update token
        const gol = await stdlib.launchToken(account, 'gold', 'GOL', { supply: 1, decimals: 0 })

        await callAPI(name, () => api.update(gol.id), `${name} managed to update the project token`, `${name} failed to update the project token`)

        await logProjectTokenAndAssert(name, view, gol.id.toNumber())

        // Stop the contract

        console.log(`${name} is trying to stop the contract...`)

        await callAPI(name, () => api.stop(), `${name} managed to stop the contract`, `${name} failed to stop the contract`)

        console.log(`${name} has ${fmt(await stdlib.balanceOf(account))}`)
    }
}

const deployAndStop = async () => {
    console.log('>> Deploy and stop')
    const accAdmin = await setup()
    const ready = new Signal()

    await getAndLogBalance(accAdmin, 'Admin')

    console.log('Deploying the contract...')

    // Launch token
    const gil = await stdlib.launchToken(accAdmin, 'gil', 'GIL', { supply: 1, decimals: 0 })

    // Deploy the dapp
    const ctcAdmin = accAdmin.contract(backend)

    await Promise.all([
        thread(await userConnectAndStop('Admin', accAdmin, ctcAdmin, gil, ready)),
        backend.Admin(ctcAdmin, {
            log: (...args) => {
                console.log(...args)
                ready.notify()
            },
            onReady: async contract => {
                console.log(`Contract deployed ${JSON.stringify(contract)}`)
                const adminAlgo = await stdlib.balanceOf(accAdmin)
                console.log(`Admin has ${fmt(adminAlgo)}`)
            },
            projectToken: gil.id
        })
    ])

    console.log('Contract stopped.')
    const adminAlgo = await getAndLogBalance(accAdmin, 'Admin')
    assert(parseFloat(adminAlgo) < 100)
}

const deployUpdateAndStop = async () => {
    console.log('>> Deploy, update project token and stop')
    const accAdmin = await setup()
    const ready = new Signal()

    await getAndLogBalance(accAdmin, 'Admin')

    console.log('Deploying the contract...')

    // Launch token
    const gil = await stdlib.launchToken(accAdmin, 'gil', 'GIL', { supply: 1, decimals: 0 })

    // Deploy the dapp
    const ctcAdmin = accAdmin.contract(backend)

    await Promise.all([
        thread(await userConnectUpdateAndStop('Admin', accAdmin, ctcAdmin, gil, ready)),
        backend.Admin(ctcAdmin, {
            log: (...args) => {
                console.log(...args)
                ready.notify()
            },
            onReady: async contract => {
                console.log(`Contract deployed ${JSON.stringify(contract)}`)
                const adminAlgo = await stdlib.balanceOf(accAdmin)
                console.log(`Admin has ${fmt(adminAlgo)}`)
            },
            projectToken: gil.id
        })
    ])

    console.log('Contract stopped.')
    const adminAlgo = await getAndLogBalance(accAdmin, 'Admin')
    assert(parseFloat(adminAlgo) < 100)
}

await deployAndStop()
await deployUpdateAndStop()
