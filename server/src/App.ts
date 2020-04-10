const rtcPortsRangeBegin = parseInt(process.env.RTC_PORTS_BEGIN) || 9002;
const rtcPortsRangeEnd = parseInt(process.env.RTC_PORTS_END) || 9100;
console.log(`RTC requests will be handled on ports ${rtcPortsRangeBegin} to ${rtcPortsRangeEnd}`);

import MediaServer from "medooze-media-server";
MediaServer.setPortRange(rtcPortsRangeBegin, rtcPortsRangeEnd);
const rtcEndpoint = MediaServer.createEndpoint(process.env.PUBLIC_IP || "127.0.0.1");

import WSHandler from "./WSHandler";
import * as WebSockets from "ws";
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

import express from "express";
import bodyParser from 'body-parser';
const app = express();

app.use(bodyParser.json());

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get("/ping", (req, res) => {
    res.send("PONG");
    res.end();
});

var port = process.env.PORT || 9000;
console.log("Web App listening on port " + port);
app.listen(port); // Use Express as a Janky way to block on a message loop