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

const callAPI = async (name, f, successMsg, failureMsg, expectToFail) => {
    console.log(`${name} is calling the API`)
    await timeout(10 * Math.random())
    let result
    try {
        result = await f()
        if (expectToFail) throw new Error('This API call is expected to fail')
        console.log(successMsg)
    } catch (e) {
        if (!expectToFail) console.log(e)
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

const logProjectAndAssert = async (accountName, view, expCreator, expToken, expBalance, expTokenBalance) => {
    const creator = stdlib.formatAddress((await view.creator())[1])
    const token = (await view.token())[1].toNumber()
    const balance = (await view.balance())[1].toNumber()
    const tokenBalance = (await view.tokenBalance())[1].toNumber()

    console.log(`${accountName} sees that project creator is ${creator}, expected ${expCreator}`)
    console.log(`${accountName} sees that project token is ${token}, expected ${expToken.id.toNumber()}`)
    console.log(`${accountName} sees that project balance is ${algo(balance)}, expected ${algo(expBalance)}`)
    console.log(`${accountName} sees that project token balance is ${tokenBalance}, expected ${expTokenBalance}`)

    assert.equal(creator, expCreator)
    assert.equal(token, expToken.id.toNumber())
    assert.equal(balance, expBalance)
    assert.equal(tokenBalance, expTokenBalance)
}

const connectAndStop = async (accountName, account, contract, accCreator, token, ready) => {
    return async () => {
        console.log(`${accountName} is attaching to the contract...`)
        const ctc = account.contract(backend, contract.getInfo())
        const api = ctc.a.Api
        const view = ctc.v.View
        const creator = stdlib.formatAddress(accCreator.getAddress())

        logBalances(accountName, account, token)

        await ready.wait()

        // Initial state

        await logProjectAndAssert(accountName, view, creator, token, 0, 1)

        logBalances(accountName, account, token)

        // Stop the contract

        console.log(`${accountName} is trying to stop the contract...`)

        await callAPI(accountName, () => api.stop(), `${accountName} managed to stop the contract`, `${accountName} failed to stop the contract`)

        logBalances(accountName, account, token)
    }
}

const connectDepositAndStop = async (accountName, account, contract, accCreator, token, ready) => {
    return async () => {
        console.log(`${accountName} is attaching to the contract...`)
        const ctc = account.contract(backend, contract.getInfo())
        const api = ctc.a.Api
        const view = ctc.v.View
        const creator = stdlib.formatAddress(accCreator.getAddress())

        logBalances(accountName, account, token)

        await ready.wait()

        // Initial state

        await logProjectAndAssert(accountName, view, creator, token, 0, 1)
        await logBalances(accountName, account, token)

        // Deposit

        await callAPI(accountName, () => api.deposit(stdlib.parseCurrency(20)), `${accountName} managed to deposit ALGO`, `${accountName} failed to deposit ALGO`)

        await logProjectAndAssert(accountName, view, creator, token, stdlib.parseCurrency(20), 1)
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

const connectDepositPayAndStop = async (accountName, account, contract, accCreator, token, ready) => {
    return async () => {
        console.log(`${accountName} is attaching to the contract...`)
        const ctc = account.contract(backend, contract.getInfo())
        const api = ctc.a.Api
        const view = ctc.v.View
        const creator = stdlib.formatAddress(accCreator.getAddress())

        logBalances(accountName, account, token)

        await ready.wait()

        // Initial state

        await logProjectAndAssert(accountName, view, creator, token, 0, 1)
        await logBalances(accountName, account, token)

        // Deposit

        await callAPI(accountName, () => api.deposit(stdlib.parseCurrency(20)), `${accountName} managed to deposit ALGO`, `${accountName} failed to deposit ALGO`)

        await logProjectAndAssert(accountName, view, creator, token, stdlib.parseCurrency(20), 1)
        await logBalances(accountName, account, token)
        assert(algo(await stdlib.balanceOf(account)) < 80)

        // Try to pay balance to creator but fail because the token has not been paid yet

        await callAPI(accountName, () => api.payBalance(), `${accountName} managed to pay balance`, `${accountName} failed to pay balance`, true)

        await logProjectAndAssert(accountName, view, creator, token, stdlib.parseCurrency(20), 1)
        await logBalances('Creator', accCreator, token)
        assert.equal(algo(await stdlib.balanceOf(accCreator)), 100)

        // Pay token to creator

        await accCreator.tokenAccept(token.id)

        await callAPI(accountName, () => api.payToken(), `${accountName} managed to pay token`, `${accountName} failed to pay token`)

        await logProjectAndAssert(accountName, view, creator, token, stdlib.parseCurrency(20), 0)
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) > 99)
        assert.equal((await stdlib.balanceOf(accCreator, token.id)).toNumber(), 1)
        assert.equal((await stdlib.balanceOf(account, token.id)).toNumber(), 0)

        // Pay balance to creator

        await callAPI(accountName, () => api.payBalance(), `${accountName} managed to pay balance`, `${accountName} failed to pay balance`)

        await logProjectAndAssert(accountName, view, creator, token, 0, 0)
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) > 119)

        // Stop the contract

        console.log(`${accountName} is trying to stop the contract...`)

        await callAPI(accountName, () => api.stop(), `${accountName} managed to stop the contract`, `${accountName} failed to stop the contract`)

        const [algoBal, tokenBal] = await logBalances(accountName, account, token)
        assert.equal(tokenBal, 0)
        assert.ok(algo(algoBal) < 80)
    }
}

