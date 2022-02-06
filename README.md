# New Relic Demo environment setup on Azure AKS
- This tutorial will walk you through the steps on how you can deploy a complex, multi-language microservice E-Commerce application to a AKS K8s cluster and then monitor it using [https://pixielabs.ai](https://pixielabs.ai) and New Relic

## Prerequisites
- Azure account with enough credit to run AKS cluster with 2 nodes
- a new New Relic account [sign up here](https://newrelic.com/signup)
- Docker desktop installed
- Docker Hub account [sign up here](https://hub.docker.com/signup)
- kubectl, helm3 CLI installed
- k6 load test tool [install here](https://k6.io/docs/getting-started/installation/)

## Part 1. Setup a simple 2 Tier application (UI + Redis) on new AKS Cluster
- First, let's setup our K8s Cluster in Azure and deploy a simple application and monitor it using New Relic and Pixie

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

# test to make sure you can access the html, you can also open this URL on browser
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


```

## Part 3. Setup E-Commerce Microservice application to AKS
- next, let's deploy our e-commerce microservice application [link](https://github.com/microservices-demo/microservices-demo/blob/master/internal-docs/design.md)
```bash
# deploy https://github.com/microservices-demo/microservices-demo/blob/master/internal-docs/design.md
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

# run a custom Pixie script to see the MongoDB connections
px run -f get_connections_to_mongodb.py

# run local pixie script - output in json or csv format
px run -f get_connections_to_mongodb.py -o json
```

## Part 4. Add APM to a NodeJs Service and enable distributed tracing
- right now, we don't really have distributed tracing for the sock-shop application. This is because Pixie can only inspect http traffic but cannot modify them. For Distributed tracing to work, we will need to inject custom `traceid` header to all HTTP traffic.
- right now under `Services - APM` you wouldn't see any entries belong to the sock-shop
- in this step, we will add New Relic APM agent to couple of our services and turn on distributed tracing

```bash
# signup for a docker.com account
# clone https://github.com/microservices-demo/front-end and build your own docker image
mkdir apps/sock-shop
cd apps/sock-shop
git clone https://github.com/microservices-demo/front-end.git
cd front-end
docker build . -t <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:same

# if you're on M1 macbook (like me), then you will need to build amd64
docker push <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:same

# update line 19 of /apps/sock-shop-frontend-1.yaml and replace nvhoanganh1909 with your docker account name
cd ../..

# apply the change
kubectl apply -f sock-shop-frontend-own-image.yaml --namespace=sock-shop

# make sure URL still working
curl http://<EXTERNAL-IP>

# install NR nodejs agent
cd sock-shop/front-end
npm install newrelic --save

# Edit Dockerfile and add ENV NEW_RELIC_NO_CONFIG_FILE=true
docker build . -t <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:apm

# push the image again
docker push <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:apm

# IMPORTANT: update sock-shop-frontend-own-image-with-apm.yaml file, line 33 with your NR API key
cd ../..
kubectl apply -f sock-shop-frontend-own-image-with-apm.yaml --namespace=sock-shop

# run load test again and come back to Services - APM, you should see one new entry there
k6 run  -e PUBLIC_IP=<EXTERNAL-IP> loadtests/sock-shop.js
```

## Part 5. Add APM to Golang Service and enable distributed tracing
- follow the same process in step 4, let's enable APM agent for the User service https://github.com/microservices-demo/user

```bash
# signup for a docker.com account
# clone https://github.com/microservices-demo/front-end and build your own docker image
mkdir apps/sock-shop
cd apps/sock-shop
git clone https://github.com/microservices-demo/user.git
cd user
docker build . -t <YOUR-DOCKER-ACCOUNT>/sock-shop-user:same

# if you're on M1 macbook (like me), then you will need to build amd64
docker push <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:same

# update line 19 of /apps/sock-shop-frontend-1.yaml and replace nvhoanganh1909 with your docker account name
cd ../..

# apply the change
kubectl apply -f sock-shop-frontend-own-image.yaml --namespace=sock-shop

# make sure URL still working
curl http://<EXTERNAL-IP>

# install NR nodejs agent
cd sock-shop/front-end
npm install newrelic --save

# Edit Dockerfile and add ENV NEW_RELIC_NO_CONFIG_FILE=true
docker build . -t <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:apm

# push the image again
docker push <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:apm

# IMPORTANT: update sock-shop-frontend-own-image-with-apm.yaml file, line 33 with your NR API key
cd ../..
kubectl apply -f sock-shop-frontend-own-image-with-apm.yaml --namespace=sock-shop

# run load test again and come back to Services - APM, you should see one new entry there
k6 run  -e PUBLIC_IP=<EXTERNAL-IP> loadtests/sock-shop.js
```

## Part 6. Add Browser monitoring
- now that we have APM agent installed for our backend services, let's monitor Real User experience by enabling Browser Integration

```bash
# go to NR1, select Add more data and select Browser and select 'Copy/Paste Javascript code'
# select the app from previous step
# edit apps/sock-shop/front-end/public/js/front.js file and paste the content of the <script type="text/javascript"> tag in it (NOT including <script type="text/javascript"> itself)

# build new version again
cd sock-shop/front-end
docker build . -t <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:rum

# push the image again
docker push <YOUR-DOCKER-ACCOUNT>/sock-shop-frontend:rum

# apply change
cd ../..
kubectl apply -f sock-shop-frontend-own-image-with-rum.yaml --namespace=sock-shop

# manually navigate to the app via browser, click through some pages
# go back to NR1, click on Browsers app, you should see new app in the list
```

## Install New Relic Infrastructure Agent + Flex on K8s and push Pixie data to NRDB

```bash

# get the nodes of the k8s cluster


# copy the name of the first node and paste it here
kubectl debug node/NODE_NAME_HERE -it --image=mcr.microsoft.com/aks/fundamental/base-ubuntu:v0.0.11

curl -Ls https://download.newrelic.com/install/newrelic-cli/scripts/install.sh | bash && NEW_RELIC_API_KEY=NRAK-WDEGR4KB9P7BPM2NT3IJC4UJ39V NEW_RELIC_ACCOUNT_ID=3400472 /usr/local/bin/newrelic install
```
# Clean up your Resources

```bash
# delete the AKS cluster
az aks delete --name pixiecluster --resource-group pixiedemo
```


bash -c "$(curl -fsSL https://withpixie.ai/install.sh)" && px auth login --api_key='px-api-b3982d46-a72c-4aa2-ba1e-28d1c5d1b24b' && px run px/cluster -c cf6e3d15-c112-4240-95c0-6266e05c29d0