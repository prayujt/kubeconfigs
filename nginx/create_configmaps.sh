kubectl delete configmap nginx-config
kubectl delete configmap nginx-certs
kubectl delete configmap prayujt-website

kubectl create configmap nginx-config --from-file=nginx-config.tar.gz
kubectl create configmap nginx-certs --from-file=nginx-certs.tar.gz
kubectl create configmap prayujt-website --from-file=prayujt-website.tar.gz

