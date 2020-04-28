import "video.js/dist/video-js.min.css";
import 'videojs-record/dist/css/videojs.record.css';

import 'webrtc-adapter';
import videojs, { VideoJsPlayer, VideoJsPlayerOptions } from "video.js";
import 'recordrtc';
import 'videojs-record';

import BlobUploader from "./BlobUploader";

if (document.readyState === "complete") {
    initSample();
} else {
    document.addEventListener('DOMContentLoaded', (event) => {
        initSample();
    });
}

var browserSupportCheck: HTMLInputElement;
var recordingStatusLabel: HTMLElement;

var inputDevicesContainer: HTMLElement;
var audioInputSelect: HTMLSelectElement;
var videoInputSelect: HTMLSelectElement;

var beginUploadButton: HTMLButtonElement;
var progressContainer: HTMLElement;
var uploadProgress: HTMLProgressElement;
var uploadStatusLabel: HTMLElement;
var urlsContainer: HTMLElement;

var cameraUrlAnchor: HTMLAnchorElement;

function initSample() {
    browserSupportCheck = document.getElementById("browser-support") as HTMLInputElement;
    recordingStatusLabel = document.getElementById("recording-status") as HTMLElement;
    
    inputDevicesContainer = document.getElementById("input-devices-container") as HTMLElement;
    videoInputSelect = document.getElementById("video-input-select") as HTMLSelectElement;
    audioInputSelect = document.getElementById("audio-input-select") as HTMLSelectElement;

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
    beginUploadButton.onclick = beginUpload;
    initializePlayer();
}

function hasGetUserMedia(): boolean {
    let captureApisSupported = !!(navigator.mediaDevices.getUserMedia);
    let recordingApisSupported = !!(MediaRecorder) && !!(MediaSource);

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

    return captureApisSupported && recordingApisSupported;
}

var cameraPlayer: VideoJsPlayer;

async function initializePlayer() {
    cameraPlayer = await new Promise<VideoJsPlayer>((resolve, reject) => {
        let options: VideoJsPlayerOptions = {
            controls: true,
            autoplay: false,
            fluid: false,
            loop: false,
            width: 320,
            height: 240,
            plugins: {
                // configure videojs-record plugin
                record: {
                    audio: true,
                    video: true,
                    maxLength: 60,
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

    cameraPlayer.on("finishRecord", onRecordingFinished);
    cameraPlayer.on("startRecord", onRecordingStarted);
    cameraPlayer.on("deviceReady", onDeviceReady);
    cameraPlayer.on("deviceError", onDeviceError);
    cameraPlayer.on("enumerateReady", onDevicesEnumerated);

    recordingStatusLabel.innerText = "Click on the camera icon above to get started";
}

function onDeviceError() {
    recordingStatusLabel.innerText = "Error: Could not get access to input devices";

    console.log('device error:', (cameraPlayer as any).deviceErrorCode);
}

function onDeviceReady() {
    if (!devicesEnumerated) {
        recordingStatusLabel.innerText = "Enumerating input devices";
        (cameraPlayer as any).record().enumerateDevices();

        return;
    }

    recordingStatusLabel.innerText = "Ready to record.";
}

var devicesEnumerated = false;
function onDevicesEnumerated() {
    if (devicesEnumerated) {
        return;
    }

    let mediaDevices = (cameraPlayer as any).record().devices as MediaDeviceInfo[];
    let audioInputs = mediaDevices.filter(deviceDesc => deviceDesc.kind == "audioinput");
    let videoInputs = mediaDevices.filter(deviceDesc => deviceDesc.kind == "videoinput");

    if (audioInputs.length == 0 || videoInputs.length == 0) {
        // TODO: Properly handle these scenarios?
        recordingStatusLabel.innerText = "Could not get access to input devices but Recording may still work?";
        return;
    }

    if (audioInputs.length == 1 && videoInputs.length == 1) {
        recordingStatusLabel.innerText = "Ready to record.";
        return;
    }

    function createOption(deviceDesc: MediaDeviceInfo): HTMLOptionElement {
        let option = document.createElement("option") as HTMLOptionElement;
        option.value = deviceDesc.deviceId;
        option.text = deviceDesc.label;

        return option;
    }

    audioInputs.map(createOption).forEach(audioInputSelect.appendChild.bind(audioInputSelect));
    videoInputs.map(createOption).forEach(videoInputSelect.appendChild.bind(videoInputSelect));

    audioInputSelect.addEventListener("change", onAudioInputChanged);
    videoInputSelect.addEventListener("change", onVideoInputChanged);

    inputDevicesContainer.style.display = "block";
    recordingStatusLabel.innerText = "Ready to record.";
    devicesEnumerated = true;
}

function onAudioInputChanged(selectEvent: Event) {
    let selectedOption = audioInputSelect.options[audioInputSelect.selectedIndex];
    
    try {
        (cameraPlayer as any).record().setAudioInput(selectedOption.value);
        console.log("Changed audio input device to " + selectedOption.label);
        
        recordingStatusLabel.innerText = "Reconfiguring input devices...";
    } catch (error) {
        console.error("Could not change audio input device. Reverting to the default (index 0)", error);
        audioInputSelect.selectedIndex = 0;
    }
}

function onVideoInputChanged(selectEvent: Event) {
    let selectedOption = videoInputSelect.options[videoInputSelect.selectedIndex];
    
    try {
        (cameraPlayer as any).record().setVideoInput(selectedOption.value);
        console.log("Changed video input device to " + selectedOption.label);
        
        recordingStatusLabel.innerText = "Reconfiguring input devices...";
    } catch (error) {
        console.error("Could not change video input device. Reverting to the default (index 0)", error);
        videoInputSelect.selectedIndex = 0;
    }
}

function onRecordingStarted() {
    recordingStatusLabel.innerText = "Recording...";

    audioInputSelect.disabled = true;
    videoInputSelect.disabled = true;
}

var recordBlob: Blob;
function onRecordingFinished() {
    recordingStatusLabel.innerText = "Recording complete";
    recordBlob = (cameraPlayer as any).recordedData as Blob;

    beginUploadButton.disabled = false;
    audioInputSelect.disabled = false;
    videoInputSelect.disabled = false;
}

async function beginUpload() {
    progressContainer.style.display = "block";

    beginUploadButton.disabled = true;
    uploadProgress.value = 0;
    uploadStatusLabel.innerText = "Uploading data...";

    var cameraDownloadUrl: string;

    try {
        cameraDownloadUrl = await BlobUploader.uploadBlobToBackend(recordBlob, (progress) => uploadProgress.value = progress);
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