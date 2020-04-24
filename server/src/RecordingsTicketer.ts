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

export const Route = "/recordings/ticket";
export let MiddlewareFunc: Handler = async (req: Request, res: Response, next: NextFunction) => {
    let ticketId = uuid.v4();
    let cameraKey = "camera-" + ticketId + ".webm";
    let screenKey = "screen-" + ticketId + ".webm";

    function getSignedUrl(key: string, action: "getObject" | "putObject"): Promise<string> {
        return S3.getSignedUrlPromise(action, {
            Bucket: TARGET_BUCKET,
            Expires: URL_EXPIRATION,
            Key: key
        });
    };

    let response = {
        putUrls: {
            camera: await getSignedUrl(cameraKey, "putObject"),
            screen: await getSignedUrl(screenKey, "putObject")
        },
        getUrls: {
            camera: await getSignedUrl(cameraKey, "getObject"),
            screen: await getSignedUrl(screenKey, "getObject")
        }
    };

    res.status(200).contentType("application/json").send(response);
}