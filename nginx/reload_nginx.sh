#!/bin/bash

# Get the list of pod names
pods=$(kubectl get pods -o wide -n nginx | tail -n +2 | awk '{print $1}')

# Iterate over each pod name
for pod in $pods; do
    # Run kubectl exec command for each pod to reload nginx
    kubectl exec -it "$pod" -n nginx -- nginx -s reload
done

