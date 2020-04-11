import MediaServer, { Endpoint as RTCEndpoint, Transport, Recorder, IncomingStream } from "medooze-media-server";
import SemanticSDP, { SDPInfo, CandidateInfo } from "semantic-sdp";

import path from "path";
import fs from "fs";
import * as uuid from "uuid";

import WSHandler from "./WSHandler";
import { SDPInfoAnnouncement, ICECandidateAnnouncement, ICECandidateGatheringFinished, ICECandidateData } from "../common/CommChannelConstants";

export interface SessionDescriptor {
    cameraOffer: SemanticSDP.SDPInfo,
    screenShareOffer: SemanticSDP.SDPInfo
}

export default class RTCHandler {
    constructor(
        private rtcEndpoint: RTCEndpoint, 
        private connectionId: string,
        private signallingChannel: WSHandler) { }
        
    public onClientSDPInfoAnnouncement(announcement: SDPInfoAnnouncement) {
        this.parseAndStoreSdpPayload(announcement.streamName, announcement.sdpPayload);
    }

    private cameraICECandidates: ICECandidateData[] = [];
    private screenICECandidates: ICECandidateData[] = [];

    public onClientICECandidateAnnouncement(announcement: ICECandidateAnnouncement) {
        switch (announcement.streamName) {
            case "camera":
                this.cameraICECandidates.push(announcement.candidateData);
                break;
            case "screen":
                this.screenICECandidates.push(announcement.candidateData);
                break;
        }
    }

    private cameraCandidatesReady: boolean;
    private screenCandidatesReady: boolean;

    public onClientICEGatheringFinished(event: ICECandidateGatheringFinished) {
        var targetInfoObject: SDPInfo;
        var iceCandidates: ICECandidateData[];
        var readySetter: (value: boolean) => void;

        if (event.streamName === "camera") {
            targetInfoObject = this.cameraSdpInfo;
            iceCandidates = this.cameraICECandidates;
            readySetter = (value) => {
                this.cameraCandidatesReady = value;
            };
        } else if (event.streamName === "screen") {
            targetInfoObject = this.screenSdpInfo;
            iceCandidates = this.screenICECandidates;
            readySetter = (value) => {
                this.screenCandidatesReady = value;
            };
        } else {
            return;
        }

        let candidateObjects = iceCandidates
            .map(candidateData => new CandidateInfo(
                    candidateData.foundation || "",
                    candidateData.componentId || -1,
                    candidateData.transport || "",
                    candidateData.priority || -1,
                    candidateData.address || "",
                    candidateData.port || -1,
                    candidateData.type || "",
                    candidateData.relatedAddress || "",
                    candidateData.relatedPort || -1
                ));
        targetInfoObject.addCandidates(candidateObjects);
        readySetter(true);

        console.log("Added candidates for stream " + event.streamName);
        if (this.cameraCandidatesReady && this.screenCandidatesReady) {
            this.generateOfferAnswers();
        }
    }

    private cameraSdpInfo: SDPInfo;
    private screenSdpInfo: SDPInfo;

    private parseAndStoreSdpPayload(streamName: string, sdpPayload: string) {
        switch (streamName) {
            case "camera":
                this.cameraSdpInfo = SDPInfo.process(sdpPayload);
                console.log("Got SDP info for the camera stream");
                break;
            case "screen":
                this.screenSdpInfo = SDPInfo.process(sdpPayload);
                console.log("Got SDP info for the screen stream");
                break;
        }
    }

    private generateOfferAnswers() {
        let cameraAnswer = this.createAnswer(this.cameraSdpInfo, (transport) => this.cameraTransport = transport);
        let screenAnswer = this.createAnswer(this.screenSdpInfo, (transport) => this.screenTransport = transport);

        this.signallingChannel.sendSDPAnswerEvent(cameraAnswer.toString(), "camera");
        this.signallingChannel.sendSDPAnswerEvent(screenAnswer.toString(), "screen");
    }

    private cameraTransport: Transport = null;
    private screenTransport: Transport = null;

