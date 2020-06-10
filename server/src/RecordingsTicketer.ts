const TARGET_BUCKET = process.env.S3_TARGET_BUCKET;
if (!TARGET_BUCKET) {
    throw new Error("Make sure S3_TARGET_BUCKET is defined in the .env file, and that it points to a valid writeable folder");
}

const BUCKET_REGION = process.env.S3_BUCKET_REGION;
if (!BUCKET_REGION) {
    throw new Error("Make sure S3_BUCKET_REGION is defined in the .env file, and that it is the region the target bucket is in");
}

import * as uuid from "uuid";
import { Request , Response, NextFunction, Handler } from "express";

import AWS from "aws-sdk";
const S3 = new AWS.S3({
    signatureVersion: "v4",
    region: BUCKET_REGION
});

const URL_EXPIRATION = parseInt(process.env.S3_URL_EXPIRATION_SECONDS || "300");

const CONTENT_TYPE_MAP = {
    "video/x-matroska": "mkv",
    "video/webm": "webm"
}

export const Route = "/recordings/ticket";
export let MiddlewareFunc: Handler = async (req: Request, res: Response, next: NextFunction) => {
    if (req.method != "POST") {
        res.status(405).send("Method not allowed");
        return;
    }

    let targetContentType = req.body.targetContentType;
    if (!targetContentType || typeof targetContentType !== "string") {
        res.status(400).send("Missing Content Type");
        return;
    }

    let mimeTypeValue = targetContentType.split(";")[0];
    let extension = CONTENT_TYPE_MAP[mimeTypeValue];
    if (!extension) {
        res.status(400).send("Invalid content type");
        return;
    }

    let ticketId = uuid.v4();
    let cameraKey = "camera-" + ticketId + "." + extension;
    let [cameraGet, cameraPut] = await Promise.all([
        S3.getSignedUrlPromise("getObject", {
            Bucket: TARGET_BUCKET,
            Key: cameraKey
        }),
        S3.getSignedUrlPromise("putObject", {
            Bucket: TARGET_BUCKET,
            Expires: URL_EXPIRATION,
            Key: cameraKey
        })
    ]);

    let response = {
        putUrl: cameraPut,
        getUrl: cameraGet
    };

    res.status(200).contentType("application/json").send(response);
}