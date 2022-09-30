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
        projectToken: Token
    })

    const ProjectView = View('View', {
        projectToken: Token
    })

    const Api = API('Api', {
        update: Fun([Token], Null),
        stop: Fun([], Bool)
    })

    init()

    A.only(() => {
        const [projectToken] = declassify([interact.projectToken])
    })

    A.publish(projectToken)

    require(balance(projectToken) == 0, 'NFT balance must be 0 at start')

    A.interact.onReady(getContract())
    A.interact.log('The project contract is ready')

    const [done, token] = parallelReduce([false, projectToken])
        .define(() => {
            ProjectView.projectToken.set(token)
        })
        .invariant(balance() == 0 && balance(projectToken) == 0)
        .while(!done)
        /**
         * Update project token
         */
        .api(Api.update, (newToken, k) => {
            k(null)
            return [false, newToken]
        })
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

    require(balance(projectToken) == 0, 'NFT balance must be 0 at end')

    commit()

    A.interact.log('The project contract is closing down...')

    exit()
})
