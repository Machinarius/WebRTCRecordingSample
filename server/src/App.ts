import express from "express";
import path from "path";

import fileUpload from "express-fileupload";
import RecordingReceiver from "./RecordingFileReceiver";

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

app.use(fileUpload() as any);

app.get("/ping", (req, res) => {
    res.send("PONG");
    res.end();
});

app.get("/", (req, res) => {
    res.send("PONG");
    res.end();
});

let recordingsPath = path.resolve("./recordings");
app.post("/recordings", RecordingReceiver(recordingsPath));
console.log("Storing incoming recording files into " + recordingsPath);

app.use("/recordings", express.static(recordingsPath, {
    fallthrough: true,
    index: false
}));
console.log("Serving recording files from " + recordingsPath);

var port = process.env.HTTP_PORT || 9000;
console.log("Web App listening on port " + port);
app.listen(port);