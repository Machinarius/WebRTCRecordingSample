import SignallingChannel from "./SignallingChannel";

export default class RTCConnectionHandler {
    private cameraConnection: RTCPeerConnection;
    private screenShareConnection: RTCPeerConnection;
    
    public onRemoteReadyToRecord?: () => void;

    constructor(private signallingChannel: SignallingChannel) {
        this.cameraConnection = new RTCPeerConnection();
        this.screenShareConnection = new RTCPeerConnection();

        this.cameraConnection.onicecandidate = this.createIceCandidateHandler("camera", this);
        this.screenShareConnection.onicecandidate = this.createIceCandidateHandler("screen", this);

        this.cameraConnection.onicegatheringstatechange = this.createIceGatheringStateListener("camera", this.cameraConnection, this);
        this.screenShareConnection.onicegatheringstatechange = this.createIceGatheringStateListener("screen", this.screenShareConnection, this);

        this.signallingChannel.onRemoteSdpDataObtained = this.handleRemoteSdpDataObtained.bind(this);
    }

    public setStreams(cameraStream: MediaStream, screenStream: MediaStream) {
        cameraStream.getTracks().forEach(track => this.cameraConnection.addTrack(track, cameraStream));
        screenStream.getTracks().forEach(track => this.screenShareConnection.addTrack(track, screenStream));

        this.configureOffers();
    }

    private async configureOffers() {
        let cameraOffer = await this.cameraConnection.createOffer();
        let screenOffer = await this.screenShareConnection.createOffer();

        await this.cameraConnection.setLocalDescription(cameraOffer);
        await this.screenShareConnection.setLocalDescription(screenOffer);

        this.signallingChannel.sendSdpInfo("camera", cameraOffer.sdp);
        this.signallingChannel.sendSdpInfo("screen", screenOffer.sdp);
    }

    private createIceCandidateHandler(streamName: string, self: RTCConnectionHandler): (event: RTCPeerConnectionIceEvent) => void {
        function handleIceCandidate(event: RTCPeerConnectionIceEvent) {
            self.signallingChannel.sendIceCandidateEvent(streamName, event.candidate);
        }
        return handleIceCandidate;
    }

    private createIceGatheringStateListener(streamName: string, connection: RTCPeerConnection, self: RTCConnectionHandler): (event: Event) => void {
        function handleIceGatheringStateChange(event: Event) {
            if (connection.iceGatheringState === "complete") {
                self.signallingChannel.sendIceGatheringCompleteEvent(streamName);
            }
        }
        return handleIceGatheringStateChange;
    }

    private cameraSdpReceived = false;
    private screenSdpReceived = false;

    private async handleRemoteSdpDataObtained(streamName: string, sdpText: string) {
        let remoteDescription = new RTCSessionDescription({
            type: 'answer',
            sdp: sdpText
        });

        if (streamName === "camera") {
            await this.cameraConnection.setRemoteDescription(remoteDescription);
            this.cameraSdpReceived = true;
        }

        if (streamName === "screen") {
            await this.screenShareConnection.setRemoteDescription(remoteDescription);
            this.screenSdpReceived = true;
        }

        if (this.cameraSdpReceived && this.screenSdpReceived) {
            if (this.onRemoteReadyToRecord) {
                this.onRemoteReadyToRecord();
            }
        }
    }
}