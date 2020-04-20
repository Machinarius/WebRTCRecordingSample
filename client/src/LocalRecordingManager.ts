import axios from "axios";

export default class LocalRecordingManager {
    private cameraRecorder: MediaRecorder;
    private screenRecorder: MediaRecorder;

    private isRecording: boolean;
    private hasRecordedData: boolean;

    public statusChanged?: (status: string) => void; 
    public recordingComplete?: () => void;

    constructor(cameraStream: MediaStream, screenShareStream: MediaStream) {
        this.cameraRecorder = new MediaRecorder(cameraStream, {
            mimeType: "video/webm"
        });
        this.screenRecorder = new MediaRecorder(screenShareStream, {
            mimeType: "video/webm"
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

        var cameraProgress = 0;
        var screenProgress = 0;

        function updateProgress(uploadName: "camera" | "screen", progress: number) {
            switch (uploadName) {
                case "camera":
                    cameraProgress = progress;
                    break;
                case "screen":
                    screenProgress = progress;
                    break;
                default:
                    return;
            }

            let overallProgress = (cameraProgress * 0.5) + (screenProgress * 0.5);
            progressCallback(overallProgress);
        }

        let cameraUpload = this.uploadBlob(this.cameraRecordBlob, updateProgress.bind(this, "camera"));
        let screenUpload = this.uploadBlob(this.screenRecordBlob, updateProgress.bind(this, "screen"));
        await Promise.all([cameraUpload, screenUpload]);

        let cameraUrl = await cameraUpload;
        let screenUrl = await screenUpload;
        return {
            cameraUrl,
            screenUrl
        };
    }

    private async uploadBlob(blob: Blob, progressCallback: (progress: number) => void): Promise<string> {
        let blobDataUrl = await new Promise<string>(resolve => {
            let blobReader = new FileReader();
            blobReader.addEventListener("load", () => {
                resolve(blobReader.result as string);
            });
            blobReader.readAsDataURL(blob);
        });
        
        // Hardcoded for now
        let response = await axios.post("http://localhost:9000/recordings", {
            dataUrl: blobDataUrl
        }, {
            onUploadProgress: (progressEvent) => {
                // Taken from https://gist.github.com/virolea/e1af9359fe071f24de3da3500ff0f429
                let percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                progressCallback(percentCompleted);
            }
        });

        if (response.status != 200) {
            throw new Error("Could not upload file");
        }

        return response.data.resultUrl as string;
    }
}