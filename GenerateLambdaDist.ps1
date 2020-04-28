param (
    [switch] $Deploy,
    [switch] $RunLocal,
    [string] $Stage = ""
)

If (Test-Path .\dist) {
    Remove-Item -Recurse .\dist
}

New-Item -ItemType Directory -Path .\dist
New-Item -ItemType Directory -Path .\dist\frontend

Set-Location .\client

If ($Deploy) {
    yarn run webpack --config webpack.prod.js
} else {
    yarn run webpack --config webpack.dev.js
}

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

    If ($Stage) {
        serverless deploy --stage $Stage
    } else {
        serverless deploy
    }

    Set-Location ..
}