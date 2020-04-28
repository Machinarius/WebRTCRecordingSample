import axios from "axios";

export default class BlobUploader {
    public static async uploadBlobToBackend(blob: Blob, progressCallback: (overallProgress: number) => void): Promise<string> {
        if (!blob && (blob as any instanceof Blob) || !blob.type) {
            throw new Error("blob parameter must be a Blob object with a valid content type");
        }

        let appBase = window.location.pathname;
        if (appBase.endsWith("/")) {
            appBase = appBase.substr(0, appBase.length - 1);
        }

        let recordingTicketResponse = await axios(appBase + "/recordings/ticket", {
            method: "POST",
            data: {
                targetContentType: blob.type
            }
        });

        if (recordingTicketResponse.status != 200) {
            throw new Error("Could not create an upload ticket: " + recordingTicketResponse.data);
        }

        let recordingTicket = recordingTicketResponse.data as UploadTicket;
        let cameraResponse = await axios(recordingTicket.putUrl, {
            method: "PUT",
            data: blob,
            onUploadProgress: (progressEvent) => {
                // Taken from https://gist.github.com/virolea/e1af9359fe071f24de3da3500ff0f429
                let percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                progressCallback(percentCompleted);
            }
        });

        if (cameraResponse.status != 200) {
            throw new Error("Could not upload file to destination url");
        }

        return recordingTicket.getUrl;
    }
}

interface UploadTicket {
    putUrl: string,
    getUrl: string
}