const request = require('request')
const express = require('express')

// Listen on a specific host via the HOST environment variable
var host = process.env.HOST || '0.0.0.0'
var port = process.env.PORT || '8082'

const app = express()
app.use(express.static(__dirname))
app.use('/proxy/:path', (req, res) => {
    const request_url = `${req.params.path}`
    req.pipe(request(request_url)).pipe(res)
})
app.listen(port)
console.log(`Listening on ${port}`)
