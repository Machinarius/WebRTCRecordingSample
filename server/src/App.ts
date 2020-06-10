import * as DotEnv from "dotenv";
DotEnv.config();

import express from "express";
import fs from "fs";

import * as RecordingServer from "./RecordingFileServer";
import * as RecordingsTicketer from "./RecordingsTicketer";
import * as FormStateStore from "./FormStateStore";

if (!process.env.INCOMING_TEMP_FOLDER || !fs.existsSync(process.env.INCOMING_TEMP_FOLDER)) {
    throw new Error("Make sure INCOMING_TEMP_FOLDER is defined in the .env file, and that it points to a valid writeable folder");
}

const app = express();

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Range, Authorization");

    if (req.method == "OPTIONS") {
        res.statusCode = 200;
        res.send("");
        return;
    }

    next();
});

app.use(express.json());
app.get("/ping", (req, res) => {
    res.send("PONG");
    res.end();
});

app.post(RecordingsTicketer.Route, RecordingsTicketer.MiddlewareFunc);
app.use(RecordingServer.Route, RecordingServer.MiddlewareFunc);
app.use(FormStateStore.Route, FormStateStore.MiddlewareFunc);
console.log("Serving recording files from S3 Bucket " + process.env.S3_TARGET_BUCKET);

app.use("/", express.static("frontend", {
    fallthrough: false
}));

export default app;