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

    if (!hasGetUserMedia()) {
        browserSupportCheck.checked = false;
        return;
    }

    browserSupportCheck.checked = true;

    requestCameraButton.onclick = requestCameraStream;
    requestScreenButton.onclick = requestScreenshare;
    startRecordingButton.onclick = startRecording;
    stopRecordingButton.onclick = stopRecording;
}

function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
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

    screenShareStream = await navigator.mediaDevices.getUserMedia({
        video: {
            mediaSource: 'screen'
        }
    } as any);
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
    recordingManager = new LocalRecordingManager(cameraStream, screenShareStream);
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
}

function onRecordingStatusChanged(status: string) {
    recordingStatusLabel.innerText = status;
}

function clearOutputContainer() {
    outputContainer.innerHTML = "";
}