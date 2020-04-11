import { WSAction, SDPInfoAnnouncement, ICECandidateAnnouncement, IMessage, 
    SessionCreatedAnnouncement, ICECandidateGatheringFinished, 
    ServerSDPInfoAnnouncement, ICECandidateData, RecordingStartedAnnouncement, RecordingStoppedAnnouncement } from "../../server/common/CommChannelConstants";

export default class SignallingChannel {
    private channel: WebSocket;
    private sessionReadyWaitHandle: Promise<string>;
    private sessionReadyResolver: (sessionId: string) => void;
    
    public onRemoteSdpDataObtained?: (streamName: string, sdpData: string) => void;

    public onRemoteStartedRecording?: (sessionId: string) => void;
    public onRemoteStoppedRecording?: (sessionId: string, cameraFiles: string[], screenFiles: string[]) => void;

    constructor() {
        this.sessionReadyResolver = (_) => {};
        this.sessionReadyWaitHandle = new Promise<string>(((resolve: (sessionId: string) => void) => {
            this.sessionReadyResolver = resolve;
        }).bind(this));

        let wsHostUrl = "ws://localhost:9001";
        this.channel = new WebSocket(wsHostUrl);
        this.channel.onmessage = this.handleIncomingMessage.bind(this);
    }

    public async waitUntilSessionIsReady(): Promise<string> {
        return await this.sessionReadyWaitHandle;
    }

    public sendSdpInfo(streamName: string, sdpData: string | undefined) {
        if (!sdpData || !streamName) {
            return;
        }

        this.channel.send(JSON.stringify(<SDPInfoAnnouncement>{
            action: WSAction.ClientSDPInfoAnnouncement,
            streamName: streamName,
            sdpPayload: sdpData
        }));
    }

    public sendIceCandidateEvent(streamName: string, candidate: RTCIceCandidate | null) {
        if (!candidate || !streamName || !candidate.candidate) { 
            // Ignore end-of-candidates candidate
            return;
        }

        // https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate
        // Ideally, the browser would provide a complete object... It's only providing the string representation of the candidate.

        let candidateComponents = candidate.candidate.substr("candidate:".length).split(" ");
        var foundation = candidateComponents[0];
        var componentId = parseInt(candidateComponents[1]);
        var transport = candidateComponents[2];
        var priority = parseInt(candidateComponents[3]);
        var address = candidateComponents[4];
        var port = parseInt(candidateComponents[5]);
        var type = candidateComponents[7]; // skip "typ" prefix

        var relatedAddress = "";
        var relatedPort = 0;
        if (candidateComponents.length > 8) {
            relatedAddress = candidateComponents[8];
            relatedPort = parseInt(candidateComponents[9]);
        }

        let candidateData: ICECandidateData = {
            foundation: foundation!,
            componentId: componentId,
            transport: transport,
            priority: priority,
            address: address,
            port: port,
            type: type,
            relatedAddress: relatedAddress,
            relatedPort: relatedPort
        };
        
        this.channel.send(JSON.stringify(<ICECandidateAnnouncement>{
            action: WSAction.ICECandidateAnnouncement,
            streamName: streamName,
            candidateData: candidateData
        }));
    }

    public sendIceGatheringCompleteEvent(streamName: string) {
        if (!streamName) {
            return;
        }
        
        this.channel.send(JSON.stringify(<ICECandidateGatheringFinished>{
            action: WSAction.ICECandidateGatheringFinished,
            streamName: streamName
        }));
    }

    public sendRecordingStartRequest() {
        this.channel.send(JSON.stringify(<IMessage>{
            action: WSAction.RecordingStartRequest
        }));
    }

    public sendRecordingStopRequest() {
        this.channel.send(JSON.stringify(<IMessage>{
            action: WSAction.RecordingStopRequest
        }));
    }

    private handleIncomingMessage(event: MessageEvent) {
        let message = <IMessage>JSON.parse(event.data);
        switch (message.action) {
            case WSAction.SessionCreatedAnnouncement:
                this.handleSessionCreatedAnnouncement(<SessionCreatedAnnouncement>message);
                break;
            case WSAction.ServerSDPInfoAnnouncement:
                this.handleServerSDPInfoAnnouncement(<ServerSDPInfoAnnouncement>message);
                break;
            case WSAction.RecordingStartedAnnouncement:
                this.handleRecordingStartedAnnouncement(<RecordingStartedAnnouncement>message);
                break;
            case WSAction.RecordingStoppedAnnouncement:
                this.handleRecordingStoppedAnnouncement(<RecordingStoppedAnnouncement>message);
                break;
        }
    }

    private handleServerSDPInfoAnnouncement(announcement: ServerSDPInfoAnnouncement) {
        if (this.onRemoteSdpDataObtained) {
            this.onRemoteSdpDataObtained(announcement.streamName, announcement.sdpPayload);
        }
    }

    private handleSessionCreatedAnnouncement(announcement: SessionCreatedAnnouncement) {
        this.sessionReadyResolver(announcement.sessionId);
    }

    private handleRecordingStoppedAnnouncement(message: RecordingStoppedAnnouncement) {
        if (this.onRemoteStoppedRecording) {
            this.onRemoteStoppedRecording(message.sessionId, message.generatedFiles.cameraFiles, message.generatedFiles.screenFiles);
        }
    }

    private handleRecordingStartedAnnouncement(message: RecordingStartedAnnouncement) {
        if (this.onRemoteStartedRecording) {
            this.onRemoteStartedRecording(message.sessionId);
        }
    }
}