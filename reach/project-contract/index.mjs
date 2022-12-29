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

const logProjectAndAssert = async (
    accountName,
    view,
    expected = {
        creator: '',
        token: { id: { toNumber: () => {} } },
        balance: 0,
        tokenBalance: 0,
        approved: false
    }
) => {
    const creator = stdlib.formatAddress((await view.creator())[1])
    const token = (await view.token())[1].toNumber()
    const balance = (await view.balance())[1].toNumber()
    const tokenBalance = (await view.tokenBalance())[1].toNumber()
    const approved = (await view.approved())[1]

    console.log(`${accountName} sees that project creator is ${creator}, expected ${expected.creator}`)
    console.log(`${accountName} sees that project token is ${token}, expected ${expected.token.id.toNumber()}`)
    console.log(`${accountName} sees that project balance is ${algo(balance)}, expected ${algo(expected.balance)}`)
    console.log(`${accountName} sees that project token balance is ${tokenBalance}, expected ${expected.tokenBalance}`)
    console.log(`${accountName} sees that project approval state is ${approved}, expected ${expected.approved}`)

    assert.equal(creator, expected.creator)
    assert.equal(token, expected.token.id.toNumber())
    assert.equal(balance, expected.balance)
    assert.equal(tokenBalance, expected.tokenBalance)
    assert.equal(approved, expected.approved)
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
        await logProjectAndAssert(accountName, view, { creator, token, balance: 0, tokenBalance: 1, approved: false })

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

        await logProjectAndAssert(accountName, view, { creator, token, balance: 0, tokenBalance: 1, approved: false })
        await logBalances(accountName, account, token)

        // Deposit

        await callAPI(accountName, () => api.deposit(stdlib.parseCurrency(20)), `${accountName} managed to deposit ALGO`, `${accountName} failed to deposit ALGO`)

        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 1, approved: false })
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

