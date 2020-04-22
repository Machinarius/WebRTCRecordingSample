import * as DotEnv from "dotenv";
DotEnv.config();

import express from "express";
import path from "path";
import fs from "fs";

import fileUpload from "express-fileupload";
import RecordingReceiver from "./RecordingFileReceiver";
import * as RecordingServer from "./RecordingFileServer";

if (!process.env.INCOMING_TEMP_FOLDER || !fs.existsSync(process.env.INCOMING_TEMP_FOLDER)) {
    throw new Error("Make sure INCOMING_TEMP_FOLDER is defined in the .env file, and that it points to a valid writeable folder");
}

const app = express();

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Range");

    if (req.method == "OPTIONS") {
        res.statusCode = 200;
        res.send("");
        return;
    }

    next();
});

app.use(fileUpload());

app.get("/ping", (req, res) => {
    res.send("PONG");
    res.end();
});

app.get("/", (req, res) => {
    res.send("PONG");
    res.end();
});

let recordingsPath = path.resolve(process.env.INCOMING_TEMP_FOLDER);
app.post("/recordings", RecordingReceiver(recordingsPath));
console.log("Storing incoming recording files temporarily into " + recordingsPath);

app.use(RecordingServer.Route, RecordingServer.MiddlewareFunc);
console.log("Serving recording files from S3 Bucket " + process.env.S3_TARGET_BUCKET);

var port = process.env.HTTP_PORT || 9000;
console.log("Web App listening on port " + port);
app.listen(port);