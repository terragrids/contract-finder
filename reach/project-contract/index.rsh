'reach 0.1'
'use strict'

/**
 * The Project Contract owns a project NFT which represents a Terragrids Creator's project.
 * Creators can update their project details by replacing the current NFT with a new one
 * using the API exposed by this smart contract.
 */

export const main = Reach.App(() => {
    const A = Participant('Admin', {
        ...hasConsoleLogger,
        onReady: Fun(true, Null),
        name: Bytes(32),
        url: Bytes(96),
        metadata: Bytes(32)
    })

    const ProjectView = View('ProjectView', {
        project: Token
    })

    const Api = API('Api', {
        stop: Fun([], Bool)
    })

    init()

    A.only(() => {
        const [name, url, metadata] = declassify([interact.name, interact.url, interact.metadata])
    })
    A.publish(name, url, metadata)

    const projectToken = new Token({ name, url, metadata, supply: 1, decimals: 0 })

    commit()

    A.publish()
    assert(balance(projectToken) == 1, 'NFT balance must be 1 at start')

    A.interact.onReady(getContract())
    A.interact.log('The project contract is ready')

    const [done, token] = parallelReduce([false, projectToken])
        .define(() => {
            ProjectView.project.set(token)
        })
        .invariant(balance() == 0 && balance(projectToken) == 1 && projectToken.supply() == 1 && projectToken.destroyed() == false)
        .while(!done)
        /**
         * Stops this contract
         */
        .api(
            Api.stop,
            () => {
                assume(this == A)
            },
            () => 0,
            k => {
                const isAdmin = this == A
                require(isAdmin)
                k(isAdmin)
                return [true, token]
            }
        )
        .timeout(false)

    assert(balance(projectToken) == 1, 'NFT balance must be 1 before burning')

    projectToken.burn()

    assert(balance(projectToken) == 0, 'NFT balance must be 0 after burning')
    assert(projectToken.supply() == 0, 'NFT supply must be 0 after burning')
    assert(projectToken.destroyed() == false, 'NFT supply must must not be destroyed before destruction')

    projectToken.destroy()
    commit()

    A.interact.log('The project contract is closing down...')

    exit()
})
