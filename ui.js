import {select} from 'd3'
import {zoom, zoomIdentity} from 'd3-zoom'
import {Library} from '@observablehq/stdlib'
import {DateTime} from 'luxon'


async function fetchJson(url) {
  let res = await fetch(url)
  let json = await res.json()
  return json
}

async function loadImage(url) {
  const img = new Image()
  const promise = new Promise(resolve => {
      img.addEventListener('load', resolve, {once:true})
  })
  img.src = url
  await promise
  return img
}

async function loadGrid(url, areaGrid) {
  let grid = []
  for (let [y, x] of areaGrid) {
    const image = await loadImage(`${url}/${String(y).padStart(3, '0')}_${String(x).padStart(3, '0')}.png`)
    grid.push({
      image: image,
      x: (x - 14) * image.width,
      y: (y - 6) * image.height
    })
  }
  return grid
}

function drawGrid(ctx, grid) {
  for (let cell of grid) {
    ctx.drawImage(cell.image, cell.x, cell.y + 10)
  }
}

async function load() {
  const areaGrid = [
    [7,14],
    [7,15],
    [6,14],
    [6,15],
  ]

  const map_kinds = ['borders', 'cities', 'roads']
  let maps = []
  for (let name of map_kinds) {
    const map_time = (await fetchJson(`/cache/json/goes-17/conus/maps/${name}/white/latest_times_all.json`)).timestamps_int[0]
    loadGrid(`/cache/maps/goes-17/conus/${name}/white/${map_time}/04`, areaGrid).then((grid) => {
      maps.push(grid)
    })
  }

  const times = Array.from((await fetchJson('/cache/json/goes-17/conus/geocolor/latest_times_5760.json')).timestamps_int).reverse().slice(-200)

  const progress = document.getElementById('ticks')
  const progressTicks = {}
  for (let time of times) {
    let div = document.createElement('div')
    progress.appendChild(div)
    progressTicks[time] = div
  }

  const productImages = {}
  //let first = true
  let i = 0
  for (let time of Array.from(times).reverse()) {
    let timeStr = time.toString()
    let promise = loadGrid(`/cache/imagery/${timeStr.substring(0, 4)}/${timeStr.substring(4, 6)}/${timeStr.substring(6, 8)}/goes-17---conus/geocolor/${time}/04`, areaGrid).then((grid) => {
      productImages[time] = grid
      progressTicks[time].classList.add('loaded')
    })
    //if (first) { // Wait for the first one so it loads faster
      //await promise
      //first = false
    //}
    if (i % 10 == 0) {
      await promise
    }
    i += 1
  }

  const cell_size = 625

  const timeText = document.getElementById('time')
  const canvas = document.getElementById('canvas')
  const width = canvas.offsetWidth
  const height = canvas.offsetHeight

  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  select(context.canvas).call(zoom()
      .scaleExtent([1, 8])
      .on("zoom", ({transform}) => zoomed(transform)))
  let transform = zoomIdentity
  function zoomed(newTransform) {
    transform = newTransform
    render()
  }

  let timeIndex = times.length - 1

  function render() {
    context.save()
    context.clearRect(0, 0, width, height)
    context.translate(transform.x, transform.y)
    context.scale(transform.k, transform.k)

    const time = times[timeIndex]
    const image = productImages[time]
    if (image) {
      drawGrid(context, image)
      for (let map of maps) {
        drawGrid(context, map)
      }
      timeText.innerText = DateTime.fromFormat(`${time}+0`, 'yyyyMMddHHmmssZ').toLocaleString(DateTime.DATETIME_FULL)
    }

    context.restore()
  }


  let timer = null

  function start() {
    timer = setInterval(() => {
      timeIndex += 1
      if (timeIndex >= times.length) {
        timeIndex = 0
      }
      render()

      for (const [time, element] of Object.entries(progressTicks)) {
        if (time == times[timeIndex]) {
          element.classList.add('active')
        } else {
          element.classList.remove('active')
        }
      }
    }, 1000/15)
  }

  function stop() {
    clearInterval(timer)
    timer = null
  }

  canvas.addEventListener('click', function (event) {
    if (timer == null) {
      start()
    } else {
      stop()
    }
  })

  render()
}

load()
