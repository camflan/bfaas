# BFaaS (Prounced beef-ass)

This is a very small Deno app that runs Bash Functions-as-a-Service.

## Running Bash scripts

`bfaas.fly.dev` accepts a script to execute with `/bin/bash`. Simply POST a bash script to the service and, you know, enjoy.

This service returns an SSE response with these events: 

* `stdout (string)`: standard output from script
* `stderr (string)`: standard error from script
* `timeout (string)`: error message indicating timeout

Example: 

```
➜  ~ curl -X POST -d "ls -la /" -D -

HTTP/2 200
content-type: text/event-stream
vary: Accept-Encoding
date: Fri, 01 Nov 2024 04:22:34 GMT
server: Fly/2936d2942 (2024-10-30)
via: 2 fly.io
fly-request-id: 01JBJZBVRD49TXK4Q7QHPDQW39-dfw

event: stdout
data: "total 104\ndrwxr-xr-x   1 root root  4096 Nov  1 04:22 .\ndrwxr-xr-x   1 root root  4096 Nov  1 04:22 ..\ndrwxr-xr-x   2 root root  4096 Nov  1 04:22 .fly\ndrwxr-xr-x   7 root root  4096 Nov  1 04:22 .fly-upper-layer\ndrwxr-xr-x   2 root root  4096 Nov  1 04:19 bfaas\nlrwxrwxrwx   1 root root     7 Oct 16 00:00 bin -> usr/bin\ndrwxr-xr-x   2 root root  4096 Aug 14 16:10 boot\ndrwxr-xr-x   1 deno deno  4096 Nov  1 04:22 deno-dir\ndrwxr-xr-x  10 root root  2620 Nov  1 04:22 dev\ndrwxr-xr-x   1 root root  4096 Nov  1 04:22 etc\ndrwxr-xr-x   2 root root  4096 Aug 14 16:10 home\nlrwxrwxrwx   1 root root     7 Oct 16 00:00 lib -> usr/lib\nlrwxrwxrwx   1 root root     9 Oct 16 00:00 lib64 -> usr/lib64\ndrwxr-xr-x   2 root root  4096 Oct 16 00:00 media\ndrwxr-xr-x   2 root root  4096 Oct 16 00:00 mnt\ndrwxr-xr-x   2 root root  4096 Oct 16 00:00 opt\ndr-xr-xr-x 128 root root     0 Nov  1 04:22 proc\ndrwx------   2 root root  4096 Oct 16 00:00 root\ndrwxr-xr-x   3 root root  4096 Oct 16 00:00 run\nlrwxrwxrwx   1 root root     8 Oct 16 00:00 sbin -> usr/sbin\ndrwxr-xr-x   2 root root  4096 Oct 16 00:00 srv\ndr-xr-xr-x  12 root root     0 Nov  1 04:22 sys\n-rwxr-xr-x   1 root root 24064 Oct 30 04:06 tini\ndrwxrwxrwt   2 root root  4096 Oct 16 00:00 tmp\ndrwxr-xr-x   1 root root  4096 Oct 16 00:00 usr\ndrwxr-xr-x  11 root root  4096 Oct 16 00:00 var\n"
```

## Isn't this a terrible idea?

Yes. Don't just deploy this app any ol' place. It's designed to [run in Fly Machines](https://fly.io/docs/reference/machines/). The process exits after it runs a user script, and the rootfs is reset before the VM starts back up.

There's a basic 10s timer to prevent long running scripts. Other than that, people can do all kinds of terrible stuff within the VM.