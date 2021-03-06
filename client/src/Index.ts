import SignallingChannel from "./SignallingChannel";
import RTCConnectionHandler from "./RTCConnectionHandler";

if (document.readyState === "complete") {
    initSample();
} else {
    document.addEventListener('DOMContentLoaded', (event) => {
        initSample();
    });
}

var sessionIdOutput: HTMLElement;
var createCommsButton: HTMLInputElement;
var requestCameraButton: HTMLInputElement;
var requestScreenButton: HTMLInputElement;
var createConnectionButton: HTMLInputElement;
var startRercordingButton: HTMLInputElement;
var stopRecordingButton: HTMLInputElement;

var screenOutputElement: HTMLVideoElement;
var cameraOutputElement: HTMLVideoElement;

var browserSupportCheck: HTMLInputElement;
var recordingStatusLabel: HTMLElement;

var outputContainer: HTMLElement;

function initSample() {
    sessionIdOutput = document.getElementById("sessionid-output") as HTMLElement;
    createCommsButton = document.getElementById("create-comms") as HTMLInputElement;
    requestCameraButton = document.getElementById("request-camera") as HTMLInputElement;
    requestScreenButton = document.getElementById("request-screenshare") as HTMLInputElement;
    createConnectionButton = document.getElementById("create-connection") as HTMLInputElement;
    startRercordingButton = document.getElementById("start-recording") as HTMLInputElement;
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
    createCommsButton.disabled = false;

    createCommsButton.onclick = createCommsChannel;
    requestCameraButton.onclick = requestCameraStream;
    requestScreenButton.onclick = requestScreenshare;
    createConnectionButton.onclick = createRTCConnection;
    startRercordingButton.onclick = startRecording;
    stopRecordingButton.onclick = stopRecording;
}

function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

var signallingChannel: SignallingChannel;
async function createCommsChannel() {
    signallingChannel = new SignallingChannel();
    signallingChannel.onRemoteStartedRecording = handleRemoteStartedRecording;
    signallingChannel.onRemoteStoppedRecording = handleRemoteStoppedRecording;

    let sessionId = await signallingChannel.waitUntilSessionIsReady();
    sessionIdOutput.innerText = "Session created with Id: " + sessionId;

    requestCameraButton.checked = true;
    requestScreenButton.checked = true;
    createConnectionButton.checked = true;
    requestCameraButton.disabled = false;
    requestScreenButton.disabled = false;
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

    enableConnectionButton();
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

    enableConnectionButton();
}

function enableConnectionButton() {
    if (!cameraStream || !screenShareStream) {
        return;
    }

    createConnectionButton.disabled = false;
}

let connectionHandler: RTCConnectionHandler;
async function createRTCConnection() {
    connectionHandler = new RTCConnectionHandler(signallingChannel);
    connectionHandler.onRemoteReadyToRecord = handleRemoteReadyToRecord;
    connectionHandler.setStreams(cameraStream, screenShareStream);

    createConnectionButton.disabled = true;
    createConnectionButton.innerText = "Connection created";
}

function handleRemoteReadyToRecord() {
    startRercordingButton.disabled = false;
    recordingStatusLabel.innerText = "Ready to Record";
}

function startRecording() {
    startRercordingButton.disabled = true;
    signallingChannel.sendRecordingStartRequest();

    clearOutputContainer();
}

function stopRecording() {
    stopRecordingButton.disabled = true;
    signallingChannel.sendRecordingStopRequest();
}

function handleRemoteStartedRecording(sessionId: string) {
    recordingStatusLabel.innerText = `Recording in Progress for session with id ${sessionId}...`;
    startRercordingButton.disabled = true;
    stopRecordingButton.disabled = false;
}

function handleRemoteStoppedRecording(sessionId: string, cameraFiles: string[], screenFiles: string[]) {
    recordingStatusLabel.innerText = `Recording stopped for session with id ${sessionId}`;
    startRercordingButton.disabled = false;
    stopRecordingButton.disabled = true;

    clearOutputContainer();

    let outputHeader = document.createElement("p");
    outputHeader.innerText = "9. Preview recordings";
    outputContainer.appendChild(outputHeader);

    let cameraHeader = document.createElement("p");
    cameraHeader.innerText = "Camera recording";
    outputContainer.appendChild(cameraHeader);

    cameraFiles.forEach(addFileToOutput);

    let screenHeader = document.createElement("p");
    screenHeader.innerText = "Screen recording";
    outputContainer.appendChild(screenHeader);

    screenFiles.forEach(addFileToOutput);
}

function addFileToOutput(filePath: string) {
    let fileLocation = filePath;
    if (filePath.startsWith(".")) {
        fileLocation = filePath.substr(1); // Remove dot from path
    }

    if (fileLocation.startsWith("/")) {
        fileLocation = fileLocation.substr(1); // Remove starting slash
    }

    let fileUrl = "http://localhost:9000/" + fileLocation;
    let videoElement = document.createElement("video") as HTMLVideoElement;
    videoElement.controls = true;
    videoElement.src = fileUrl;
    outputContainer.appendChild(videoElement);
}

function clearOutputContainer() {
    outputContainer.innerHTML = "";
}