import { serve, serveDir, streams, path, fs } from "./deps.ts";

const cacheDurationMillis = 8 * 60 * 60 * 1000 // 8 hours
const cacheDir = 'static/cache'
Deno.mkdirSync(cacheDir + '/imagery', { recursive: true });
const rambbUrl = 'https://rammb-slider.cira.colostate.edu/data'
const area = [
  [7,14],
  [7,15],
  [6,14],
  [6,15],
]

async function addToCache(filePath: string, alwaysUpdate: boolean) {
    const cacheFilePath = path.join(cacheDir, filePath)
    if ((await fs.exists(cacheFilePath)) && !alwaysUpdate) {
        return
    }
    const url = `${rambbUrl}/${filePath}`
    console.log(url)
    await Deno.mkdir(path.dirname(cacheFilePath), { recursive: true });
    try {
        const fileResponse = await fetch(url);
        const file = await Deno.open(cacheFilePath, { write: true, create: true });
        if (fileResponse.body != null) {
          await fileResponse.body.pipeTo(streams.writableStreamFromWriter(file));
        }
    } catch (err) {
        console.error(`Failed to cache file ${url} : ${err}`)
    }
}

async function cacheGrid(timeUrl: string, imageUrl: (time: string) => string) {
    await addToCache(timeUrl, true)
    for (let time of JSON.parse(await Deno.readTextFile(`${cacheDir}/${timeUrl}`)).timestamps_int) {
        await Promise.all(area.map(([y, x]) => addToCache(`${imageUrl(time.toString())}/${String(y).padStart(3, '0')}_${String(x).padStart(3, '0')}.png`, false)))
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
        (time) => `imagery/${time.substring(0, 4)}/${time.substring(4, 6)}/${time.substring(6, 8)}/goes-17---conus/geocolor/${time}/04`
    )
    await cleanCache();
    console.log('Finished updating cache.')
}

function isEmptyIterable(iterable: Iterable<any>): boolean {
  for (const _ of iterable) {
    return false;
  }
  return true;
}

async function cleanCache() {
  let now = new Date().getTime();
  const rootDir = path.join(cacheDir, 'imagery');
  for await (const entry of fs.walk(rootDir)) {
    if (entry.path == rootDir) {
      continue;
    }
    const stat = await Deno.stat(entry.path);
    if (
      (!entry.isDirectory && stat.mtime != null && stat.mtime.getTime() < (now - cacheDurationMillis)) ||
      (entry.isDirectory && isEmptyIterable(Deno.readDirSync(entry.path)))
    ) {
      console.log(`Deleting ${entry.path}`)
      await Deno.remove(entry.path);
    }
  }
}

updateCache()
setInterval(updateCache, 1000 * 60) // 1 minute

serve((req) => {
  return serveDir(req, {
    fsRoot: "static",
  });
}, {port: 8080});