const connectDepositWithdrawPayAndStop = async (accountName, account, contract, accCreator, token, ready) => {
    return async () => {
        console.log(`${accountName} is attaching to the contract...`)
        const ctc = account.contract(backend, contract.getInfo())
        const api = ctc.a.Api
        const view = ctc.v.View
        const creator = stdlib.formatAddress(accCreator.getAddress())

        logBalances(accountName, account, token)

        await ready.wait()

        // Initial state

        await logProjectAndAssert(accountName, view, creator, token, 0, 1)
        await logBalances(accountName, account, token)

        // Deposit

        await callAPI(accountName, () => api.deposit(stdlib.parseCurrency(20)), `${accountName} managed to deposit ALGO`, `${accountName} failed to deposit ALGO`)

        await logProjectAndAssert(accountName, view, creator, token, stdlib.parseCurrency(20), 1)
        await logBalances(accountName, account, token)
        assert(algo(await stdlib.balanceOf(account)) < 80)

        // Withdraw balance and token into admin's account

        await callAPI(accountName, () => api.withdraw(), `${accountName} managed to withdraw`, `${accountName} failed to withdraw`)

        await logProjectAndAssert(accountName, view, creator, token, 0, 0)
        await logBalances(accountName, account, token)
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) >= 100)
        assert.ok(algo(await stdlib.balanceOf(account)) > 99)
        assert.equal((await stdlib.balanceOf(accCreator, token.id)).toNumber(), 0)
        assert.equal((await stdlib.balanceOf(account, token.id)).toNumber(), 1)

        // Pay no balance to creator

        await callAPI(accountName, () => api.payBalance(), `${accountName} managed to pay balance`, `${accountName} failed to pay balance`)

        await logProjectAndAssert(accountName, view, creator, token, 0, 0)
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) >= 100)

        // Pay no token to creator

        await accCreator.tokenAccept(token.id)

        await callAPI(accountName, () => api.payToken(), `${accountName} managed to pay token`, `${accountName} failed to pay token`)

        await logProjectAndAssert(accountName, view, creator, token, 0, 0)
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) > 99)
        assert.equal((await stdlib.balanceOf(accCreator, token.id)).toNumber(), 0)
        assert.equal((await stdlib.balanceOf(account, token.id)).toNumber(), 1)

        // Stop the contract

        console.log(`${accountName} is trying to stop the contract...`)

        await callAPI(accountName, () => api.stop(), `${accountName} managed to stop the contract`, `${accountName} failed to stop the contract`)

        const [algoBal, tokenBal] = await logBalances(accountName, account, token)
        assert.equal(tokenBal, 1)
        assert.ok(algo(algoBal) > 99)
    }
}

