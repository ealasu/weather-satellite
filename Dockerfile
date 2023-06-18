FROM node:19-alpine as builder
WORKDIR /src
ADD package.json /src/
ADD package-lock.json /src/
RUN npm install
ADD ui.js /src/
RUN ./node_modules/.bin/esbuild ui.js --bundle --outfile=ui-bundle.js

FROM denoland/deno:ubuntu-1.21.0
EXPOSE 8080
WORKDIR /app

RUN apt-get update && apt-get install -y imagemagick ffmpeg

RUN mkdir -p /app/static/cache && chown deno /app/static/cache
USER deno

# Cache the dependencies as a layer (the following two steps are re-run only when deps.ts is modified).
# Ideally cache deps.ts will download and compile _all_ external files used in main.ts.
COPY deps.ts .
RUN deno cache deps.ts

# These steps will be re-run upon each file change in your working directory:
ADD . .
# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache server.ts

COPY --from=builder /src/ui-bundle.js /app/static/ui.js

CMD ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-run=bash", "server.ts"]
