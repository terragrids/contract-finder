import { app } from './app.js'
import request from 'supertest'

const mockStdlib = {
    setProviderByName: jest.fn().mockImplementation(() => jest.fn()),
    getProvider: jest.fn().mockImplementation(() => jest.fn()),
    newAccountFromMnemonic: jest.fn().mockImplementation(() => jest.fn()),
    launchToken: jest.fn().mockImplementation(() => jest.fn())
}

jest.mock('./provider/reach-provider.js', () =>
    jest.fn().mockImplementation(() => ({
        getStdlib: jest.fn().mockImplementation(() => ({
            setProviderByName: mockStdlib.setProviderByName,
            getProvider: mockStdlib.getProvider,
            newAccountFromMnemonic: mockStdlib.newAccountFromMnemonic,
            launchToken: mockStdlib.launchToken
        })),
        getEnv: jest.fn().mockImplementation(() => 'TestNet')
    }))
)

describe('app', function () {
    const OLD_ENV = process.env

    beforeEach(() => {
        jest.clearAllMocks()
        process.env = { ...OLD_ENV } // make a copy
    })

    afterAll(() => {
        process.env = OLD_ENV // restore old env
    })

    describe('get root endpoint', function () {
        it('should return 200 when calling root endpoint', async () => {
            const response = await request(app.callback()).get('/')
            expect(response.status).toBe(200)
            expect(response.text).toBe('terragrids project contract api')
        })
    })

    describe('get health check endpoint', function () {
        it('should return 200 when calling hc endpoint and all is healthy', async () => {
            mockStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: { healthCheck: () => ({ do: async () => Promise.resolve({}) }) },
                    indexer: { makeHealthCheck: () => ({ do: async () => Promise.resolve({ version: '1.2.3' }) }) }
                })
            )

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({ networkAccount: {} }))

            const response = await request(app.callback()).get('/hc')
            expect(response.status).toBe(200)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                env: 'dev',
                region: 'local',
                reach: {
                    network: 'TestNet',
                    algoClient: 'ok',
                    algoIndexer: 'ok',
                    algoAccount: 'ok'
                }
            })
        })

        it('should return 200 when calling hc endpoint and algo client is faulty', async () => {
            mockStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: { healthCheck: () => ({ do: async () => Promise.resolve({ error: 'error' }) }) },
                    indexer: { makeHealthCheck: () => ({ do: async () => Promise.resolve({ version: '1.2.3' }) }) }
                })
            )

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({ networkAccount: {} }))

            const response = await request(app.callback()).get('/hc')
            expect(response.status).toBe(200)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                env: 'dev',
                region: 'local',
                reach: {
                    network: 'TestNet',
                    algoClient: 'error',
                    algoIndexer: 'ok',
                    algoAccount: 'ok'
                }
            })
        })

        it('should return 200 when calling hc endpoint and algo indexer is faulty', async () => {
            mockStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: { healthCheck: () => ({ do: async () => Promise.resolve({}) }) },
                    indexer: { makeHealthCheck: () => ({ do: async () => Promise.resolve({}) }) }
                })
            )

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({ networkAccount: {} }))

            const response = await request(app.callback()).get('/hc')
            expect(response.status).toBe(200)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                env: 'dev',
                region: 'local',
                reach: {
                    network: 'TestNet',
                    algoClient: 'ok',
                    algoIndexer: 'error',
                    algoAccount: 'ok'
                }
            })
        })

        it('should return 200 when calling hc endpoint and algo account is faulty', async () => {
            mockStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: { healthCheck: () => ({ do: async () => Promise.resolve({}) }) },
                    indexer: { makeHealthCheck: () => ({ do: async () => Promise.resolve({ version: '1.2.3' }) }) }
                })
            )

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({}))

            const response = await request(app.callback()).get('/hc')
            expect(response.status).toBe(200)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                env: 'dev',
                region: 'local',
                reach: {
                    network: 'TestNet',
                    algoClient: 'ok',
                    algoIndexer: 'ok',
                    algoAccount: 'error'
                }
            })
        })
    })

    describe('post project endpoint', function () {
        it('should return 201 when posting new project and all is fine', async () => {
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({ networkAccount: {} }))
            mockStdlib.launchToken.mockImplementation(() => ({ id: { toNumber: () => 1234 } }))

            const response = await request(app.callback()).post('/project').send({})
            expect(response.status).toBe(201)
            expect(response.body).toEqual({
                projectToken: 1234
            })
        })

        it('should return 500 when launching token fails', async () => {
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({ networkAccount: {} }))
            mockStdlib.launchToken.mockImplementation(() => {
                throw new Error()
            })

            const response = await request(app.callback()).post('/project').send({})
            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'LaunchTokenError',
                message: 'Unable to create project token'
            })
        })
    })
})
