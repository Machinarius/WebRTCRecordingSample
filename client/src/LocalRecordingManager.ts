import axios, { AxiosPromise } from "axios";

export default class LocalRecordingManager {
    private cameraRecorder: MediaRecorder;
    private screenRecorder: MediaRecorder;

    private isRecording: boolean;
    private hasRecordedData: boolean;

    public statusChanged?: (status: string) => void; 
    public recordingComplete?: () => void;

    constructor(cameraStream: MediaStream, screenShareStream: MediaStream, recordingMimeType: string) {
        this.cameraRecorder = new MediaRecorder(cameraStream, {
            mimeType: recordingMimeType
        });
        this.screenRecorder = new MediaRecorder(screenShareStream, {
            mimeType: recordingMimeType
        });

        // These should only fire once as we are not specifying a time slice
        // Possible optimization here?
        this.cameraRecorder.ondataavailable = this.onCameraDataAvailable.bind(this);
        this.screenRecorder.ondataavailable = this.onScreenDataAvailable.bind(this);

        this.isRecording = false;
        this.hasRecordedData = false;
    }

    public beginRecording() {
        if (this.isRecording || this.hasRecordedData) {
            throw new Error("Invalid state - Recording in progress or finished");
        }

        this.cameraRecorder.start();
        this.screenRecorder.start();

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
        this.screenRecorder.stop();

        this.isRecording = false;
        this.hasRecordedData = true;
    }

    private cameraRecordBlob?: Blob;
    private screenRecordBlob?: Blob;

    private onCameraDataAvailable(event: BlobEvent) {
        this.cameraRecordBlob = event.data;
        this.tryToFireCompletion();
    }

    private onScreenDataAvailable(event: BlobEvent) {
        this.screenRecordBlob = event.data;
        this.tryToFireCompletion();
    }

    private tryToFireCompletion() {
        if (!this.cameraRecordBlob || !this.screenRecordBlob) {
            return;
        }

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

        return await this.createVideoElementFromBlob(this.cameraRecordBlob, this.cameraRecorder.mimeType);
    }

    public async getScreenPreviewSource(): Promise<HTMLVideoElement> {
        if (!this.screenRecordBlob) {
            throw new Error("Invalid state - Recording must have finished first");
        }

        return await this.createVideoElementFromBlob(this.screenRecordBlob, this.screenRecorder.mimeType);
    }

    private async createVideoElementFromBlob(recordBlob: Blob, mimeType: string): Promise<HTMLVideoElement> {
        let mediaData = await recordBlob.arrayBuffer();

        let mediaSource = new MediaSource();
        mediaSource.addEventListener("sourceopen", (_event) => {
            let sourceBuffer = mediaSource.addSourceBuffer(mimeType);
            sourceBuffer.addEventListener("updateend", (_sbEvent) => {
                mediaSource.endOfStream();
            });

            sourceBuffer.appendBuffer(mediaData);
        });

        let videoElement = document.createElement("video") as HTMLVideoElement;
        videoElement.src = URL.createObjectURL(mediaSource);
        videoElement.controls = true;
        
        return videoElement;
    }

    public async uploadRecordings(progressCallback: (overallProgress: number) => void): Promise<{
        cameraUrl: string,
        screenUrl: string
    }> {
        if (!this.cameraRecordBlob || !this.screenRecordBlob) {
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

        var cameraProgress = 0;
        var screenProgress = 0;

        function fireProgressCallback(fileName: "camera" | "screen", progressValue: number) {
            switch (fileName) {
                case "camera":
                    cameraProgress = progressValue;
                    break;
                case "screen":
                    screenProgress = progressValue;
                    break;
                default:
                    return;
            }

            progressCallback(cameraProgress * 0.5 + screenProgress * 0.5);
        }

        function uploadRecording(url: string, blob: Blob, fileName: "camera" | "screen"): AxiosPromise<any> {
            return axios(url, {
                method: "PUT",
                data: blob,
                onUploadProgress: (progressEvent) => {
                    // Taken from https://gist.github.com/virolea/e1af9359fe071f24de3da3500ff0f429
                    let percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    fireProgressCallback(fileName, percentCompleted);
                }
            });
        }

        let recordingTicket = recordingTicketResponse.data as UploadTicket;
        let cameraUpload = uploadRecording(recordingTicket.putUrls.camera, this.cameraRecordBlob, "camera");
        let screenUpload = uploadRecording(recordingTicket.putUrls.screen, this.screenRecordBlob, "screen");
        let [cameraResponse, screenResponse] = await Promise.all([cameraUpload, screenUpload]);

        if (cameraResponse.status != 200 || screenResponse.status != 200) {
            throw new Error("Could not upload files to destination urls");
        }

        return {
            cameraUrl: recordingTicket.getUrls.camera,
            screenUrl: recordingTicket.getUrls.screen
        };
    }
}

interface UploadTicket {
    putUrls: {
        camera: string,
        screen: string
    },
    getUrls: {
        camera: string,
        screen: string
    }
}