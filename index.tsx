import 'babel-polyfill';
import * as React from 'react';
import { render } from 'react-dom';
import * as styled from 'styled-components';
/*interface HTMLVideoElement {
  src: any;
}*/
/*navigator.getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia;
window.RTCPeerConnection =
  window.RTCPeerConnection ||
  window.webkitRTCPeerConnection ||
  window.mozRTCPeerConnection;
window.RTCSessionDescription =
  window.RTCSessionDescription ||
  window.webkitRTCSessionDescription ||
  window.mozRTCSessionDescription;*/

const playVideo = (element: HTMLVideoElement, stream: MediaStream) => {
  console.log(element);
  if ('srcObject' in element) {
    element.srcObject = stream;
  } else {
    element.src = window.URL.createObjectURL(stream);
  }
  element.play();
  element.volume = 0;
};
const pauseVideo = (element: HTMLVideoElement) => {
  element.pause();
  if ('srcObject' in element) {
    element.srcObject = null;
  } else {
    if (element.src && element.src !== '') {
      window.URL.revokeObjectURL(element.src);
    }
    element.src = '';
  }
};
const stopLocalStream = (stream: MediaStream) => {
  const tracks = stream.getTracks();
  if (!tracks) {
    console.warn('NO tracks');
    return;
  }
  for (const track of tracks) {
    track.stop();
  }
};
const getDeviceStream = (
  option: { video: boolean; audio: boolean } = { video: true, audio: true }
): Promise<any> => {
  if ('getUserMedia' in navigator.mediaDevices) {
    console.log('navigator.mediaDevices.getUserMedia');
    return navigator.mediaDevices.getUserMedia(option);
  } else {
    console.log('wrap navigator.getUserMedia with Promise');
    return new Promise<any>((resolve, reject) => {
      navigator.getUserMedia(option, resolve, reject);
    });
  }
};

class App extends React.Component {
  localVideo: any;
  remoteVideo: any;
  textForSendSdp: any;
  textToReceiveSdp: any;
  localStream: any;
  peerConnection: RTCPeerConnection | null;
  state: { receiveSdp: string; sendSdp: string };

