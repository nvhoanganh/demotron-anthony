# New Relic Demo environment setup on Azure AKS

## Part 1. Setup a simple 2 Tier application (UI + Redis) on new AKS Cluster

```bash
# create resource group
az group create --name pixiedemo --location eastus

# create the K8s Cluster with 2 nodes (do not enable monitoring)
az aks create --resource-group pixiedemo --name pixiecluster --node-count 2 --enable-addons http_application_routing --generate-ssh-keys --enable-rbac

# connect to the cluster via kubectl
az aks install-cli
az aks get-credentials --resource-group pixiedemo --name pixiecluster

# confirm can connect to the cluster
kubectl get nodes

# create the application
kubectl create namespace azurevote

kubectl apply -f apps/azure-vote.yaml --namespace=azurevote

# check external IP for the front end app and wait until the external-ip is on
kubectl get service azure-vote-front --watch --namespace=azurevote

# test to make sure you can access the html
CURL http://<EXTERNAL-IP>

# install helm3 at https://helm.sh/docs/intro/install/
# login to newrelic one and follow guided install to add new k8s integration using heml3 command
# install using helm3
kubectl apply -f https://download.newrelic.com/install/kubernetes/pixie/latest/px.dev_viziers.yaml && \
kubectl apply -f https://download.newrelic.com/install/kubernetes/pixie/latest/olm_crd.yaml && \
helm repo add newrelic https://helm-charts.newrelic.com && helm repo update && \
kubectl create namespace newrelic ; helm upgrade --install newrelic-bundle newrelic/nri-bundle \
 --set global.licenseKey=LICENSE_KEY \
 --set global.cluster=pixiedemo \
 --namespace=newrelic \
 --set newrelic-infrastructure.privileged=true \
 --set global.lowDataMode=true \
 --set ksm.enabled=true \
 --set kubeEvents.enabled=true \
 --set prometheus.enabled=true \
 --set logging.enabled=true \
 --set newrelic-pixie.enabled=true \
 --set newrelic-pixie.apiKey=PIXIE_API_KEY \
 --set pixie-chart.enabled=true \
 --set pixie-chart.deployKey=PIXIE_DEPLOY_KEY \
 --set pixie-chart.clusterName=pixiedemo

# install k6 load test from https://k6.io and run quick load test (replace EXTERNAL-IP with the correct external IP you get above)
k6 run -e PUBLIC_IP=<EXTERNAL-IP> loadtests/azure-vote.js

# go to NR1, select Kubernetes and click on Live debugging with Pixie and select "px/http_request_stats"
# you will see traffic going into the cluster
```

## Part 2. Run pixie CLI locally

```bash
# install pixie-cli
bash install-pixie-no-auth.sh

# login to NewRelic One UI, select Kubernetes, click on the cluster and select Live debugging with Pixie and click "Copy command"
# run this command
px auth login --api_key='YOUR_API_KEY'

# show the list of out the box script you can run
px scripts list

# run one of the script
# open http://<EXTERNAL-IP> and click on Dogs or Cats then run this command
px run px/redis_data

# run local pixie script
px run -f pixiescripts/getagents.pxl

# run local pixie script - output in json format
px run -f pixiescripts/getagents.pxl -o json

# run local pixie script - output in csv format
px run -f pixiescripts/getagents.pxl -o csv
```

## Part 3. Setup E-Commerce Microservice application to AKS

```bash
# deploy https://github.com/microservices-demo/microservices-demo/blob/master/internal-docs/design.md by first download the yaml file
curl -fsSL https://raw.githubusercontent.com/microservices-demo/microservices-demo/master/deploy/kubernetes/complete-demo.yaml > apps/sock-shop.yaml

# update the type for front-end servvice to LoadBalancer from NodePort
kubectl create namespace sock-shop

kubectl apply -f apps/sock-shop.yaml --namespace=sock-shop

# get the external IP of the front-end service
kubectl get service --watch --namespace=sock-shop

# make sure all containers are running properly
kubectl get pod --namespace=sock-shop

# make sure the frontend is now accessible
curl http://<EXTERNAL-IP>

# open http://<EXTERNAL-IP> and play around with the app (sign up for user, add to cart, checkout, etc..)

# run load test against this new Website
k6 run  -e PUBLIC_IP=<EXTERNAL-IP> loadtests/sock-shop.js

# go to NR1, select Kubernetes and click on Live debugging with Pixie and select "px/http_request_stats"
# you will see traffic going into the cluster
```

## Part 4. Add APM to Node JS Service

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

## Delete your cluster

```bash
az aks delete --name pixiecluster --resource-group pixiedemo
```