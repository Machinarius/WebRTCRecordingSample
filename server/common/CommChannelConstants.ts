export enum WSAction {
    ICECandidateAnnouncement = "ICE_CANDIDATE",
    ClientSDPInfoAnnouncement = "CLIENT_SDP_INFO",
    SessionCreatedAnnouncement = "SESSION_CREATED",
    ICECandidateGatheringFinished = "ICE_GATHERING_FINISHED",
    ServerSDPInfoAnnouncement = "SERVER_SDP_INFO",
    RecordingStartRequest = "START_RECORDING",
    RecordingStopRequest = "STOP_RECORDING",
    RecordingStartedAnnouncement = "STARTED_RECORDING",
    RecordingStoppedAnnouncement = "STOPPED_RECORDING"
}

export interface IMessage {
    action: WSAction
}

export interface SDPInfoAnnouncement extends IMessage {
    action: typeof WSAction.ClientSDPInfoAnnouncement,
    streamName: string,
    sdpPayload: string
}

export interface ICECandidateAnnouncement {
    action: typeof WSAction.ICECandidateAnnouncement,
    streamName: string,
    candidateData: ICECandidateData
}

export interface SessionCreatedAnnouncement {
    action: typeof WSAction.SessionCreatedAnnouncement,
    sessionId: string
}

export interface ICECandidateGatheringFinished extends IMessage {
    action: typeof WSAction.ICECandidateGatheringFinished,
    streamName: string
}

export interface ServerSDPInfoAnnouncement extends IMessage {
    action: typeof WSAction.ServerSDPInfoAnnouncement,
    streamName: string,
    sdpPayload: string
}

export interface RecordingStartedAnnouncement extends IMessage {
    action: typeof WSAction.RecordingStartedAnnouncement,
    sessionId: string
}

export interface RecordingStoppedAnnouncement extends IMessage {
    action: typeof WSAction.RecordingStoppedAnnouncement,
    sessionId: string,
    generatedFiles: {
        cameraFiles: string[],
        screenFiles: string[]
    }
}

export interface ICECandidateData {
    foundation: string,
    componentId: number,
    transport: string,
    priority: number,
    address: string,
    port: number,
    type: string,
    relatedAddress: string,
    relatedPort: number
}