    private createAnswer(offer: SemanticSDP.SDPInfo, transportOutput: (transport: Transport) => void): SemanticSDP.SDPInfo {
        let streamTransport = this.rtcEndpoint.createTransport(offer);
        let offerAnswer = offer.answer({
            dtls:           streamTransport.getLocalDTLSInfo(),
            ice:            streamTransport.getLocalICEInfo(),
            candidates:     this.rtcEndpoint.getLocalCandidates(),
            capabilities:   Capabilities
        });
        streamTransport.setRemoteProperties(offer);
        streamTransport.setLocalProperties(offerAnswer);

        transportOutput(streamTransport);
        return offerAnswer;
    }  

    private currentSessionId: string | null;
    private sessionRecordings: {
        [sessionId: string]: {
            camera: string[],
            screen: string[]
        }
    } = {};

    public onRecordingStartRequested() {
        if (this.activeRecorders.length > 0 || this.currentSessionId) {
            return;
        }

        this.currentSessionId = uuid.v4();
        let generatedRecordings = {
            camera: this.beginRecordingStream("camera", this.cameraSdpInfo, this.cameraTransport, this.currentSessionId),
            screen: this.beginRecordingStream("screen", this.screenSdpInfo, this.screenTransport, this.currentSessionId)
        };
        this.sessionRecordings[this.currentSessionId] = generatedRecordings;

        this.signallingChannel.sendRecordingStartedEvent(this.currentSessionId);
    }
    
    private activeRecorders: Recorder[] = [];
    private incomingStreams: {
        [id: string]: IncomingStream | undefined
    } = {};
    
    public async onRecordingStopRequested() {
        if (this.activeRecorders.length == 0 || !this.currentSessionId) {
            return;
        }

        this.activeRecorders.forEach(recorder => {
            recorder.stop(); // This API is pending a promise to enable awaiting the flush procedure
        });
        this.activeRecorders = [];

        var previousSessionId = this.currentSessionId;
        this.currentSessionId = null;

        await new Promise((resolve) => {
            setTimeout(resolve, 1000); // Give the recording system some time to flush the recording to disk
        });
        let generatedFiles = this.sessionRecordings[previousSessionId];
        this.signallingChannel.sendRecordingStoppedEvent(previousSessionId, generatedFiles.camera, generatedFiles.screen);
    }
    
    private beginRecordingStream(streamName: string, streamOffer: SDPInfo, streamTransport: Transport, sessionId: string) {
        let generatedRecordings = [];
        streamOffer.getStreams().forEach(stream => {
            if (!fs.existsSync("./recordings/" + sessionId)) {
                fs.mkdirSync("./recordings/" + sessionId);
            }

            let relativeFilename = `./recordings/${sessionId}/${streamName}.mp4`;
            let recordingTarget = path.resolve(relativeFilename);
            let streamRecorder = MediaServer.createRecorder(recordingTarget);
            let incomingStream = this.incomingStreams[stream.getId()];
            if (!incomingStream) {
                incomingStream = streamTransport.createIncomingStream(stream);
                this.incomingStreams[stream.getId()] = incomingStream;
            }

            streamRecorder.record(incomingStream);
            this.activeRecorders.push(streamRecorder);

            generatedRecordings.push(relativeFilename);
        });
        return generatedRecordings;
    }

    public onClientDisconnected() {
        this.onRecordingStopRequested();
        Object.keys(this.incomingStreams).forEach(streamId => {
            this.incomingStreams[streamId].stop();
        });
    }
}

// Taken from  https://github.com/medooze/media-server-demo-node/blob/6410877683f62a4e3e8ec0f15575230eb2a980fa/lib/recording.js#L16
const Capabilities = {
	audio : {
		codecs		: ["opus"],
        extensions	: [ "urn:ietf:params:rtp-hdrext:ssrc-audio-level", "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01"],
        rtcpfbs     : []
	},
	video : {
		codecs		: ["vp9","h264;packetization-mode=1"],
		rtx		    : true,
		rtcpfbs		: [
			{ "id": "transport-cc"},
			{ "id": "ccm", "params": ["fir"]},
			{ "id": "nack"},
			{ "id": "nack", "params": ["pli"]}
		],
		extensions	: [ "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01"]
	}
};