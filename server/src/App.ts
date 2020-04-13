import request from "sync-request";
import MediaServer from "medooze-media-server";
import * as WebSockets from "ws";
import express from "express";
import bodyParser from 'body-parser';
import path from "path";

import WSHandler from "./WSHandler";

var publicIPAddress = process.env.PUBLIC_IP_ADDRESS;
if (!publicIPAddress) {
    console.log("No Public IP Address provided - Contacting external service to determine Public IP Address...");

    const publicIPAPI = "https://api.bigdatacloud.net/data/client-ip";
    let publicIPResponse = request("GET", publicIPAPI);
    if (publicIPResponse.statusCode != 200 || publicIPResponse.isError()) {
        throw new Error("Execution can not continue. Could not determine public IP Address. Error Code: " + publicIPResponse.statusCode);
    }

    let publicIPPayload = JSON.parse(publicIPResponse.getBody("utf8"));
    publicIPAddress = publicIPPayload["ipString"] as string;
}
console.log("RTC requests will be handled by Public IP Address: " + publicIPAddress);

const rtcPortsRangeBegin = parseInt(process.env.RTC_PORTS_BEGIN) || 9002;
const rtcPortsRangeEnd = parseInt(process.env.RTC_PORTS_END) || 9100;
console.log(`RTC requests will be handled on Ports ${rtcPortsRangeBegin + 1} through ${rtcPortsRangeEnd}`);

MediaServer.setPortRange(rtcPortsRangeBegin, rtcPortsRangeEnd);
const rtcEndpoint = MediaServer.createEndpoint(publicIPAddress);

const wsPort = parseInt(process.env.WEBSOCKETS_PORT) || 9001;
const wsServer = new WebSockets.Server({
    port: wsPort,
    host: "0.0.0.0"
});
wsServer.on("connection", (client: WebSocket) => {
    var handler = new WSHandler(client, rtcEndpoint);
    handler.beginSession();
});
console.log("WebSockets server listening on port " + wsPort);

const app = express();
app.use(bodyParser.json());

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Range");
    next();
});

app.get("/ping", (req, res) => {
    res.send("PONG");
    res.end();
});

app.get("/", (req, res) => {
    res.send("PONG");
    res.end();
});

let recordingsPath = path.resolve("./recordings");
app.use("/recordings", express.static(recordingsPath, {
    fallthrough: false,
    index: false
}));
console.log("Serving recording files from " + recordingsPath);

var port = process.env.HTTP_PORT || 9000;
console.log("Web App listening on port " + port);
app.listen(port);