const TARGET_BUCKET = process.env.S3_TARGET_BUCKET;
if (!TARGET_BUCKET) {
    throw new Error("Make sure S3_TARGET_BUCKET is defined in the .env file, and that it points to a valid writeable folder");
}

const BUCKET_REGION = process.env.S3_BUCKET_REGION;
if (!BUCKET_REGION) {
    throw new Error("Make sure S3_BUCKET_REGION is defined in the .env file, and that it is the region the target bucket is in");
}

import AWS from "aws-sdk";
const S3 = new AWS.S3({
    signatureVersion: "v4",
    region: BUCKET_REGION
});

import * as Express from "express";
import { PromiseResult } from "aws-sdk/lib/request";

export const Route = "/formstate/:id";
export let MiddlewareFunc: Express.Handler = async function(req: Express.Request, res: Express.Response, _next: Express.NextFunction) {
    if (req.method != "POST" && req.method != "GET") {
        res.status(405);
        res.send();

        return;
    }

    let formId = req.params["id"];
    if (!formId) {
        res.status(400);
        res.send();

        return;
    }

    if (req.method == "POST") {
        let stateObject = req.body;
        let statePayload = JSON.stringify(stateObject);
        
        let putResult = await S3.putObject({
            Key: "formstates/" + formId + ".json",
            Bucket: TARGET_BUCKET,
            Body: statePayload
        }).promise();

        if (putResult.$response.error) {
            console.error("Error trying to put the form state into S3", putResult.$response.error);
            res.status(500).send();

            return;
        }

        res.status(201);
        res.send();

        return;
    }

    if (req.method == "GET") {
        let getResult: PromiseResult<AWS.S3.GetObjectOutput, AWS.AWSError>;
        
        try {
            getResult = await S3.getObject({
                Bucket: TARGET_BUCKET,
                Key: "formstates/" + formId + ".json"
            }).promise();

            
            if (getResult.$response.error) {
                throw getResult.$response.error;
            }
        } catch (error) {
            if (error.code == "NoSuchKey") {
                res.status(404).send();
                return;
            }

            console.error("Error trying to get the form state from S3", error);
            res.status(500).send();

            return;
        }
        
        let stateObject = JSON.parse(getResult.Body.toString());
        res.status(200);
        res.json(stateObject);

        return;
    }
}