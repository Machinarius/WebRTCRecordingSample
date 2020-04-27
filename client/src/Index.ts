import "video.js/dist/video-js.min.css";
import 'videojs-record/dist/css/videojs.record.css';

import 'webrtc-adapter';
import videojs, { VideoJsPlayer, VideoJsPlayerOptions } from "video.js";
import 'recordrtc';
import 'videojs-record';

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
var startRecordingButton: HTMLInputElement;
var stopRecordingButton: HTMLInputElement;

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
function initSample() {
    sessionIdOutput = document.getElementById("sessionid-output") as HTMLElement;
    requestCameraButton = document.getElementById("request-camera") as HTMLInputElement;
    startRecordingButton = document.getElementById("start-recording") as HTMLInputElement;
    stopRecordingButton = document.getElementById("stop-recording") as HTMLInputElement;

    cameraOutputElement = document.getElementById("camera-output") as HTMLVideoElement;

    browserSupportCheck = document.getElementById("browser-support") as HTMLInputElement;
    recordingStatusLabel = document.getElementById("recording-status") as HTMLElement;

    outputContainer = document.getElementById("output-container") as HTMLElement;

    beginUploadButton = document.getElementById("begin-upload") as HTMLButtonElement;
    progressContainer = document.getElementById("progress-container") as HTMLElement;
    uploadProgress = document.getElementById("upload-progress") as HTMLProgressElement;
    uploadStatusLabel = document.getElementById("upload-status") as HTMLElement;
    urlsContainer = document.getElementById("urls-container") as HTMLElement;

    cameraUrlAnchor = document.getElementById("camera-url") as HTMLAnchorElement;

    if (!hasGetUserMedia()) {
        browserSupportCheck.checked = false;
        return;
    }

    browserSupportCheck.checked = true;

    requestCameraButton.onclick = requestCameraStream;
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
    let captureApisSupported = !!(navigator.mediaDevices.getUserMedia);
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
var cameraPlayer: VideoJsPlayer;

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
    cameraPlayer = await new Promise<VideoJsPlayer>((resolve, reject) => {
        let options: VideoJsPlayerOptions = {
            controls: true,
            autoplay: false,
            fluid: false,
            loop: false,
            width: 320,
            height: 240,
            src: cameraStream as any,
            plugins: {
                // configure videojs-record plugin
                record: {
                    audio: true,
                    video: true,
                    debug: true
                }
            }
        };

        var player: VideoJsPlayer;
        try {
            player = videojs("camera-output", options, () => {
                resolve(player);
            });
        } catch (error) {
            reject(error);
        }
    });

    cameraPlayer.src(cameraStream as any);

    startRecordingButton.disabled = false;
    recordingStatusLabel.innerText = "Idle";
}

function startRecording() {
    recordingManager = new LocalRecordingManager(cameraStream, supportedWebMRecordingMIMEType!);
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
    outputContainer.appendChild(cameraElement);

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

    var cameraDownloadUrl: string;

    try {
        cameraDownloadUrl = await recordingManager.uploadRecording((progress) => uploadProgress.value = progress);
    } catch (error) {
        uploadProgress.value = 0;
        uploadStatusLabel.innerText = "Upload failed - Try again please";
        beginUploadButton.disabled = false;

        console.error(error);
        return;
    }

    uploadStatusLabel.innerText = "Upload complete";
    urlsContainer.style.display = "block";

    cameraUrlAnchor.innerText = cameraDownloadUrl;
    cameraUrlAnchor.href = cameraDownloadUrl;
}