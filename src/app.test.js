import { app } from './app.js'
import request from 'supertest'

const mockLoadStdlib = {
    setProviderByName: jest.fn().mockImplementation(() => jest.fn()),
    getProvider: jest.fn().mockImplementation(() => jest.fn())
}

jest.mock('@reach-sh/stdlib', () => ({
    ...jest.requireActual('@reach-sh/stdlib'),
    loadStdlib: jest.fn().mockImplementation(() => ({
        setProviderByName: mockLoadStdlib.setProviderByName,
        getProvider: mockLoadStdlib.getProvider
    }))
}))

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
        it('should return 200 when calling hc endpoint on TestNet and all is healthy', async () => {
            process.env.ENV = 'dev'

            mockLoadStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: { healthCheck: () => ({ do: async () => Promise.resolve({}) }) },
                    indexer: { makeHealthCheck: () => ({ do: async () => Promise.resolve({ version: '1.2.3' }) }) }
                })
            )

            const response = await request(app.callback()).get('/hc')
            expect(response.status).toBe(200)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                env: 'dev',
                region: 'local',
                reach: {
                    network: 'TestNet',
                    algoClient: 'ok',
                    algoIndexer: 'ok'
                }
            })
        })

        it('should return 200 when calling hc endpoint on MainNet and all is healthy', async () => {
            process.env.ENV = 'prod'

            mockLoadStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: { healthCheck: () => ({ do: async () => Promise.resolve({}) }) },
                    indexer: { makeHealthCheck: () => ({ do: async () => Promise.resolve({ version: '1.2.3' }) }) }
                })
            )

            const response = await request(app.callback()).get('/hc')
            expect(response.status).toBe(200)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                env: 'prod',
                region: 'local',
                reach: {
                    network: 'MainNet',
                    algoClient: 'ok',
                    algoIndexer: 'ok'
                }
            })
        })

        it('should return 200 when calling hc endpoint on TestNet and all algo client is faulty', async () => {
            process.env.ENV = 'dev'

            mockLoadStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: { healthCheck: () => ({ do: async () => Promise.resolve({ error: 'error' }) }) },
                    indexer: { makeHealthCheck: () => ({ do: async () => Promise.resolve({ version: '1.2.3' }) }) }
                })
            )

            const response = await request(app.callback()).get('/hc')
            expect(response.status).toBe(200)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                env: 'dev',
                region: 'local',
                reach: {
                    network: 'TestNet',
                    algoClient: 'error',
                    algoIndexer: 'ok'
                }
            })
        })

        it('should return 200 when calling hc endpoint on TestNet and all algo indexer is faulty', async () => {
            process.env.ENV = 'dev'

            mockLoadStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: { healthCheck: () => ({ do: async () => Promise.resolve({}) }) },
                    indexer: { makeHealthCheck: () => ({ do: async () => Promise.resolve({}) }) }
                })
            )

            const response = await request(app.callback()).get('/hc')
            expect(response.status).toBe(200)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                env: 'dev',
                region: 'local',
                reach: {
                    network: 'TestNet',
                    algoClient: 'ok',
                    algoIndexer: 'error'
                }
            })
        })
    })
})
