import * as uuid from "uuid";

import { Endpoint as RTCEndpoint } from "medooze-media-server";

import RTCHandler from "./RTCHandler";

import { SessionCreatedAnnouncement, WSAction, IMessage, SDPInfoAnnouncement, 
    ICECandidateAnnouncement, ICECandidateGatheringFinished, ServerSDPInfoAnnouncement } from "../common/CommChannelConstants";

export default class WSHandler {
    private rtcHandler: RTCHandler;
    private connectionId: string;

    constructor(
        private clientSocket: WebSocket,
        private rtcEndpoint: RTCEndpoint) { }

    public beginSession() {
        this.connectionId = uuid.v4();
        this.rtcHandler = new RTCHandler(this.rtcEndpoint, this.connectionId, this);

        (this.clientSocket as any)
            .on("message", this.handleIncomingMessage.bind(this));

        (this.clientSocket as any)
            .on("close", this.handleConnectionClosed.bind(this));

        this.clientSocket.send(JSON.stringify(<SessionCreatedAnnouncement>{
            action: WSAction.SessionCreatedAnnouncement,
            sessionId: this.connectionId
        }));
    }

    public sendSDPAnswerEvent(answerPayload: string, streamName: string) {
        this.clientSocket.send(JSON.stringify(<ServerSDPInfoAnnouncement>{
            action: WSAction.ServerSDPInfoAnnouncement,
            streamName: streamName,
            sdpPayload: answerPayload
        }));
    }

    public sendRecordingStartedEvent() {
        this.clientSocket.send(JSON.stringify(<IMessage>{
            action: WSAction.RecordingStartedAnnouncement
        }))
    }
    
    public sendRecordingStoppedEvent() {
        this.clientSocket.send(JSON.stringify(<IMessage>{
            action: WSAction.RecordingStoppedAnnouncement
        }))
    }

    private handleICECandidateAnnouncement(announcement: ICECandidateAnnouncement) {
        this.rtcHandler.onClientICECandidateAnnouncement(announcement);
    }
    
    private handleSDPInfoAnnouncement(announcement: SDPInfoAnnouncement) {
        this.rtcHandler.onClientSDPInfoAnnouncement(announcement);
    }

    private handleICEGatheringFinished(event: ICECandidateGatheringFinished) {
        this.rtcHandler.onClientICEGatheringFinished(event);
    }

    private handleRecordingStartRequested() {
        this.rtcHandler.onRecordingStartRequested();
    }

    private handleRecordingStopRequested() {
        this.rtcHandler.onRecordingStopRequested();
    }

    private handleIncomingMessage(messageText: string) {
        let messageObject = <IMessage>JSON.parse(messageText);
        switch (messageObject.action) {
            case WSAction.ClientSDPInfoAnnouncement:
                this.handleSDPInfoAnnouncement(<SDPInfoAnnouncement>messageObject);
                break;
            case WSAction.ICECandidateAnnouncement:
                this.handleICECandidateAnnouncement(<ICECandidateAnnouncement>messageObject);
                break;
            case WSAction.ICECandidateGatheringFinished:
                this.handleICEGatheringFinished(<ICECandidateGatheringFinished>messageObject);
                break;
            case WSAction.RecordingStartRequest:
                this.handleRecordingStartRequested();
                break;
            case WSAction.RecordingStopRequest:
                this.handleRecordingStopRequested(); 
                break;
        }
    }

    private handleConnectionClosed() {
        this.rtcHandler.onClientDisconnected();
    }
}