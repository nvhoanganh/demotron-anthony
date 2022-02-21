# create resource group
az group create --name pixiedemo --location eastus

# create the K8s Cluster with 2 nodes WITHOUT monitoring. We need 2 in order to see 2 nodes in New Relic K8s Cluster Explorer
az aks create --resource-group pixiedemo --name pixiecluster --node-count 2 --enable-addons http_application_routing --generate-ssh-keys --enable-rbac

# connect to the cluster via kubectl
az aks get-credentials --resource-group pixiedemo --name pixiecluster

# confirm can connect to the cluster
kubectl get nodes -o wide

# install pixie and new relic agent
kubectl apply -f https://download.newrelic.com/install/kubernetes/pixie/latest/px.dev_viziers.yaml && \
kubectl apply -f https://download.newrelic.com/install/kubernetes/pixie/latest/olm_crd.yaml && \
helm repo add newrelic https://helm-charts.newrelic.com && helm repo update && \
kubectl create namespace newrelic ; helm upgrade --install newrelic-bundle newrelic/nri-bundle \
 --set global.licenseKey=e6273915556b05515c892a5161e6405b2c9dNRAL \
 --set global.cluster=pixiedemo \
 --namespace=newrelic \
 --set newrelic-infrastructure.privileged=true \
 --set global.lowDataMode=true \
 --set ksm.enabled=true \
 --set kubeEvents.enabled=true \
 --set prometheus.enabled=true \
 --set logging.enabled=true \
 --set logging.enabled=true \
 --set newrelic-pixie.enabled=true \
 --set newrelic-logging.fluentBit.criEnabled=true \
 --set newrelic-pixie.apiKey=px-api-b3982d46-a72c-4aa2-ba1e-28d1c5d1b24b \
 --set pixie-chart.enabled=true \
 --set pixie-chart.deployKey=px-dep-d3bcc681-53c7-4106-8a93-8dc62bcc93a7 \
 --set pixie-chart.clusterName=pixiedemo


# deploy the sock-shop app
# download https://raw.githubusercontent.com/microservices-demo/microservices-demo/master/deploy/kubernetes/complete-demo.yaml to your machine

curl "https://raw.githubusercontent.com/microservices-demo/microservices-demo/master/deploy/kubernetes/complete-demo.yaml" -o "apps/sock-shop.yaml"

# change line 313 of apps/sock-shop.yaml file, from NodePort to LoadBalancer
kubectl create namespace sock-shop

# deploy the app
kubectl apply -f apps/sock-shop.yaml --namespace=sock-shop

# get the external IP of the front-end service
kubectl get service --watch --namespace=sock-shop

# make sure all containers are running properly
kubectl get pod --namespace=sock-shop

# make sure the frontend is now accessible
curl http://<EXTERNAL-IP>

# open http://<EXTERNAL-IP> and play around with the app (sign up for user, add to cart, checkout, etc..)

# run load test against this new Website
k6 run -e PUBLIC_IP=<EXTERNAL-IP> loadtests/sock-shop.js

# go to New Relic One, select Kubernetes and click on Live debugging with Pixie and select "px/http_request_stats"
# you will see traffic going into the cluster

# run a custom Pixie script to see the MongoDB connections
px run -f get_connections_to_mongodb.py