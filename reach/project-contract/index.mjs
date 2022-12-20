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
const fmtToken = (x, token) => `${x} ${token.sym}`

const getBalances = async (who, token) => {
    return await stdlib.balancesOf(who, [null, token.id])
}

const logBalances = async (accountName, account, token) => {
    const [algoBal, tokenBal] = await getBalances(account, token)
    console.log(`${accountName} has ${fmt(algoBal)} and ${fmtToken(tokenBal, token)}`)
    return [algoBal, tokenBal]
}

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

const createTestAccount = async () => {
    const startingBalance = stdlib.parseCurrency(100)
    return await stdlib.newTestAccount(startingBalance)
}

const getAndLogBalance = async (account, name) => {
    const balance = await stdlib.balanceOf(account)
    console.log(`${name} has ${fmt(balance)}`)
    return algo(balance)
}

const logProjectAndAssert = async (accountName, view, expCreator, expToken, expBalance) => {
    const creator = stdlib.formatAddress((await view.creator())[1])
    const token = (await view.token())[1].toNumber()
    const balance = (await view.balance())[1].toNumber()

    console.log(`${accountName} sees that project creator is ${creator}, expected ${expCreator}`)
    console.log(`${accountName} sees that project token is ${token}, expected ${expToken.id.toNumber()}`)
    console.log(`${accountName} sees that project balance is ${algo(balance)}, expected ${algo(expBalance)}`)
    assert.equal(creator, expCreator)
    assert.equal(token, expToken.id.toNumber())
    assert.equal(balance, expBalance)
}

const connectAndStop = async (accountName, account, contract, creator, token, ready) => {
    return async () => {
        console.log(`${accountName} is attaching to the contract...`)
        const ctc = account.contract(backend, contract.getInfo())
        const api = ctc.a.Api
        const view = ctc.v.View

        logBalances(accountName, account, token)

        await ready.wait()

        // Initial state

        await logProjectAndAssert(accountName, view, creator, token, 0)

        logBalances(accountName, account, token)

        // Stop the contract

        console.log(`${accountName} is trying to stop the contract...`)

        await callAPI(accountName, () => api.stop(), `${accountName} managed to stop the contract`, `${accountName} failed to stop the contract`)

        logBalances(accountName, account, token)
    }
}

const connectDepositAndStop = async (accountName, account, contract, creator, token, ready) => {
    return async () => {
        console.log(`${accountName} is attaching to the contract...`)
        const ctc = account.contract(backend, contract.getInfo())
        const api = ctc.a.Api
        const view = ctc.v.View

        logBalances(accountName, account, token)

        await ready.wait()

        // Initial state

        await logProjectAndAssert(accountName, view, creator, token, 0)
        await logBalances(accountName, account, token)

        // Deposit

        await callAPI(accountName, () => api.deposit(stdlib.parseCurrency(20)), `${accountName} managed to deposit ALGO`, `${accountName} failed to deposit ALGO`)

        await logProjectAndAssert(accountName, view, creator, token, stdlib.parseCurrency(20))
        await logBalances(accountName, account, token)
        assert(algo(await stdlib.balanceOf(account)) < 80)

        // Stop the contract

        console.log(`${accountName} is trying to stop the contract...`)

        await callAPI(accountName, () => api.stop(), `${accountName} managed to stop the contract`, `${accountName} failed to stop the contract`)

        const [algoBal, tokenBal] = await logBalances(accountName, account, token)
        assert.equal(tokenBal, 1)
        assert.ok(algo(algoBal) > 99)
    }
}

const runTestCase = async testCase => {
    console.log(`>> Test case: ${testCase}`)
    const accAdmin = await createTestAccount()
    const accCreator = await createTestAccount()
    const ready = new Signal()

    await getAndLogBalance(accAdmin, 'Admin')

    console.log('Deploying the contract...')

    // Define initial project data
    const gil = await stdlib.launchToken(accAdmin, 'gil', 'GIL', { supply: 1, decimals: 0 })
    const creator = stdlib.formatAddress(accCreator.getAddress())
    console.log(`Creator address ${creator}`)

    // Deploy the dapp
    const ctcAdmin = accAdmin.contract(backend)

    let testRun
    switch (testCase) {
        default:
        case 'CONNECT_STOP':
            testRun = connectAndStop
            break
        case 'CONNECT_DEPOSIT_STOP':
            testRun = connectDepositAndStop
            break
    }

    await Promise.all([
        thread(await testRun('Admin', accAdmin, ctcAdmin, creator, gil, ready)),
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
            token: gil.id,
            creator
        })
    ])

    console.log('Contract stopped.')
    const adminAlgo = await getAndLogBalance(accAdmin, 'Admin')
    assert(parseFloat(adminAlgo) < 100)
}

await runTestCase('CONNECT_STOP')
await runTestCase('CONNECT_DEPOSIT_STOP')
