param (
    [switch] $Deploy,
    [switch] $RunLocal
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
Copy-Item .\server\package.json .\dist\package.json
Copy-Item .\server\yarn.lock .\dist\yarn.lock

Set-Location .\dist
yarn install --production
Set-Location ..

If (Test-Path .\server\.env) {
    Copy-Item .\server\.env .\dist\.env
}

Copy-Item -Recurse -Container .\client\dist .\dist\frontend\dist
Copy-Item .\client\index.html .\dist\frontend\index.html

Copy-Item .\serverless.yml .\dist\serverless.yml

If ($RunLocal) {
    try {
        Set-Location .\dist
        node .\LocalEntrypoint.js
    } finally {
        Set-Location ..
    }
}

If ($Deploy) {
    Set-Location .\dist
    serverless deploy

    Set-Location ..
}