// get DOM elements
var dataChannelLog = document.getElementById('data-channel'),
	iceConnectionLog = document.getElementById('ice-connection-state'),
	iceGatheringLog = document.getElementById('ice-gathering-state'),
	signalingLog = document.getElementById('signaling-state');


// data channel
var dc = null, dcInterval = null;
var peer_id = '1-device'; 


var socket = null 
//const SIGNAL_SERVER = 'http://localhost:5000'
const SIGNAL_SERVER = 'https://mighty-dawn-28778.herokuapp.com/'


function init() {
	socket = io(SIGNAL_SERVER)
	socket.emit('set_clientId',{'clientId':'1-user'})
	//todo if socket is null, close option to join 
}

function createPeerConnection(){
	var config = {
		sdpSemantics: 'unified-plan',
		iceServers: [{urls: [
			'stun:stun.l.google.com:19302', 
			'stun:stun1.l.google.com:19302'

		]}]
	}
	pc = new RTCPeerConnection(config)

	// ------------register some listeners to help debugging----------------//
	pc.addEventListener('icegatheringstatechange', function() {
		iceGatheringLog.textContent += ' -> ' + pc.iceGatheringState;
	}, false);
	iceGatheringLog.textContent = pc.iceGatheringState;

	pc.addEventListener('iceconnectionstatechange', function() {
		iceConnectionLog.textContent += ' -> ' + pc.iceConnectionState;
	}, false);
	iceConnectionLog.textContent = pc.iceConnectionState;

	pc.addEventListener('signalingstatechange', function() {
		signalingLog.textContent += ' -> ' + pc.signalingState;
	}, false);
	signalingLog.textContent = pc.signalingState;
	//-----------------------------------------------------------------------//


	// ------------ link video stream ----------------//
	pc.addEventListener('track',(evt) => {
		console.log(evt)
		if(evt.track.kind == 'video'){
			document.getElementById('video').style.color = "blue";
			document.getElementById('video').srcObject = new MediaStream([evt.receiver.track])
		}
	})

	return pc 
}

function negotiate(pc) {
	pc.createOffer()
		.then((offer)=>{
			return pc.setLocalDescription(offer)})

		.then(()=>{
		//----------- Ice promise ------------------// 
			return new Promise(function(resolve) {
				if (pc.iceGatheringState === 'complete') {
					resolve();
				} else {
					function checkState() {
						if (pc.iceGatheringState === 'complete') {
							pc.removeEventListener('icegatheringstatechange', checkState);
							resolve();
						}
					}
					pc.addEventListener('icegatheringstatechange', checkState);
				}})
			})                                  
		//-------------------------------------------// 
		.then(()=>{
			console.log(pc.localDescription)
			var offer = pc.localDescription

			document.getElementById('offer-sdp').textContent = offer.sdp; 
			socket.emit('relaySessionDescription', JSON.stringify({
				sdp: offer.sdp, 
				type: offer.type,
				peer_id: peer_id
			}))
		})
	   
	socket.on('RTCSessionDescription', (data)=>{
	   config = JSON.parse(data)
	   document.getElementById('answer-sdp').textContent = config.sdp;
	   pc.setRemoteDescription(config)
	})
}



function start() {

	pc = createPeerConnection();

	pc.addTransceiver('video', {direction: 'recvonly'})


	//----------------------------Data Channel------------------------------//    
	var param = {"ordered": false, "maxRetransmits": 0}
	dc = pc.createDataChannel('chat',param)

	dc.onclose = () =>{
		dataChannelLog.textContent = 'close'
		document.onkeydown = null
		clearInterval(dcInterval);
	}

	dc.onopen = () => {



		dataChannelLog.textContent = 'open'

		//capture keyboard events 
		dcInterval = setInterval(function() {
			var message = '.';
			dc.send(message);
		}, 1000);

		document.onkeydown = function(evt) {
			evt = evt || window.event;
			//if (evt.ctrlKey && evt.keyCode == 90) {
        	evt.preventDefault();
			dc.send('+' + evt.key);


			console.log(evt.key)
			//dc.send(evt.keyCode)
		};
		document.onkeyup = function(evt) {
			evt = evt || window.event;
			//if (evt.ctrlKey && evt.keyCode == 90) {
			dc.send('-' + evt.key);
			console.log(evt.key)
			//dc.send(evt.keyCode)
		};
	}
	dc.onmessage = (evt) => {
		dataChannelLog.textContent += '< '  + evt.data + '\n'; 
	}

	negotiate(pc);
	


}


document.onload = init();