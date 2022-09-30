/* eslint-disable no-console */
'use strict'

import { app } from './app.js'

const port = process.env.PORT || 3004

app.listen(port)
console.info(`Listening to http://localhost:${port} 🚀`)