const connectDepositApprovePayAndStop = async (accountName, account, contract, accCreator, token, ready) => {
    return async () => {
        console.log(`${accountName} is attaching to the contract...`)
        const ctc = account.contract(backend, contract.getInfo())
        const api = ctc.a.Api
        const view = ctc.v.View
        const creator = stdlib.formatAddress(accCreator.getAddress())

        logBalances(accountName, account, token)

        await ready.wait()

        // Initial state

        await logProjectAndAssert(accountName, view, { creator, token, balance: 0, tokenBalance: 1, approved: false })
        await logBalances(accountName, account, token)

        // Deposit

        await callAPI(accountName, () => api.deposit(stdlib.parseCurrency(20)), `${accountName} managed to deposit ALGO`, `${accountName} failed to deposit ALGO`)

        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 1, approved: false })
        await logBalances(accountName, account, token)
        assert(algo(await stdlib.balanceOf(account)) < 80)

        // Try to pay balance to creator but fail because the project has not been approved yet

        await callAPI(accountName, () => api.payBalance(), `${accountName} managed to pay balance`, `${accountName} failed to pay balance`, true)

        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 1, approved: false })
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) >= 100)

        // Pay token to creator

        await accCreator.tokenAccept(token.id)

        await callAPI(accountName, () => api.payToken(), `${accountName} managed to pay token`, `${accountName} failed to pay token`)

        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 0, approved: true })
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) > 99)
        assert.equal((await stdlib.balanceOf(accCreator, token.id)).toNumber(), 1)
        assert.equal((await stdlib.balanceOf(account, token.id)).toNumber(), 0)

        // Pay balance to creator

        await callAPI(accountName, () => api.payBalance(), `${accountName} managed to pay balance`, `${accountName} failed to pay balance`)

        await logProjectAndAssert(accountName, view, { creator, token, balance: 0, tokenBalance: 0, approved: true })
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) > 119)

        // Remove approval

        await callAPI(accountName, () => api.setApprovalState(false), `${accountName} managed to remove approval`, `${accountName} failed to remove approval`)

        await logProjectAndAssert(accountName, view, { creator, token, balance: 0, tokenBalance: 0, approved: false })
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) > 119)

        // Deposit

        await callAPI(accountName, () => api.deposit(stdlib.parseCurrency(20)), `${accountName} managed to deposit ALGO`, `${accountName} failed to deposit ALGO`)
        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 0, approved: false })

        // Try to pay balance to creator but fail because the project is not approved anymore

        await callAPI(accountName, () => api.payBalance(), `${accountName} managed to pay balance`, `${accountName} failed to pay balance`, true)

        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 0, approved: false })
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) > 119)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) < 121)

        // Approve

        await callAPI(accountName, () => api.setApprovalState(true), `${accountName} managed to approve`, `${accountName} failed to approve`)
        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 0, approved: true })

        // Pay balance to creator

        await callAPI(accountName, () => api.payBalance(), `${accountName} managed to pay balance`, `${accountName} failed to pay balance`)

        await logProjectAndAssert(accountName, view, { creator, token, balance: 0, tokenBalance: 0, approved: true })
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) > 139)

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

        await logProjectAndAssert(accountName, view, { creator, token, balance: 0, tokenBalance: 1, approved: false })
        await logBalances(accountName, account, token)

        // Deposit

        await callAPI(accountName, () => api.deposit(stdlib.parseCurrency(20)), `${accountName} managed to deposit ALGO`, `${accountName} failed to deposit ALGO`)

        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 1, approved: false })
        await logBalances(accountName, account, token)
        assert(algo(await stdlib.balanceOf(account)) < 80)

        // Withdraw balance and token into admin's account

        await callAPI(accountName, () => api.withdraw(), `${accountName} managed to withdraw`, `${accountName} failed to withdraw`)

        await logProjectAndAssert(accountName, view, { creator, token, balance: 0, tokenBalance: 0, approved: false })
        await logBalances(accountName, account, token)
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) >= 100)
        assert.ok(algo(await stdlib.balanceOf(account)) > 99)
        assert.equal((await stdlib.balanceOf(accCreator, token.id)).toNumber(), 0)
        assert.equal((await stdlib.balanceOf(account, token.id)).toNumber(), 1)

        // Fail to pay balance to creator because the project is not approved

        await callAPI(accountName, () => api.payBalance(), `${accountName} managed to pay balance`, `${accountName} failed to pay balance`, true)

        await logProjectAndAssert(accountName, view, { creator, token, balance: 0, tokenBalance: 0, approved: false })
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) >= 100)

        // Pay no token to creator and approve the project

        await accCreator.tokenAccept(token.id)

        await callAPI(accountName, () => api.payToken(), `${accountName} managed to pay token`, `${accountName} failed to pay token`)

        await logProjectAndAssert(accountName, view, { creator, token, balance: 0, tokenBalance: 0, approved: true })
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

        await logProjectAndAssert(accountName, view, { creator, token, balance: 0, tokenBalance: 1, approved: false })
        await logBalances(accountName, account, token)

        // Deposit

        await callAPI('Creator', () => api.deposit(stdlib.parseCurrency(20)), 'Creator managed to deposit ALGO', 'Creator failed to deposit ALGO')

        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 1, approved: false })
        await logBalances(accountName, account, token)
        assert(algo(await stdlib.balanceOf(account)) > 99)
        assert(algo(await stdlib.balanceOf(accCreator)) < 80)

        // Fail to withdraw balance and token into admin's account

        await callAPI('Creator', () => api.withdraw(), 'Creator managed to withdraw', 'Creator failed to withdraw', true)

        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 1, approved: false })
        await logBalances(accountName, account, token)
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) < 100)
        assert.ok(algo(await stdlib.balanceOf(account)) > 99)
        assert.equal((await stdlib.balanceOf(accCreator, token.id)).toNumber(), 0)
        assert.equal((await stdlib.balanceOf(account, token.id)).toNumber(), 0)

        // Try to pay balance to creator but fail because the token has not been paid yet

        await callAPI('Creator', () => api.payBalance(), 'Creator managed to pay balance', 'Creator failed to pay balance', true)

        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 1, approved: false })
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) < 80)

        // Try to pay token to creator but fail because only admin can pay token

        await accCreator.tokenAccept(token.id)

        await callAPI('Creator', () => api.payToken(), 'Creator managed to pay token', 'Creator failed to pay token', true)

        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 1, approved: false })
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) < 80)
        assert.equal((await stdlib.balanceOf(accCreator, token.id)).toNumber(), 0)
        assert.equal((await stdlib.balanceOf(account, token.id)).toNumber(), 0)

        // Try to approve project with creator's account but fail because only admin can approve

        await callAPI('Creator', () => api.setApprovalState(true), 'Creator managed to approve', 'Creator failed to approve', true)
        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 1, approved: false })

        const adminCtc = account.contract(backend, contract.getInfo())
        const adminApi = adminCtc.a.Api

        // Pay token to creator with admin's account

        await callAPI(accountName, () => adminApi.payToken(), 'Admin managed to pay token', 'Admin failed to pay token')

        await logProjectAndAssert(accountName, view, { creator, token, balance: stdlib.parseCurrency(20), tokenBalance: 0, approved: true })
        await logBalances('Creator', accCreator, token)
        assert.ok(algo(await stdlib.balanceOf(accCreator)) < 80)
        assert.equal((await stdlib.balanceOf(accCreator, token.id)).toNumber(), 1)
        assert.equal((await stdlib.balanceOf(account, token.id)).toNumber(), 0)

        // Pay balance to creator with creator's account

        await callAPI('Creator', () => api.payBalance(), 'Creator managed to pay balance', 'Creator failed to pay balance')

        await logProjectAndAssert(accountName, view, { creator, token, balance: 0, tokenBalance: 0, approved: true })
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
        case 'CONNECT_DEPOSIT_APPROVE_PAY_STOP':
            testRun = connectDepositApprovePayAndStop
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
await runTestCase('CONNECT_DEPOSIT_APPROVE_PAY_STOP')
await runTestCase('CONNECT_DEPOSIT_WITHDRAW_PAY_STOP')
await runTestCase('CONNECT_DEPOSIT_WITHDRAW_PAY_STOP_CREATOR')
