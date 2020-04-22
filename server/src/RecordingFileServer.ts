const TARGET_BUCKET = process.env.S3_TARGET_BUCKET;
if (!TARGET_BUCKET) {
    throw new Error("Make sure S3_TARGET_BUCKET is defined in the .env file, and that it points to a valid writeable folder");
}

const BUCKET_REGION = process.env.S3_BUCKET_REGION;
if (!BUCKET_REGION) {
    throw new Error("Make sure S3_BUCKET_REGION is defined in the .env file, and that it is the region the target bucket is in");
}

import { Request , Response, NextFunction, request } from "express";

import AWS from "aws-sdk";
const S3 = new AWS.S3({
    signatureVersion: "v4",
    region: BUCKET_REGION
});

const URL_EXPIRATION = parseInt(process.env.S3_URL_EXPIRATION_SECONDS || "300");

export const Route = "/recordings/:filename";
export async function MiddlewareFunc(req: Request, res: Response, next: NextFunction) {
    if (!req.params.filename) {
        res.status(404).send("Not found");
        return;
    }

    let filename = req.params.filename;
    let signedUrl = await S3.getSignedUrlPromise("getObject", {
        Bucket: TARGET_BUCKET,
        Expires: URL_EXPIRATION,
        Key: filename
    });

    res.redirect(signedUrl);
}