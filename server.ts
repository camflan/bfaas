// Start listening on port 8080 of localhost.
const server = Deno.listen({ hostname: "0.0.0.0", port: 8080 });
console.log(`HTTP webserver running.  Access it at:  http://0.0.0.0:8080/`);

// Connections to the server will be yielded up as an async iterable.
for await (const conn of server) {
  // In order to not be blocking, we need to handle each connection individually
  // without awaiting the function
  serveHttp(conn);
}


async function serveHttp(conn: Deno.Conn) {
  // This "upgrades" a network connection into an HTTP connection.
  const httpConn = Deno.serveHttp(conn);
  // Each request sent over the HTTP connection will be yielded as an async
  // iterator from the HTTP connection.
  for await (const requestEvent of httpConn) {
    // The native HTTP server uses the web standard `Request` and `Response`
    // objects.
    const url = new URL(requestEvent.request.url);
    const script = await fetchScript(url);
    
    if (!script){
      requestEvent.respondWith(
        new Response("No script provided, use `script` param", {status: 404})
      )
      continue;
    }


    const timeout = new Promise<Response>((resolve, _reject) => {
      setTimeout(() => {
        resolve(new Response("Timed out", { status: 408}));
      }, 10000);
    });

    const resp = await Promise.race([
      execResponse(script, url.searchParams.getAll("args")), // run the thing that might take forever
      timeout // or the timeout might return first
    ]);
    requestEvent.respondWith(resp);

    console.log("All done, exiting")
    server.close();
    return
  }
}

//➜  ~ curl "https://bfaas.fly.dev/?exec=https://github.com/ruanyf/simple-bash-scripts/blob/master/scripts/whereIP.sh"

function getScriptURL(url: URL) {

  const raw = url.searchParams.get("script");


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

async function fetchScript(url: URL) {
  const scriptUrl = getScriptURL(url);

  if(!scriptUrl){ return }

  let name = new URL(scriptUrl).pathname.split("/").pop();

  if(!name){
    name = "script.sh";
  }

  if(!scriptUrl){
    return;
  }

  console.log("Fetching:", scriptUrl);
  const resp = await fetch(scriptUrl);

  console.log("Got status:", resp.status)

  if(resp.status != 200){
    return
  }
  const body = await resp.text()
  await Deno.writeTextFile(name, body);
  return name;
}

async function execResponse(path: string, args?: string[]){
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

  const cmd = ["/bin/bash", path]

  if(args && args.length > 0){
    cmd.push(...args)
  }

  console.log("running:", cmd.join(" "))

  const p = Deno.run({
    cmd,
    stdout: "piped",
    stderr: "piped",
  });
  
  const { code } = await p.status();
  console.log(`Exec status ${code}`)
  
  // Reading the outputs closes their pipes
  const rawOutput = await p.output();
  const rawError = await p.stderrOutput();

  let output = new TextDecoder().decode(rawOutput);
  const error = new TextDecoder().decode(rawError);

  if(error.length > 0){
    output = [output, error].join("\n------------\n")
  }
  
  if (code === 0) {
    return new Response(output)
  } else {
    return new Response(output, {status: 500})
  }
  
  //Deno.exit(code);
}