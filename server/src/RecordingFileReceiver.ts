import { Response, NextFunction } from "express";
import { UploadedFile } from "express-fileupload";
import * as uuid from "uuid";
import path from "path";

export default function RecordingReceiver(destinationPath: string) {
    return async function(req: any, res: Response, next: NextFunction) {
        if (!req.files || !req.files.camera || !req.files.screen) {
            next();
            return;
        }

        let cameraFile = req.files.camera as UploadedFile;
        let screenFile = req.files.screen as UploadedFile;

        let recordingId = uuid.v4();
        let cameraFilename = recordingId + "-camera" + ".webm";
        let screenFilename = recordingId + "-screen" + ".webm";

        await cameraFile.mv(path.join(destinationPath, cameraFilename));
        await screenFile.mv(path.join(destinationPath, screenFilename));

        res.statusCode = 200;
        res.type("application/json");
        res.send({
            cameraUrl: `${req.protocol}://${req.hostname}/recordings/${cameraFilename}`,
            screenUrl: `${req.protocol}://${req.hostname}/recordings/${screenFilename}`
        });
    }
}