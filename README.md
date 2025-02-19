# Datalab-UI

Frontend for the Datalab project. Connected to a [Backend Django Application](https://github.com/LCOGT/ptr_datalab) as well as the Science Archive.
### Important Technologies
- VueJs: Web Framework
- Vuetify: Component Library
- Leaflet Maps: Mapping Library
- Pinia: Global Store

## Development

There are two ways to run this project; running the app on your machine directly with NPM V.S the more complete local kube cluster method. 

If you need fast feedback and iterative development the minimal dev will be simplier,
but you should also test it and make sure it works using the full kubernetes cluster method before opening a PR.

### 1. Local Machine
```
npm install
npm run serve
```

### 2. Full K8s Enviorment
Enter the nix enviorment and ensure local cluster and registry are running
```
  nix develop --impure
  ctlptl apply -f local-registry.yaml -f local-cluster.yaml
```
Start the cluster and app
```
skaffold -m app dev --port-forward
```
