import LocalRecordingManager from "./LocalRecordingManager";

if (document.readyState === "complete") {
    initSample();
} else {
    document.addEventListener('DOMContentLoaded', (event) => {
        initSample();
    });
}

var recordingManager: LocalRecordingManager;

var sessionIdOutput: HTMLElement;
var requestCameraButton: HTMLInputElement;
var requestScreenButton: HTMLInputElement;
var startRecordingButton: HTMLInputElement;
var stopRecordingButton: HTMLInputElement;

var screenOutputElement: HTMLVideoElement;
var cameraOutputElement: HTMLVideoElement;

var browserSupportCheck: HTMLInputElement;
var recordingStatusLabel: HTMLElement;

var outputContainer: HTMLElement;

var beginUploadButton: HTMLButtonElement;
var progressContainer: HTMLElement;
var uploadProgress: HTMLProgressElement;
var uploadStatusLabel: HTMLElement;
var urlsContainer: HTMLElement;

var cameraUrlAnchor: HTMLAnchorElement;
var screenUrlAnchor: HTMLAnchorElement;

function initSample() {
    sessionIdOutput = document.getElementById("sessionid-output") as HTMLElement;
    requestCameraButton = document.getElementById("request-camera") as HTMLInputElement;
    requestScreenButton = document.getElementById("request-screenshare") as HTMLInputElement;
    startRecordingButton = document.getElementById("start-recording") as HTMLInputElement;
    stopRecordingButton = document.getElementById("stop-recording") as HTMLInputElement;

    cameraOutputElement = document.getElementById("camera-output") as HTMLVideoElement;
    screenOutputElement = document.getElementById("screen-output") as HTMLVideoElement;

    browserSupportCheck = document.getElementById("browser-support") as HTMLInputElement;
    recordingStatusLabel = document.getElementById("recording-status") as HTMLElement;

    outputContainer = document.getElementById("output-container") as HTMLElement;

    beginUploadButton = document.getElementById("begin-upload") as HTMLButtonElement;
    progressContainer = document.getElementById("progress-container") as HTMLElement;
    uploadProgress = document.getElementById("upload-progress") as HTMLProgressElement;
    uploadStatusLabel = document.getElementById("upload-status") as HTMLElement;
    urlsContainer = document.getElementById("urls-container") as HTMLElement;

    cameraUrlAnchor = document.getElementById("camera-url") as HTMLAnchorElement;
    screenUrlAnchor = document.getElementById("screen-url") as HTMLAnchorElement;

    if (!hasGetUserMedia()) {
        browserSupportCheck.checked = false;
        return;
    }

    browserSupportCheck.checked = true;

    requestCameraButton.onclick = requestCameraStream;
    requestScreenButton.onclick = requestScreenshare;
    startRecordingButton.onclick = startRecording;
    stopRecordingButton.onclick = stopRecording;
    beginUploadButton.onclick = beginUpload;
}

var supportedWebMRecordingMIMEType: string | undefined;
const knownWebMMIMETypes = [
    'video/webm', // Implicit codec selection. Firefox likes this input
    'video/webm\;codecs=vp9', 
    'video/webm\;codecs=vp8', 
    'video/webm\;codecs="vp9, vorbis"', 
    'video/webm\;codecs="vp8, vorbis"', 
    'video/webm\;codecs="vp9, opus"', 
    'video/webm\;codecs="vp8, opus"', 
    'video/webm\;codecs=daala', 
    'video/webm\;codecs=h264', 
    'audio/webm\;codecs=opus', 
    'video/mpeg'
];

