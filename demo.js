const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let pc;

async function start() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  localVideo.srcObject = localStream;

  pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  });

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  pc.onicecandidate = event => {
    if (event.candidate) {
      console.log('New ICE candidate:', event.candidate);
    }
  };

  pc.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };
}

async function makeOffer() {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
}

async function handleOffer(offer) {
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
}

async function handleAnswer(answer) {
  await pc.setRemoteDescription(answer);
}

async function handleRemoteCandidate(candidate) {
  await pc.addIceCandidate(candidate);
}

start();