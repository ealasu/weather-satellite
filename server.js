const request = require('request')
const express = require('express')
const got = require('got')
const stream = require('stream')
const {promisify} = require('util')
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const pipeline = promisify(stream.pipeline)

// Listen on a specific host via the HOST environment variable
var host = process.env.HOST || '0.0.0.0'
var port = process.env.PORT || '8082'

const cacheDurationMillis = 8 * 60 * 60 * 1000 // 8 hours
const cacheDir = path.join(__dirname, 'cache')
mkdirp.sync(path.join(cacheDir, 'imagery'))
const rambbUrl = 'https://rammb-slider.cira.colostate.edu/data'
const area = [
  [7,14],
  [7,15],
  [6,14],
  [6,15],
]

async function addToCache(filePath, alwaysUpdate) {
    const cacheFilePath = path.join(cacheDir, filePath)
    try {
        fs.accessSync(cacheFilePath)
        if (!alwaysUpdate) {
            return
        }
    } catch (err) {}
    const url = `${rambbUrl}/${filePath}`
    console.log(url)
    mkdirp.sync(path.dirname(cacheFilePath))
    try {
        await pipeline(
            got.stream(url),
            fs.createWriteStream(cacheFilePath)
        )
    } catch (err) {
        console.error(`Failed to cache file ${url} : ${err}`)
    }
}

async function cacheGrid(timeUrl, imageUrl) {
    await addToCache(timeUrl, true)
    for (let time of JSON.parse(fs.readFileSync(`${cacheDir}/${timeUrl}`)).timestamps_int) {
        await Promise.all(area.map(([y, x]) => addToCache(`${imageUrl(time)}/${String(y).padStart(3, '0')}_${String(x).padStart(3, '0')}.png`)))
        //for (let [y, x] of area) {
            //await 
                ////.catch((error) => console.error(`Failed to add file to cache: ${error}`))
        //}
    }
}

async function updateCache() {
    console.log('Updating cache...')
    await cacheGrid(
        'json/goes-17/conus/lat/white/latest_times_all.json',
        (time) => `maps/goes-17/conus/borders/white/${time}/04`
    )
    await cacheGrid(
        'json/goes-17/conus/lat/white/latest_times_all.json',
        (time) => `maps/goes-17/conus/cities/white/${time}/04`
    )
    await cacheGrid(
        'json/goes-17/conus/lat/white/latest_times_all.json',
        (time) => `maps/goes-17/conus/roads/white/${time}/04`
    )
    await cacheGrid(
        'json/goes-17/conus/geocolor/latest_times.json',
        (time) => `imagery/${time.toString().substring(0, 8)}/goes-17---conus/geocolor/${time}/04`
    )
    console.log('Finished updating cache.')
}

updateCache()
setInterval(updateCache, 1000 * 60) // 1 minute

function walk(directoryName, visit) {
  let files = fs.readdirSync(directoryName)
  for (let file of files) {
    let fullPath = path.join(directoryName,file)
    let stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      walk(fullPath, visit)
    }
    visit(fullPath, stat)
  }
}

function cleanCache() {
  let now = +new Date()
  walk(path.join(cacheDir, 'imagery'), (filePath, stat) => {
    if (!stat.isDirectory() && stat.mtimeMs < (now - cacheDurationMillis)) {
      console.log(`Deleting ${filePath}`)
      fs.rmSync(filePath)
    }
    if (stat.isDirectory() && fs.readdirSync(filePath).length == 0) {
      console.log(`Deleting ${filePath}`)
      fs.rmdirSync(filePath)
    }
  })
}
cleanCache()



const app = express()
app.use(express.static(__dirname))
//app.use('/proxy/:path', (req, res) => {
    //const request_url = `${req.params.path}`
    //req.pipe(request(request_url)).pipe(res)
//})
app.listen(port)
console.log(`Listening on ${port}`)
