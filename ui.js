import {select} from 'https://cdn.skypack.dev/d3@7'
import {zoom, zoomIdentity} from "https://cdn.skypack.dev/d3-zoom@3"
import {Library} from 'https://cdn.skypack.dev/@observablehq/stdlib@3'


async function fetchJson(url) {
  let res = await fetch(url)
  let json = await res.json()
  return json
}

async function loadImage(url) {
  const img = new Image();
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

  const map_time = (await fetchJson('/cache/json/goes-17/conus/lat/white/latest_times_all.json')).timestamps_int[0];
  const map_kinds = ['borders', 'cities', 'roads']
  let maps = []
  for (let name of map_kinds) {
    loadGrid(`/cache/maps/goes-17/conus/${name}/white/${map_time}/04`, areaGrid).then((grid) => {
      maps.push(grid)
    })
  }

  const times = (await fetchJson('/cache/json/goes-17/conus/geocolor/latest_times.json')).timestamps_int

  const progress = document.getElementById('progress')
  const progressTicks = {}
  for (let time of Array.from(times).reverse()) {
    let div = document.createElement('div')
    progress.appendChild(div)
    progressTicks[time] = div
  }

  const productImages = {}
  let index = 0
  for (let time of Array.from(times).reverse()) {
    let i = index
    loadGrid(`/cache/imagery/${time.toString().substring(0, 8)}/goes-17---conus/geocolor/${time}/04`, areaGrid).then((grid) => {
      productImages[i] = grid
      progressTicks[time].classList.add('loaded')
    })
    index += 1
  }

  const cell_size = 625

  const canvas = document.getElementById('canvas')
  const width = canvas.offsetWidth
  const height = canvas.offsetHeight

  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  //const context = new Library().DOM.context2d(width * window.devicePixelRatio, height * window.devicePixelRatio)
  //const context = new Library().DOM.context2d(width, height)
  //document.body.appendChild(context.canvas)

  select(context.canvas).call(zoom()
      .scaleExtent([1, 8])
      .on("zoom", ({transform}) => zoomed(transform)));
  let transform = zoomIdentity
  function zoomed(newTransform) {
    transform = newTransform
    render()
  }

  let timeIndex = 0

  function render() {
    context.save();
    context.clearRect(0, 0, width, height);
    context.translate(transform.x, transform.y);
    context.scale(transform.k, transform.k);

    const image = productImages[timeIndex]
    if (image) {
      //ctx.fillStyle = '#000'
      //ctx.fillRect(i * progressHeight, 0, progressHeight, progressHeight)
      drawGrid(context, image)
      for (let map of maps) {
        drawGrid(context, map)
      }
    } else {
      //ctx.fillStyle = '#ccc'
      //ctx.fillRect(i * progressHeight, 0, progressHeight, progressHeight)
    }

    context.restore();
  }


  let timer = null

  function start() {
    timer = setInterval(() => {
      timeIndex += 1
      if (timeIndex >= times.length) {
        timeIndex = 0
      }
      render()
    }, 1000/24)
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
  start()
}

load()
