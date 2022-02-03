# create resource group
az group create --name pixiedemo --location eastus

# create the K8s Cluster with 2 nodes (do not enable monitoring)
az aks create \
  --resource-group pixiedemo \
  --name pixiecluster \
  --node-count 2 --enable-addons http_application_routing \
  --generate-ssh-keys \
  --enable-rbac

az aks get-credentials --resource-group pixiedemo --name pixiecluster

kubectl create namespace azurevote

kubectl apply -f apps/azure-vote.yaml --namespace=azurevote