#!/bin/sh
# "local" StorageClass backed by the k3s built-in local-path-provisioner.
# Pin consuming pods to server-master so volumes land on master's local disk.
kubectl apply -f storageclass.yaml
