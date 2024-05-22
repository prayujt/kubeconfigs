kubectl delete configmap nginx-config -n nginx
kubectl delete configmap nginx-certs -n nginx
kubectl delete configmap prayujt-website -n nginx

rm /root/kubeconfigs/nginx/*.tar.gz
tar -czvf /root/kubeconfigs/nginx/nginx-config.tar.gz --directory=/etc/nginx .
tar -czvf /root/kubeconfigs/nginx/nginx-certs.tar.gz --directory=/etc/letsencrypt .
tar -czvf /root/kubeconfigs/nginx/prayujt-website.tar.gz --directory=/var/www/prayujt.com .

kubectl create configmap nginx-config -n nginx --from-file=/root/kubeconfigs/nginx/nginx-config.tar.gz
kubectl create configmap nginx-certs -n nginx --from-file=/root/kubeconfigs/nginx/nginx-certs.tar.gz
kubectl create configmap prayujt-website -n nginx --from-file=/root/kubeconfigs/nginx/prayujt-website.tar.gz

kubectl delete -f /root/kubeconfigs/nginx/nginx.yaml
sleep 1
kubectl apply -f /root/kubeconfigs/nginx/nginx.yaml
