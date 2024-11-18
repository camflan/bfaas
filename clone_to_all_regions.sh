#!/usr/bin/env bash
set -eo pipefail
cfg=${1}
if [ "${cfg}" = "" ] ; then
    cfg="./fly.toml"
fi
echo "using fly config: ${cfg}"
machineId=$(fly m list --json -c "${cfg}" | jq '.[] | select(.region == "iad") | .id' -r | head -1)
for reg in $(diff <(fly m list --json -c "${cfg}"| jq '.[].region' -r | sort | uniq) <(fly platform regions --json | jq 'sort_by(.Code) | .[] | select(.Code != "maa") | .Code' -r) | grep -E '^> ' | sed -E 's/^> //g') ; do
    set -x
    fly regions add "${reg}"
    set +x
done