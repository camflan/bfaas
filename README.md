# BFaaS (Prounced beef-ass)

This is a very small Deno app that runs Bash Functions-as-a-Service.

## Running Bash scripts

`bfaas.fly.dev` has two parameters:

* `script` URL to execute with bash
* `args` Arguments. You can pass this multiple times

Example: 

```
➜  ~ curl "https://bfaas.fly.dev/?script=https://github.com/ruanyf/simple-bash-scripts/blob/master/scripts/whereIP.sh&args=108.160.195.151"

Chicago, Illinois in United States.
```

## Isn't this a terrible idea?

Yes. Don't just deploy this app any ol' place. It's designed to [run in Fly Machines](https://fly.io/docs/reference/machines/). The process exits after it runs a user script, and the rootfs is reset before the VM starts back up.

There's a basic 10s timer to prevent long running scripts. Other than that, people can do all kinds of terrible stuff within the VM.