  constructor(props) {
    super(props);
    this.localVideo = React.createRef();
    this.remoteVideo = React.createRef();
    this.textForSendSdp = React.createRef();
    this.textToReceiveSdp = React.createRef();
    this.startVideo = this.startVideo.bind(this);
    this.stopVideo = this.stopVideo.bind(this);
    this.onSdpText = this.onSdpText.bind(this);
    this.connect = this.connect.bind(this);
    this.hangUp = this.hangUp.bind(this);
    this.prepareNewConnection = this.prepareNewConnection.bind(this);
    this.peerConnection = null;
    this.state = { receiveSdp: '', sendSdp: 'SDP to send' };
  }
  prepareNewConnection() {
    const pcConfig = { iceServers: [] };
    const peer = new RTCPeerConnection(pcConfig);
    if ('ontrack' in peer) {
      peer.ontrack = e => {
        console.log('-- peer.ontrack()');
        const stream = e.streams[0];
        playVideo(this.remoteVideo.current, stream);
      };
    } else {
      peer.onaddstream = e => {
        console.log('-- peer.onaddstream()');
        const stream = e.stream;
        playVideo(this.remoteVideo.current, stream);
      };
    }
    peer.onicecandidate = e => {
      if (e.candidate) {
        console.log(e.candidate);
      } else {
        console.log('empty ice event');
        this.sendSdp(peer.localDescription);
      }
    };
    if (this.localStream) {
      console.log('Adding local stream...');
      peer.addStream(this.localStream);
    } else {
      console.warn('no local stream, but continue.');
    }
    return peer;
  }
  async makeOffer() {
    this.peerConnection = this.prepareNewConnection();
    try {
      const sessionDescription = await this.peerConnection.createOffer();
      console.log('createOffer() success in promise.');
      await this.peerConnection.setLocalDescription(sessionDescription);
      console.log('setLocalDescription() success in promise');
      //sendSdp(this.peerConnection.localDescription);
    } catch (e) {
      console.error(e);
    }
  }
  async setOffer(sessionDescription) {
    if (this.peerConnection) {
      console.error('peerConnection already exist');
    }
    this.peerConnection = this.prepareNewConnection();
    try {
      await this.peerConnection.setRemoteDescription(sessionDescription);
      console.log('setRemoteDescription(offer) success in promise');
      await this.makeAnswer();
    } catch (e) {
      console.error('setRemoteDescription(offer) ERROR: ', e);
    }
  }
  async makeAnswer() {
    console.log('sending Answer. Creating remote session description...');
    if (!this.peerConnection) {
      console.error('peerConnection NOT exist!');
      return;
    }
    try {
      const sessionDescription = await this.peerConnection.createAnswer();
      console.log('createAnswer() success in promise');
      await this.peerConnection.setLocalDescription(sessionDescription);
      console.log('setLocalDescription() success in Promise');

      //this.sendSdp(this.peerConnection.localDescription);
    } catch (e) {
      console.error(e);
    }
  }
  async setAnswer(sessionDescription: RTCSessionDescription) {
    if (!this.peerConnection) {
      console.error('peerConnection NOT exist!');
      return;
    }
    try {
      await this.peerConnection.setRemoteDescription(sessionDescription);
      console.log('setRemoteDescription(answer) success in promise');
    } catch (e) {
      console.error('setRemoteDescription(answer) ERROR: ', e);
    }
  }
  connect() {
    if (!this.peerConnection) {
      console.log('make Offer');
      this.makeOffer();
    } else {
      console.warn('peer already exist.');
    }
  }
  hangUp() {
    if (this.peerConnection) {
      console.log('Hang Up.');
      this.peerConnection.close();
      this.peerConnection = null;
      pauseVideo(this.remoteVideo.current);
    } else {
      console.warn('peer NOT exist.');
    }
  }
  onSdpText() {
    const text = this.state.receiveSdp;
    if (this.peerConnection) {
      console.log('Received answer text...');
      const answer = new RTCSessionDescription({ type: 'answer', sdp: text });
      this.setAnswer(answer);
    } else {
      console.log('Received offer text...');
      const offer = new RTCSessionDescription({ type: 'offer', sdp: text });
      this.setOffer(offer);
    }
    this.setState({ receiveSdp: '' });
  }
  sendSdp(sessionDescription: RTCSessionDescription) {
    console.log('--- Sending sdp ---');
    this.setState({ sendSdp: sessionDescription.sdp });
    this.textForSendSdp.current.focus();
    this.textForSendSdp.current.select();
  }
  async startVideo() {
    try {
      this.localStream = await getDeviceStream({ video: true, audio: false });
      playVideo(this.localVideo.current, this.localStream);
    } catch (e) {
      console.error('getUserMedia error:', e);
    }
  }
  stopVideo() {
    pauseVideo(this.localVideo.current);
    stopLocalStream(this.localStream);
  }
  render() {
    return (
      <div>
        <h1>Hand Signaling</h1>
        <button onClick={this.startVideo}>Start Video</button>
        <button onClick={this.stopVideo}>Stop Video</button>
        <button onClick={this.connect}>Connect</button>
        <button onClick={this.hangUp}>Hang Up</button>
        <div>
          <video
            id="local_video"
            ref={this.localVideo}
            autoPlay
            style={{
              width: '160px',
              height: '120px',
              border: '1px solid black',
            }}
          />
          <video
            id="remote_video"
            ref={this.remoteVideo}
            autoPlay
            style={{
              width: '160px',
              height: '120px',
              border: '1px solid black',
            }}
          />
          <div>
            <p>SDP to send:</p>
            <textarea
              id="text_for_send_sdp"
              cols="60"
              rows="5"
              readOnly
              ref={this.textForSendSdp}
              value={this.state.sendSdp}
            />
          </div>
          <div>
            <p>SDP to receive:</p>
            <button onClick={this.onSdpText} ref={this.textToReceiveSdp}>
              Receive Remote SDP
            </button>
            <textarea
              id="text_for_receive_sdp"
              cols="60"
              rows="5"
              onChange={e => this.setState({ receiveSdp: e.target.value })}
              value={this.state.receiveSdp}
            />
          </div>
        </div>
      </div>
    );
  }
}
render(<App />, document.getElementById('root'));
