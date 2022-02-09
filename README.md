# Create your own New Relic Demo environment using AWS or Azure K8s Managed Cluster

-   This tutorial will walk you through the process on how you can fully observe a complex, multi-language microservice based E-Commerce application running in a Kubernetes cluster using [https://pixielabs.ai](https://pixielabs.ai) and New Relic
-   This walkthought will cover the following features of New Relic One Platform:
    -   Create new Kubernetes cluster using either Azure AKS or AWS EKS
    -   Deploy a Microservice E-Commerce Kubernetes application to your cluster
    -   Start observing your kubernetes application with Pixie without instrumentation
    -   Enable Distributed Tracing with New Relic APM
    -   Monitor Real User Experience using Browser Monitoring
    -   Pull custom K8s metrics into New Relic Database using Pixie Script and New Relic Flex
    -   View application Errors in New Relic Errors Inbox
    -   Jump straight to the error line in VSCode using New Relic CodeStream Integration

## Prerequisites

-   Azure or AWS Cloud account
-   A new New Relic account [sign up here](https://newrelic.com/signup)
-   Docker desktop installed [link] (https://docs.docker.com/get-docker/)
-   Docker Hub account [sign up here](https://hub.docker.com/signup)
-   Github account [sign up here](https://github.com/join)
-   Kubectl, helm3, nodejs, git, Azure or AWS cli installed
-   K6 load test tool [link](https://k6.io/docs/getting-started/installation/)
-   VScode [link](https://code.visualstudio.com/download)
-   Basic Bash knowledge since all commands are Bash commands
-   Clone this repo to your local machine

## Create fully managed Kubernetes cluster in AWS or Azure

### Create EKS Cluster in AWS

```bash
# install aws cli at https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
# login
aws configure

# install eksctl https://docs.aws.amazon.com/eks/latest/userguide/eksctl.html
# create new Managed nodes cluster (not the Fargate), this will create 2 nodes cluster (m5.larger)
eksctl create cluster --name pixiecluster --region us-east-1

# install kubectl cli tool to your computer https://kubernetes.io/docs/tasks/tools/
# download correct kubeconfig
eksctl utils write-kubeconfig --cluster=pixiecluster

# confirm can connect to the cluster
kubectl get nodes -o wide
```

### Create Azure AKS cluster

```bash
# install azure cli at https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
# login
az login

# if you have multiple subscriptions, select the right subscription
az account set -s SUBSCRIPTION_ID

# create resource group
az group create --name pixiedemo --location eastus

# create the K8s Cluster with 2 nodes WITHOUT monitoring. We need 2 in order to see 2 nodes in New Relic K8s Cluster Explorer
az aks create --resource-group pixiedemo --name pixiecluster --node-count 2 --enable-addons http_application_routing --generate-ssh-keys --enable-rbac

# install kubectl
az aks install-cli

# connect to the cluster via kubectl
az aks get-credentials --resource-group pixiedemo --name pixiecluster

# confirm can connect to the cluster
kubectl get nodes -o wide
```

## Deploy simple 2 Tier application (UI + Redis) on K8s Cluster and observe it using Pixie

-   First, let's deploy a very simple application and monitor it using New Relic and Pixie

```bash
# create simple Voting application
kubectl create namespace simplevote

kubectl apply -f apps/simple-vote.yaml --namespace=simplevote

# check external IP for the front end app and wait until the external-ip is on
kubectl get service simple-vote-front --watch --namespace=simplevote

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

## Run Pixie CLI locally

```bash
# install pixie-cli
bash install-pixie-no-auth.sh

# login to NewRelic One UI, select Kubernetes, click on the cluster and select Live debugging with Pixie and click "Copy command"
# from the copied command, you will see your Pixie API Key
# run this command
px auth login --api_key='PIXIE_API_KEY'

# show the list of out the box script you can run
px scripts list

# run one of the script
# open http://<EXTERNAL-IP> and click on Dogs or Cats then run this command
px run px/redis_data

```

## Setup E-Commerce Microservice application to AKS

-   Next, let's deploy this [e-commerce microservice application](https://github.com/microservices-demo/microservices-demo/blob/master/internal-docs/design.md) to the cluster

```bash
# the complete yaml for this application has been downloaded to /apps/sock-shop.yaml
# download https://raw.githubusercontent.com/microservices-demo/microservices-demo/master/deploy/kubernetes/complete-demo.yaml to your machine

curl "https://raw.githubusercontent.com/microservices-demo/microservices-demo/master/deploy/kubernetes/complete-demo.yaml" -o "apps/sock-shop.yaml"

# change line 313 from LoadBalancer from NodePort
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

# go to NR1, select Kubernetes and click on Live debugging with Pixie and select "px/http_request_stats"
# you will see traffic going into the cluster

# run a custom Pixie script to see the MongoDB connections
px run -f get_connections_to_mongodb.py
```

## Add APM to a NodeJs Service and enable distributed tracing

-   Right now, we don't have Distributed Tracing for the sock-shop application. This is because Pixie can only inspect HTTP traffic but cannot modify them. For Distributed Tracing to work, we will need to inject custom `traceid` header to every HTTP requests
-   This is why under `Services - APM` you wouldn't see any entries belong to the sock-shop
-   In this step, we will add New Relic APM agent to the front end of the sock-shop

```bash
# make sure you have an account with hub.docker.com and docker desktop installed on your machine and authenticated
# fork https://github.com/microservices-demo/front-end
mkdir sock-shop
cd sock-shop

# clone the front-end app
git clone https://github.com/<YOUR_GITHUB_USER>/front-end.git
cd front-end

# modify Dockerfile and change from 'FROM node:10-alpine' to 'FROM node:12-alpine' and build new docker image
docker build . -t <YOUR_DOCKER_ACCOUNT>/sock-shop-frontend:same


# if you're on Apple M1 macbook, then you will need to build amd64 version like this
# docker buildx build --platform linux/amd64 . -t <YOUR_DOCKER_ACCOUNT>/sock-shop-frontend:same
docker push <YOUR_DOCKER_ACCOUNT>/sock-shop-frontend:same

# file apps/sock-shop-frontend-own-image.yaml is exactly copied from the front-end deployment from the apps/sock-shop.yaml

# Note: update line 19 of /apps/sock-shop-frontend-own-image.yaml and replace YOUR_DOCKER_ACCOUNT with your docker account name
# from the root of this repo, apply the change
kubectl apply -f apps/sock-shop-frontend-own-image.yaml --namespace=sock-shop

# make sure URL still working
curl http://<EXTERNAL-IP>

# from inside front-end folder, install NR nodejs APM agent
cd sock-shop/front-end
npm install newrelic

docker build . -t <YOUR_DOCKER_ACCOUNT>/sock-shop-frontend:apm

# push the image again
docker push <YOUR_DOCKER_ACCOUNT>/sock-shop-frontend:apm

# store NewRelic Ingest API key as k8s secret
# From the root of this repo
echo -n 'YOUR_NR_INGEST_API' > ./nringestapi
kubectl create secret generic nrsecrets --from-file=./nringestapi

# inspect apps/sock-shop-frontend-own-image-with-apm.yaml file, you will see couple more NEW_RELIC_ Env variables added
# apply changes
kubectl apply -f apps/sock-shop-frontend-own-image-with-apm.yaml --namespace=sock-shop

# manually navigate to the app via browser, click through some pages
# go back to NR1, click on Browsers app, you should see new app in the list
```

## Add Browser monitoring

-   Now that we have APM agent installed for our backend services, let's monitor Real User experience by enabling Browser Integration

```bash
# go to NR1, select `Add more data` and select Browser and select 'Copy/Paste Javascript code'
# select 'sock-shop-frontend' from the list of apps

# edit /sock-shop/front-end/public/js/front.js file and paste the content of the <script type="text/javascript"> tag in it (NOT including <script type="text/javascript"> itself since this is not Javascript)

# build and push new front-end docker image
cd sock-shop/front-end
docker build . -t <YOUR_DOCKER_ACCOUNT>/sock-shop-frontend:rum
docker push <YOUR_DOCKER_ACCOUNT>/sock-shop-frontend:rum

# edit apps/sock-shop-frontend-own-image-with-rum.yaml and update YOUR_DOCKER_ACCOUNT then apply change
kubectl apply -f apps/sock-shop-frontend-own-image-with-rum.yaml --namespace=sock-shop

# manually navigate to the app via browser, click through some pages
# go back to NR1, click on Browsers app, you should see new app in the list
```

## Install New Relic Infrastructure Agent + Flex on K8s and push Pixie data to NRDB

-   Currently, for security reasons, when [Pixie](https://pixielabs.ai) is installed into your k8s cluster, New Relic only fetches and stores data that related to an application's performance. Therefore, you can only create Alert and Dashboard on a predefined subset of the data collected by Pixie [read more here](https://docs.newrelic.com/docs/kubernetes-pixie/auto-telemetry-pixie/pixie-data-security-overview/).
-   However, with New Relic Infrastructure Agent and Pixie CLI installed in your K8s cluster, you can write custom Pixie script and periodically push Pixie metrics to New Relic Database and then create dashboard and alerts on these metrics

```bash
# first, let's build and push new New Relic Infrastructure agent image with Pixie cli installed

# inspect `Dockerfile` file in the root of this repo
docker build . -t <YOUR_DOCKER_ACCOUNT>/newrelic_infrastructure_with_pixie:latest

docker push <YOUR_DOCKER_ACCOUNT>/newrelic_infrastructure_with_pixie:latest

# store NR Ingest and PIXIE API key in k8s secret
# you can get PIXIE API by click on `Copy command` link under `Live debugging with Pixie` tab on New Relic Kubernetes Cluster Explorer page
echo -n 'YOUR_PIXIE_API_KEY' > ./pixieapikey
echo -n 'YOUR_NR_INGEST_API' > ./nringestapi

# assuming your kubectl config file is at default location: $HOME/.kube/config
kubectl create secret generic pixiesecrets --from-file=./pixieapikey --from-file=./nringestapi --from-file=$HOME/.kube/config

# edit nri-flex.yml file and update line 23, updating YOUR_DOCKER_ACCOUNT
# deploy the change
kubectl apply -f nri-flex.yml

# go back to the sock shop app and click around
# After couple minutes, you can query the data in New Relic like this
```

![](querypixiedata.png)

## Introduce some error code and see them in New Relic

-   Right now the app is working perfectly, so there is no error
-   To introduce some error, let's modify `/front-end/api/cart/index.js` file and add the following

```javascript
app.post("/cart/update", function (req, res, next) {
    console.log("Attempting to update cart item: " + JSON.stringify(req.body));

    // throw an error when quantity is greater than 10
    if (parseInt(req.body.quantity) > 10) {
      throw new Error("10 items is too much");
    }

    // rest of the file..
```

-   NR only reports unhandled exceptions, since our ExpressJS has Error handler middleware, we will need to manually report exceptions to New Relic by modifying `/front-end/helpers/index.js` file

```javascript
// initialize newrelic
var newrelic = require('newrelic');

helpers.errorHandler = function (err, req, res, next) {
	var ret = {
		message: err.message,
		error: err,
	};

	// send error directly to NewRelic
	newrelic.noticeError(err);
	res.status(err.status || 500).send(ret);
};

// rest of the file...
```

-   Build and deploy the new image

```bash
cd front-end
docker build . -t <YOUR_DOCKER_ACCOUNT>/sock-shop-frontend:error

# push image
docker push <YOUR_DOCKER_ACCOUNT>/sock-shop-frontend:error

# Note: update line 19 of /apps/sock-shop-frontend-own-image-with-error.yaml and replace YOUR_DOCKER_ACCOUNT with your docker account name
# apply the change
kubectl apply -f apps/sock-shop-frontend-own-image-with-error.yaml --namespace=sock-shop

# go to the app on browser, add an item into the cart and then update the cart
# - set the quantity to 10 => works fine
# - set the quantity to 11 => get 500 server (you can see error in the network tab in browser Dev Tools)
# go to NR, select 'sock-shop-frontend' under APM, you should see some error reported under Events > Errors
```

-   Click on error will show stack trace
    ![](2022-02-08-19-06-15.png)

## Add workload and view Errors inbox

-   Go to NR1, select Workloads, then create new Workload
-   Select `sock-shop-frontend` app from APM
-   Go to Errors Inbox, select your new workload from the workload dropdown
-   You will see error in your Error inbox

![](2022-02-08-19-12-45.png)

## Install CodeStream to VSCode and view Errors inside the IDE

-   Install Vscode CodeStream extension and Sign up for an account
-   Create tag v0.0.1 and apply the changes by running the following command

```bash
# create and push new tag in front-end
cd apps/sock-shop/front-end
git tag -a v0.0.1 -m "tag version v0.0.1"
git push --tags

# get the current commit SHA by running this command
git log -1 --format="%H"
```

-   modify `sock-shop-frontend-own-image-with-error-codestream.yaml` file and update these env variables:
    -   `NEW_RELIC_METADATA_REPOSITORY_URL`: should be `https://github.com/YOUR_GH_ACCOUNT/front-end.git`
    -   `NEW_RELIC_METADATA_RELEASE_TAG`: should be `v0.0.1`
    -   `NEW_RELIC_METADATA_COMMIT`: output from the above `git log -1` command
-   Deploy the new yaml changes

```bash
# Note: update line 19 of /apps/sock-shop-frontend-own-image-with-error.yaml and replace YOUR_DOCKER_ACCOUNT with your docker account name
# from the root of the repo, apply changes
kubectl apply -f apps/sock-shop-frontend-own-image-with-error-codestream.yaml --namespace=sock-shop

# go back to the sock shop and reproduce the error again (update cart to 11 items)
# go back to Errors Inbox, click on the latest error
# click on 'Open in IDE', you should see VScode open at the right location, in read-only mode
```

![](2022-02-08-21-42-34.png)

![](2022-02-08-22-12-22.png)

-   Note: even when the code is changed, because CodeStream has the git SHA, Code Stream will still be able to show you the line of code from the stack trace
-   Let's demonstrate this by removing the lines of code we added earlier, like this

![](2022-02-08-22-39-44.png)

-   Click on `Open In IDE` again, you will see that VScode is displaying the line of code

![](2022-02-08-22-42-34.png)

# Clean up your Resources

```bash
# delete the Azure AKS cluster
az aks delete --name pixiecluster --resource-group pixiedemo

# delete the AWS EKS cluster
eksctl delete cluster --name pixiecluster --region us-east-1
```
