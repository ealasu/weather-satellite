async function fetchProxied(url) {
  return await fetch(`/proxy/${encodeURIComponent(url)}`);
}

async function fetchJson(url) {
  let res = await fetchProxied(url);
  let json = await res.json();
  return json;
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
  for (cell of grid) {
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

  const map_time = (await fetchJson('https://rammb-slider.cira.colostate.edu/data/json/goes-17/conus/lat/white/latest_times_all.json')).timestamps_int[0];
  const map_kinds = ['borders', 'cities', 'roads']
  let maps = []
  for (let name of map_kinds) {
    loadGrid(`https://rammb-slider.cira.colostate.edu/data/maps/goes-17/conus/${name}/white/${map_time}/04`, areaGrid).then((grid) => {
      maps.push(grid)
    })
  }

  const times = (await fetchJson('https://rammb-slider.cira.colostate.edu/data/json/goes-17/conus/geocolor/latest_times.json')).timestamps_int
  const productImages = {}
  let index = 0
  for (let time of Array.from(times).reverse()) {
    let i = index
    loadGrid(`https://rammb-slider.cira.colostate.edu/data/imagery/${time.toString().substring(0, 8)}/goes-17---conus/geocolor/${time}/04`, areaGrid).then((grid) => {
      productImages[i] = grid
    })
    index += 1
  }

  const cell_size = 625
  const canvas = document.getElementById('canvas')
  canvas.width = canvas.height = cell_size * 2
  const ctx = canvas.getContext('2d')

  const progressHeight = 10
  i = 0
  setInterval(() => {
    const image = productImages[i]
    if (image) {
      ctx.fillStyle = '#000'
      ctx.fillRect(i * progressHeight, 0, progressHeight, progressHeight)
      drawGrid(ctx, image)
      for (let map of maps) {
        drawGrid(ctx, map)
      }
    } else {
      ctx.fillStyle = '#ccc'
      ctx.fillRect(i * progressHeight, 0, progressHeight, progressHeight)
    }
    i += 1
    if (i >= times.length) {
      i = 0
    }
  }, 1000/20)
}

load()
