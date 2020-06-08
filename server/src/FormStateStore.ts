const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) {
    throw new Error("Please ensure that the MONGO_URL env var is defined");
}

const MONGO_DB = process.env.MONGO_DB;
if (!MONGO_DB) {
    throw new Error("Please ensure that the MONGO_DB env var is defined");
}

const FORM_STATE_COLLECTION = "formstates";

import * as Express from "express";
import { MongoClient } from "mongodb";

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

    let mongoClient = new MongoClient(MONGO_URL, { useUnifiedTopology: true });
    await mongoClient.connect();

    let mongoDb = mongoClient.db(MONGO_DB);
    let stateCollection = mongoDb.collection(FORM_STATE_COLLECTION);

    if (req.method == "POST") {
        let stateObject = req.body;
        let stateDocument = {
            id: formId,
            state: stateObject
        };

        await stateCollection.insertOne(stateDocument);
        res.status(201);
        res.send();

        return;
    }

    if (req.method == "GET") {
        let stateDocument = await stateCollection.findOne({ id: formId });
        if (!stateDocument) {
            res.status(404);
            res.send();

            return;
        }

        let stateObject = stateDocument.state;
        res.status(200);
        res.json(stateObject);

        return;
    }
}