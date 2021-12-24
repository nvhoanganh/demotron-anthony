# New Relic Demo environment setup on Azure AKS

## Part 1. Setup a simple 2 Tier application (UI + Redis) on new AKS Cluster

```bash
# create resource group
az group create --name nrdemo --location eastus

# create the K8s Cluster with 2 nodes (do not enable monitoring)
az aks create --resource-group nrdemo --name mydemocluster --node-count 2 --enable-addons http_application_routing --generate-ssh-keys --enable-rbac

# connect to the cluster via kubectl
az aks install-cli
az aks get-credentials --resource-group nrdemo --name mydemocluster

# confirm can connect to the cluster
kubectl get nodes

# create the application
kubectl apply -f apps/azure-vote.yaml --namespace=azurevote

# check external IP for the front end app and wait until the external-ip is on
kubectl get service azure-vote-front --watch --namespace=azurevote

# test to make sure you can access the html
CURL http://<EXTERNAL-IP>

# install using helm3 (to install Helm 3 cli, follow https://helm.sh/docs/intro/install/)
kubectl apply -f https://download.newrelic.com/install/kubernetes/pixie/latest/px.dev_viziers.yaml && \
kubectl apply -f https://download.newrelic.com/install/kubernetes/pixie/latest/olm_crd.yaml && \
helm repo add newrelic https://helm-charts.newrelic.com && helm repo update && \
kubectl create namespace newrelic ; helm upgrade --install newrelic-bundle newrelic/nri-bundle \
 --set global.licenseKey=aa5e613a1dfacd9921d7b26e6f2f48070065NRAL \
 --set global.cluster=nrdemo \
 --namespace=newrelic \
 --set newrelic-infrastructure.privileged=true \
 --set global.lowDataMode=true \
 --set ksm.enabled=true \
 --set prometheus.enabled=true \
 --set kubeEvents.enabled=true \
 --set logging.enabled=true \
 --set newrelic-pixie.enabled=true \
 --set newrelic-pixie.apiKey=px-api-6202deb5-6fe5-444c-8df1-c95b576af463 \
 --set pixie-chart.enabled=true \
 --set pixie-chart.deployKey=px-dep-9cfbafee-c35a-43d1-a75f-8ee12999570b \
 --set pixie-chart.clusterName=nrdemo

# install k6 load test from https://k6.io and run quick load test (replace EXTERNAL-IP with the correct external IP you get above)
k6 run  -e PUBLIC_IP=<EXTERNAL-IP> loadtests/azure-vote.js

# go to NR1, select Kubernetes and click on Live debugging with Pixie and select "px/http_request_stats"
# you will see traffic going into the cluster
```

## Part 2. Setup a complex Microservice application to AKS

```bash
# deploy https://github.com/microservices-demo/microservices-demo/blob/master/internal-docs/design.md by first download the yaml file
curl -fsSL https://raw.githubusercontent.com/microservices-demo/microservices-demo/master/deploy/kubernetes/complete-demo.yaml > apps/sock-shop.yaml

# update the type for front-end servvice to LoadBalancer from NodePort
kubectl apply -f apps/sock-shop.yaml --namespace=sock-shop

# get the external IP of the front-end service
kubectl get service --watch --namespace=sock-shop

# make sure the frontend is now accessible
curl http://<EXTERNAL-IP>

# run load test against this new Website
k6 run  -e PUBLIC_IP=<EXTERNAL-IP> loadtests/sock-shop.js

# go to NR1, select Kubernetes and click on Live debugging with Pixie and select "px/http_request_stats"
# you will see traffic going into the cluster
```

## Part 3. Add APM to Node JS Service

```bash
# clone https://github.com/microservices-demo/front-end and build your own docker image
mkdir apps/sock-shop
cd apps/sock-shop
git clone https://github.com/microservices-demo/front-end
cd apps/sock-shop/front-end
docker build . -t <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:0.0.1

# if you're on M1 macbook (like me), then you will need to build amd64
docker push <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:0.0.1

# make a copy of sock-shop.yaml and replace image: weaveworksdemos/front-end:0.3.12 with your own image
# docker buildx build --platform linux/amd64 . -t <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:0.0.1

cd ../..
cp sock-shop.yaml sock-shop-copied.yaml

# apply the change
kubectl apply -f sock-shop-copied.yaml --namespace=sock-shop

# make sure URL still working
curl http://<EXTERNAL-IP>

# install
cd sock-shop/front-end
npm install newrelic --save

# go to NR1, Select "Add More "
# download newrelic.js file to the root of the front-end folder
# add require('newrelic') to beginning of server.js file
# run `npm start` and open http://localhost:8079 and make sure you receive data in NR1

# if yes, build new version again by running
# update Dockerfile under front-end folder, and base image to node:12-alpine from node:10-alpine since NewRelic package supports node > 12
docker build . -t <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:0.0.2

# push the image again
docker push <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:0.0.2

# update the version in sock-shop-copied.yaml and run kubectl apply again
kubectl apply -f sock-shop-copied.yaml --namespace=sock-shop
```
## Part 4. Add Browser monitoring

```bash
# go to NR1, select Add more data and select Browser and select 'Copy/Paste Javascript code'
# select the app from previous step
# edit apps/sock-shop/front-end/public/index.html file and add the script to the <head>
# run `npm start`, open the app at http://localhost:8079 and make sure you can see data for browser app

# build new version again
docker build . -t <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:0.0.3

# push the image again
docker push <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:0.0.3

# update the version in sock-shop-copied.yaml and run kubectl apply again
kubectl apply -f sock-shop-copied.yaml --namespace=sock-shop
```