const connectDepositWithdrawPayAndStopWithCreatorAccount = async (accountName, account, contract, accCreator, token, ready) => {
    return async () => {
        console.log('Creator is attaching to the contract...')
        const ctc = accCreator.contract(backend, contract.getInfo())
        const api = ctc.a.Api
        const view = ctc.v.View
        const creator = stdlib.formatAddress(accCreator.getAddress())

        logBalances(accountName, account, token)

        await ready.wait()

        // Initial state

        await logProjectAndAssert(accountName, view, creator, token, 0, 1)
        await logBalances(accountName, account, token)

        // Deposit

        await callAPI('Creator', () => api.deposit(stdlib.parseCurrency(20)), 'Creator managed to deposit ALGO', 'Creator failed to deposit ALGO')

        await logProjectAndAssert(accountName, view, creator, token, stdlib.parseCurrency(20), 1)
        await logBalances(accountName, account, token)
        assert(algo(await stdlib.balanceOf(account)) > 99)
        assert(algo(await stdlib.balanceOf(accCreator)) < 80)

        // Withdraw balance and token into admin's account

        await callAPI('Creator', () => api.withdraw(), 'Creator managed to withdraw', 'Creator failed to withdraw', true)

        await logProjectAndAssert(accountName, view, creator, token, stdlib.parseCurrency(20), 1)
        await logBalances(accountName, account, token)
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) < 100)
        assert.ok(algo(await stdlib.balanceOf(account)) > 99)
        assert.equal((await stdlib.balanceOf(accCreator, token.id)).toNumber(), 0)
        assert.equal((await stdlib.balanceOf(account, token.id)).toNumber(), 0)

        // Try to pay balance to creator but fail because the token has not been paid yet

        await callAPI('Creator', () => api.payBalance(), 'Creator managed to pay balance', 'Creator failed to pay balance', true)

        await logProjectAndAssert(accountName, view, creator, token, stdlib.parseCurrency(20), 1)
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) < 80)

        // Try to pay token to creator but fail because only admin can pay token

        await accCreator.tokenAccept(token.id)

        await callAPI('Creator', () => api.payToken(), 'Creator managed to pay token', 'Creator failed to pay token', true)

        await logProjectAndAssert(accountName, view, creator, token, stdlib.parseCurrency(20), 1)
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) < 80)
        assert.equal((await stdlib.balanceOf(accCreator, token.id)).toNumber(), 0)
        assert.equal((await stdlib.balanceOf(account, token.id)).toNumber(), 0)

        const adminCtc = account.contract(backend, contract.getInfo())
        const adminApi = adminCtc.a.Api

        // Pay token to creator with admin's account

        await callAPI(accountName, () => adminApi.payToken(), 'Admin managed to pay token', 'Admin failed to pay token')

        await logProjectAndAssert(accountName, view, creator, token, stdlib.parseCurrency(20), 0)
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) < 80)
        assert.equal((await stdlib.balanceOf(accCreator, token.id)).toNumber(), 1)
        assert.equal((await stdlib.balanceOf(account, token.id)).toNumber(), 0)

        // Pay balance to creator with creator's account

        await callAPI('Creator', () => api.payBalance(), 'Creator managed to pay balance', 'Creator failed to pay balance')

        await logProjectAndAssert(accountName, view, creator, token, 0, 0)
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) > 99)

        // Stop the contract

        console.log('Creator is trying to stop the contract...')

        await callAPI('Creator', () => api.stop(), 'Creator managed to stop the contract', 'Creator failed to stop the contract', true)

        console.log(`${accountName} is trying to stop the contract...`)

        await callAPI(accountName, () => adminApi.stop(), `${accountName} managed to stop the contract`, `${accountName} failed to stop the contract`)

        const [algoBal, tokenBal] = await logBalances(accountName, account, token)
        assert.equal(tokenBal, 0)
        assert.ok(algo(algoBal) < 100)
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
        case 'CONNECT_DEPOSIT_PAY_STOP':
            testRun = connectDepositPayAndStop
            break
        case 'CONNECT_DEPOSIT_WITHDRAW_PAY_STOP':
            testRun = connectDepositWithdrawPayAndStop
            break
        case 'CONNECT_DEPOSIT_WITHDRAW_PAY_STOP_CREATOR':
            testRun = connectDepositWithdrawPayAndStopWithCreatorAccount
            break
    }

    await Promise.all([
        thread(await testRun('Admin', accAdmin, ctcAdmin, accCreator, gil, ready)),
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
    await getAndLogBalance(accAdmin, 'Admin')
}

await runTestCase('CONNECT_STOP')
await runTestCase('CONNECT_DEPOSIT_STOP')
await runTestCase('CONNECT_DEPOSIT_PAY_STOP')
await runTestCase('CONNECT_DEPOSIT_WITHDRAW_PAY_STOP')
await runTestCase('CONNECT_DEPOSIT_WITHDRAW_PAY_STOP_CREATOR')