function hasGetUserMedia(): boolean {
    let captureApisSupported = !!(navigator.mediaDevices.getUserMedia && (navigator.mediaDevices as any).getDisplayMedia);
    let recordingApisSupported = !!(MediaRecorder) && !!(
        supportedWebMRecordingMIMEType = knownWebMMIMETypes.find(mimeType => MediaRecorder.isTypeSupported(mimeType) && MediaSource.isTypeSupported(mimeType))
    );

    let compatIssuesContainer = document.getElementById("compatibility-issues")!;
    if (!captureApisSupported) {
        let messageElement = document.createElement("p");
        messageElement.innerText = "Your browser does not seem to support the capture APIs required";
        compatIssuesContainer.appendChild(messageElement);
    }

    if (!recordingApisSupported) {
        let messageElement = document.createElement("p");
        messageElement.innerText = "Your browser does not seem to support the video recording APIs required";
        compatIssuesContainer.appendChild(messageElement);
    }

    console.log("Chosen recording codec: " + supportedWebMRecordingMIMEType);
    return captureApisSupported && recordingApisSupported;
}

var cameraStream: MediaStream;
var screenShareStream: MediaStream;

async function requestCameraStream() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(function(track) {
            track.stop();
        });
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    });
    cameraOutputElement.srcObject = cameraStream;

    enableRecordingButton();
}

async function requestScreenshare() {
    if (screenShareStream) {
        screenShareStream.getTracks().forEach(function(track) {
            track.stop();
        });
    }

    screenShareStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: {
            cursor: "always"
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true
        }
    });
    screenOutputElement.srcObject = screenShareStream;

    enableRecordingButton();
}

function enableRecordingButton() {
    if (!cameraStream || !screenShareStream) {
        return;
    }

    startRecordingButton.disabled = false;
    recordingStatusLabel.innerText = "Idle";
}

function startRecording() {
    recordingManager = new LocalRecordingManager(cameraStream, screenShareStream, supportedWebMRecordingMIMEType!);
    recordingManager.recordingComplete = onRecordingCompleted;
    recordingManager.statusChanged = onRecordingStatusChanged;
    recordingManager.beginRecording();

    startRecordingButton.disabled = true;
    stopRecordingButton.disabled = false;
    clearOutputContainer();
}

async function stopRecording() {
    recordingManager.stopRecording();
    
    startRecordingButton.disabled = false;
    stopRecordingButton.disabled = true;
}

async function onRecordingCompleted() {
    let cameraElement = await recordingManager.getCameraPreviewElement();
    let screenElement = await recordingManager.getScreenPreviewSource();

    outputContainer.appendChild(cameraElement);
    outputContainer.appendChild(screenElement);

    let syncPlaybackElement = document.createElement("button") as HTMLInputElement;
    syncPlaybackElement.innerText = "Play simultaneously";
    syncPlaybackElement.onclick = () => {
        cameraElement.pause();
        screenElement.pause();

        cameraElement.currentTime = 0;
        screenElement.currentTime = 0;

        cameraElement.play();
        screenElement.play();
    };
    outputContainer.appendChild(syncPlaybackElement);

    beginUploadButton.disabled = false;
}

function onRecordingStatusChanged(status: string) {
    recordingStatusLabel.innerText = status;
}

function clearOutputContainer() {
    outputContainer.innerHTML = "";
}

async function beginUpload() {
    progressContainer.style.display = "block";

    beginUploadButton.disabled = true;
    uploadProgress.value = 0;
    uploadStatusLabel.innerText = "Uploading data...";

    var uploadResult: {
        cameraUrl: string,
        screenUrl: string
    };

    try {
        uploadResult = await recordingManager.uploadRecordings((progress) => uploadProgress.value = progress);
    } catch (error) {
        uploadProgress.value = 0;
        uploadStatusLabel.innerText = "Upload failed - Try again please";
        beginUploadButton.disabled = false;

        console.error(error);
        return;
    }

    uploadStatusLabel.innerText = "Upload complete";
    urlsContainer.style.display = "block";

    cameraUrlAnchor.innerText = uploadResult.cameraUrl;
    cameraUrlAnchor.href = uploadResult.cameraUrl;

    screenUrlAnchor.innerText = uploadResult.screenUrl;
    screenUrlAnchor.href = uploadResult.screenUrl;
}