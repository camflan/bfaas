const ips = [
  "37.16.5.0/24",
  "66.51.122.0/24",
  "2a09:8280:1::6:3ae7/48"
]
async function setNullRoutes(){
  const sets : Promise<any>[] = []

  for(const ip of ips){
    const args = ["route", "add", "blackhole", ip]
    sets.push((() => {
      const cmd = new Deno.Command("ip", { args, stdout: "piped", stderr: "piped" })
      return cmd.output()
    })())
  }

  await Promise.all(sets);
}

const blackhole = setInterval(setNullRoutes, 1000);

const exit = async (server: Deno.HttpServer) => {
  clearInterval(blackhole);
  console.log(`Request finished, shutting down`);
  await server.shutdown();
  Deno.exit(0);
}

let httpHandled = false;
let requestCount = 0;

class OneTimeResponseStream extends TransformStream {
  constructor(server: Deno.HttpServer) {
    super({
      transform: (chunk, controller) => {
        controller.enqueue(chunk);
      },
      flush: (controller) => {
        controller.terminate();
        exit(server)
      }
    });
  }
}

const server: Deno.HttpServer = Deno.serve({port: 8080, hostname: "0.0.0.0"},
  async (request) => {
    console.log("Accepted request", ++requestCount);
    if(httpHandled){
      console.log("Already handled http request")
      return new Response("already dirty", {status: 500})
    }
    const url = new URL(request.url);
    const reqBody = await request.text();
    const script = await fetchScript(url, reqBody);
    let resp : Response;
    if (!script){
      resp = new Response("No script provided, use `script` param or POST a body", {status: 404})
    }else{
      httpHandled = true;
      resp = await execResponse(script); // run the thing that might take forever
    }

    return new Response(resp.body?.pipeThrough(new OneTimeResponseStream(server)), resp);
  }
)

//➜  ~ curl "https://bfaas.fly.dev/?exec=https://github.com/ruanyf/simple-bash-scripts/blob/master/scripts/whereIP.sh"

function getScriptURL(url: URL) {

  const raw = url.searchParams.get("script") || url.searchParams.get("exec");


  if(!raw){
    console.debug("No script provided")
    return raw
  }

  const scriptUrl = new URL(raw);

  if(scriptUrl.hostname != "github.com"){
    console.debug("Not github.com", raw)

    return raw;
  }
  let path = scriptUrl.pathname;
  const parts = path.substring(1).split("/")

  if (parts.length < 5) {
    console.debug("Not 5 segments in path", path)
    return raw;
  }
  const [,,,...file] = parts;
  path = parts.slice(0, 2).concat(file).join("/")

  return "https://raw.githubusercontent.com/" + path
}

async function fetchScript(url: URL, body:string) {
  
  if(body.length === 0){
    const scriptUrl = getScriptURL(url);
    //console.log(scriptUrl)

    if(!scriptUrl){ return }

    if(!scriptUrl){
      return;
    }

    console.log("Fetching:", scriptUrl);
    const resp = await fetch(scriptUrl);

    console.log("Got status:", resp.status)

    if(resp.status != 200){
      return
    }
    return await resp.text();
  }
  return body;
}

async function execResponse(script: string){
  // const body = new ReadableStream({
  //   start(controller) {
  //     timer = setInterval(() => {
  //       const message = `It is ${new Date().toISOString()}\n`;
  //       controller.enqueue(new TextEncoder().encode(message));
  //     }, 1000);
  //   },
  //   cancel() {
  //     if (timer !== undefined) {
  //       clearInterval(timer);
  //     }
  //   },
  // });


  //console.log("running:", args.join(" "))
  const command = new Deno.Command("/bin/bash", {
    args: ["-c", script],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  const child = command.spawn();
  child.stdin.close();

  const stdout = child.stdout.getReader();
  const stderr = child.stderr.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    start: async (controller) => {
      // const writer = child.stdin.getWriter();
      // writer.write(script);

      const enqueue = (label: string, chunk: ReadableStreamDefaultReadResult<Uint8Array>) => {
        const txt = decoder.decode(chunk.value)
        controller.enqueue(encoder.encode(`event: ${label}\ndata: ${JSON.stringify(txt)}\n\n`))
      }

      const readAll = async (label: string, reader: ReadableStreamDefaultReader<Uint8Array>) => {
        try {
          let chunk = await reader.read()
          while(!chunk.done){
            enqueue(label, chunk);
            chunk = await reader.read();
          }
        } catch (e) {
          console.error(e);
        }
      }

      const start = Date.now();
      setTimeout(() => {
        const seconds = Math.floor((Date.now() - start) / 1000);
        controller.enqueue(encoder.encode(`event: timeout\ndata: \"Execution canceled after ${seconds} seconds\n\"\n\n`))
        stdout.cancel("timeout");
        stderr.cancel("timeout"); 
        controller.close();
      }, 10000);

      await Promise.all([
        readAll("stdout", stdout),
        readAll("stderr", stderr)]
      );

      controller.close();
    },
    cancel: reason => {
      stdout.cancel(reason);
      stderr.cancel(reason); 
  },
  });

  const resp = new Response(body, { headers: {"Content-Type": "text/event-stream"} });
  return resp;
}