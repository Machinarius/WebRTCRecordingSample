import { Request, Response, NextFunction } from "express";
import { UploadedFile } from "express-fileupload";
import * as uuid from "uuid";
import path from "path";
import fs from "fs";

import AWS from "aws-sdk";
const S3 = new AWS.S3();

const TARGET_BUCKET = process.env.S3_TARGET_BUCKET;
if (!TARGET_BUCKET) {
    throw new Error("Make sure S3_TARGET_BUCKET is defined in the .env file, and that it is the name of a writeable S3 bucket");
}

export default function RecordingReceiver(tempIncomingPath: string) {
    function uploadFileToS3(filename: string, pathToLocalFile: string): Promise<object> {
        let localFileStream = fs.createReadStream(pathToLocalFile);
        return S3.upload({
            Bucket: TARGET_BUCKET,
            Key: filename,
            Body: localFileStream
        }).promise();
    }

    return async function(req: Request, res: Response, next: NextFunction) {
        if (!req.files || !req.files.camera || !req.files.screen) {
            next();
            return;
        }

        let cameraFile = req.files.camera as UploadedFile;
        let screenFile = req.files.screen as UploadedFile;

        let recordingId = uuid.v4();
        let cameraFilename = recordingId + "-camera.webm";
        let screenFilename = recordingId + "-screen.webm";

        let cameraPath = path.join(tempIncomingPath, cameraFilename);
        let screenPath = path.join(tempIncomingPath, screenFilename);

        await cameraFile.mv(cameraPath);
        await screenFile.mv(screenPath);

        try {
            let cameraPromise = uploadFileToS3(cameraFilename, cameraPath);
            let screenPromise = uploadFileToS3(screenFilename, screenPath);
            await Promise.all([cameraPromise, screenPromise]);
        } catch (error) {
            console.error("Could not upload files to S3", error);

            res.status(500).send("Could not upload files to S3 :(");
            return;
        } finally {
            fs.unlinkSync(cameraPath);
            fs.unlinkSync(screenPath);
        }

        res.statusCode = 200;
        res.type("application/json");
        res.send({
            cameraUrl: `${req.protocol}://${req.hostname}/recordings/${cameraFilename}`,
            screenUrl: `${req.protocol}://${req.hostname}/recordings/${screenFilename}`
        });
    }
}