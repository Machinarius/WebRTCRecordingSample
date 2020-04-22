param (
    [switch] $Deploy
)

If (Test-Path .\dist) {
    Remove-Item -Recurse .\dist
}

New-Item -ItemType Directory -Path .\dist
New-Item -ItemType Directory -Path .\dist\frontend

Set-Location .\client
yarn run webpack

Set-Location ..\server
yarn run tsc --sourceMap false --outDir ..\dist\ --project .\tsconfig.json

Set-Location ..
Copy-Item -Recurse -Container .\server\node_modules .\dist\node_modules

Copy-Item -Recurse -Container .\client\dist .\dist\frontend\dist
Copy-Item .\client\index.html .\dist\frontend\index.html

Copy-Item .\serverless.yml .\dist\serverless.yml

If ($Deploy) {
    Set-Location .\dist
    serverless deploy

    Set-Location ..
}