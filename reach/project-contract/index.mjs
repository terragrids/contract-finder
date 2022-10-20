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

const createTestAccount = async () => {
    const startingBalance = stdlib.parseCurrency(100)
    return await stdlib.newTestAccount(startingBalance)
}

const getAndLogBalance = async (account, name) => {
    const balance = await stdlib.balanceOf(account)
    console.log(`${name} has ${fmt(balance)}`)
    return algo(balance)
}

const logProjectAndAssert = async (accountName, view, expName, expUrl, expHash, expCreator) => {
    // eslint-disable-next-line no-control-regex
    const removePadding = s => s.replace(/\x00/g, '')

    const name = removePadding((await view.name())[1])
    const url = removePadding((await view.url())[1])
    const hash = removePadding((await view.hash())[1])
    const creator = stdlib.formatAddress((await view.creator())[1])
    console.log(`${accountName} sees that project contract has name ${name}, expected ${expName}`)
    console.log(`${accountName} sees that project contract has url ${url}, expected ${expUrl}`)
    console.log(`${accountName} sees that project contract has hash ${hash}, expected ${expHash}`)
    console.log(`${accountName} sees that project creator is ${creator}, expected ${expCreator}`)
    assert.equal(name, expName)
    assert.equal(url, expUrl)
    assert.equal(hash, expHash)
    assert.equal(creator, expCreator)
}

const userConnectAndStop = async (accountName, account, contract, prjName, prjUrl, prjHash, prjCreator, ready) => {
    return async () => {
        console.log(`${accountName} is attaching to the contract...`)
        const ctc = account.contract(backend, contract.getInfo())
        const api = ctc.a.Api
        const view = ctc.v.View

        console.log(`${accountName} has ${fmt(await stdlib.balanceOf(account))}`)

        await ready.wait()

        // Initial state

        await logProjectAndalgoAccountAssert(accountName, view, prjName, prjUrl, prjHash, prjCreator)

        console.log(`${accountName} has ${fmt(await stdlib.balanceOf(account))}`)

        // Stop the contract

        console.log(`${accountName} is trying to stop the contract...`)

        await callAPI(accountName, () => api.stop(), `${accountName} managed to stop the contract`, `${accountName} failed to stop the contract`)

        console.log(`${accountName} has ${fmt(await stdlib.balanceOf(account))}`)
    }
}

const userConnectUpdateAndStop = async (accountName, account, contract, prjName, prjUrl, prjHash, prjCreator, ready) => {
    return async () => {
        console.log(`${accountName} is attaching to the contract...`)
        const ctc = account.contract(backend, contract.getInfo())
        const api = ctc.a.Api
        const view = ctc.v.View

        console.log(`${accountName} has ${fmt(await stdlib.balanceOf(account))}`)

        await ready.wait()

        // Initial state

        await logProjectAndAssert(accountName, view, prjName, prjUrl, prjHash, prjCreator)

        console.log(`${accountName} has ${fmt(await stdlib.balanceOf(account))}`)

        // Update project name

        await callAPI(accountName, () => api.updateName('project 2'), `${accountName} managed to update the project name`, `${accountName} failed to update the project name`)

        await logProjectAndAssert(accountName, view, 'project 2', prjUrl, prjHash, prjCreator)

        // Update project metadata

        await callAPI(
            accountName,
            () => api.updateMetadata('https://terragrids.org/project2', 'project_2_hash'),
            `${accountName} managed to update the project metadata`,
            `${accountName} failed to update the project metadata`
        )

        await logProjectAndAssert(accountName, view, 'project 2', 'https://terragrids.org/project2', 'project_2_hash', prjCreator)

        // Stop the contract

        console.log(`${accountName} is trying to stop the contract...`)

        await callAPI(accountName, () => api.stop(), `${accountName} managed to stop the contract`, `${accountName} failed to stop the contract`)

        console.log(`${accountName} has ${fmt(await stdlib.balanceOf(account))}`)
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
    const name = 'project 1'
    const url = 'https://terragrids.org/project1'
    const hash = 'project_1_hash'
    const creator = stdlib.formatAddress(accCreator.getAddress())
    console.log(`Creator address ${creator}`)

    // Deploy the dapp
    const ctcAdmin = accAdmin.contract(backend)

    let testRun
    switch (testCase) {
        default:
        case 'CONNECT_STOP':
            testRun = userConnectAndStop
            break
        case 'CONNECT_UPDATE_STOP':
            testRun = userConnectUpdateAndStop
            break
    }

    await Promise.all([
        thread(await testRun('Admin', accAdmin, ctcAdmin, name, url, hash, creator, ready)),
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
            name,
            url,
            hash,
            creator
        })
    ])

    console.log('Contract stopped.')
    const adminAlgo = await getAndLogBalance(accAdmin, 'Admin')
    assert(parseFloat(adminAlgo) < 100)
}

await runTestCase('CONNECT_STOP')
await runTestCase('CONNECT_UPDATE_STOP')
