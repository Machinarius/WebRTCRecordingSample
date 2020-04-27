import axios, { AxiosPromise } from "axios";

export default class LocalRecordingManager {
    private cameraRecorder: MediaRecorder;

    private isRecording: boolean;
    private hasRecordedData: boolean;

    public statusChanged?: (status: string) => void; 
    public recordingComplete?: () => void;

    constructor(cameraStream: MediaStream, recordingMimeType: string) {
        this.cameraRecorder = new MediaRecorder(cameraStream, {
            mimeType: recordingMimeType
        });

        // These should only fire once as we are not specifying a time slice
        // Possible optimization here?
        this.cameraRecorder.ondataavailable = this.onCameraDataAvailable.bind(this);

        this.isRecording = false;
        this.hasRecordedData = false;
    }

    public beginRecording() {
        if (this.isRecording || this.hasRecordedData) {
            throw new Error("Invalid state - Recording in progress or finished");
        }

        this.cameraRecorder.start();
        this.isRecording = true;

        if (this.statusChanged) {
            this.statusChanged("Started");
        }
    }

    public stopRecording() {
        if (this.statusChanged) {
            this.statusChanged("Stopping...");
        }

        // Do NOT call requestData here - MediaRecorder#stop implies it

        this.cameraRecorder.stop();
        this.isRecording = false;
        this.hasRecordedData = true;
    }

    private cameraRecordBlob?: Blob;

    private onCameraDataAvailable(event: BlobEvent) {
        this.cameraRecordBlob = event.data;

        if (this.statusChanged) {
            this.statusChanged("Recording completed");
        }

        if (this.recordingComplete) {
            this.recordingComplete();
        }
    }
    
    public async getCameraPreviewElement(): Promise<HTMLVideoElement> {
        if (!this.cameraRecordBlob) {
            throw new Error("Invalid state - Recording must have finished first");
        }

        let mediaData = await this.cameraRecordBlob.arrayBuffer();

        let mediaSource = new MediaSource();
        let videoElement = document.createElement("video") as HTMLVideoElement;
        videoElement.src = URL.createObjectURL(mediaSource);
        videoElement.controls = true;

        mediaSource.addEventListener("sourceopen", (_event) => {
            let sourceBuffer = mediaSource.addSourceBuffer(this.cameraRecorder.mimeType);
            sourceBuffer.addEventListener("updateend", (_sbEvent) => {
                mediaSource.endOfStream();
            });

            sourceBuffer.appendBuffer(mediaData);
        });
        
        return videoElement;
    }

    public async uploadRecording(progressCallback: (overallProgress: number) => void): Promise<string> {
        if (!this.cameraRecordBlob) {
            throw new Error("Invalid state - Recording must have finished first");
        }

        let appBase = window.location.pathname;
        if (appBase.endsWith("/")) {
            appBase = appBase.substr(0, appBase.length - 1);
        }

        let recordingTicketResponse = await axios(appBase + "/recordings/ticket", {
            method: "GET"
        });

        if (recordingTicketResponse.status != 200) {
            throw new Error("Could not create an upload ticket");
        }

        let recordingTicket = recordingTicketResponse.data as UploadTicket;
        let cameraResponse = await axios(recordingTicket.putUrl, {
            method: "PUT",
            data: this.cameraRecordBlob,
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