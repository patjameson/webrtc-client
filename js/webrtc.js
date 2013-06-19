var socket = io.connect('/');
var cur_stream = null;
var sessions, pc1, client_id, id, dc1
	, raw_id = window.location.pathname.match(/\/(\d+)/)
	, is_creator = raw_id === null || raw_id.length == 0;

var DEFAULT_STUN_SERVER = {'url': 'stun:stun.l.google.com:19302'};

var _localStreamElement = null,
	_remoteStreamElement = null,
	_roomId = '',
	_clientId = -1,
	_streaming = false,
	_localStream = null,
	_remoteStream = null,
	_isDataChannelOpen = false,
	_disconnectedMessages = [],
	_owner = true;

function WebRTC() {}

WebRTC.prototype = {
	startMediaStream: function(callback) {

		getUserMedia({audio: true, video: true}, function(stream) {
			_localStream = stream;

			attachMediaStream(_localStreamElement, _localStream);

			var configuration = {'iceServers': [DEFAULT_STUN_SERVER]};
			var connection = {'optional': [{'RtpDataChannels': true }]};
			pc1 = new RTCPeerConnection(configuration, connection);
			pc1.addStream(_localStream);
			dc1 = pc1.createDataChannel('test', {'reliable': false});

			pc1.onaddstream = function(event) {
				_remoteStream = event.stream;
				attachMediaStream(_remoteStreamElement, _remoteStream);
			};

			pc1.onicecandidate = function(event) {
				if (event.candidate) {
					socket.emit('cand', {'client_id': client_id, 'cand': event.candidate, 'id': id});
				}
			};

			console.log('outside');
			console.log(socket);
			socket.emit('join', {'id': _roomId});

			socket.on('joined', function(data) {
				console.log('recieved');
				client_id = data.client_id;
				id = data.id;

				if (_roomId === '') {
					console.log('before offer');
					pc1.createOffer(function(desc) {
						console.log('after offer');
						pc1.setLocalDescription(desc);
						socket.emit('desc', {'client_id': client_id, 'desc': desc, 'id': id});
					}, null);
				}

				console.log('before callback');
				callback(id);
				console.log('after callback');
			});

			socket.on('add_desc', function(data) {
				client_id = data.client_id;
				id = data.id;

				console.log('setting remote description');
				console.log(data.desc);
				pc1.setRemoteDescription(new RTCSessionDescription(data.desc));

				_streaming = true;

				if (_roomId !== '') {
					pc1.createAnswer(function(desc) {
						pc1.setLocalDescription(desc);
						socket.emit('desc', {'client_id': client_id, 'desc': desc, 'id': id});
					});
				}
			});

			socket.on('add_cand', function(data) {
				pc1.addIceCandidate(new RTCIceCandidate(data.cand));
			});
		});
	},

	startDataChannel: function(callback) {
		dc1.onmessage = callback;

		console.log('setting up stuff');

		dc1.onopen = function() {
			console.log('open!');
			_isDataChannelOpen = true;
			for (var i = 0;i < _disconnectedMessages.length;i++) {
				dc1.send(_disconnectedMessages[i]);
			}
		};
	},

	send: function(message) {
		console.log('trying to send');
		if (_isDataChannelOpen)
			dc1.send(message);
		else
			_disconnectedMessages.push(message);
	},

	setLocal: function(element) {
		_localStreamElement = document.getElementById(element);
	},

	setRemote: function(element) {
		_remoteStreamElement = document.getElementById(element);
	},

	pause: function() {
		pc1.removeStream(_localStream);
		pc1.createOffer(function(desc) {
			pc1.setLocalDescription(desc);
			socket.emit('desc', {'client_id': client_id, 'desc': desc, 'id': id});
		}, null);
	},

	resume: function() {
		//pc1.addStream(_localStream);
		//pc1.createOffer(...);
	},

	mute: function() {

	},

	getId: function() {
		return _roomId;
	},

	setId: function(roomId) {
		_owner = false;
		_roomId = roomId;
	},

	setIceServers: function(servers) {
		if (typeof servers === 'array') {
			_ice_servers = servers;
		} else {
			_ice_servers = [servers];
		}
	},

	isStreaming: function() {
		return _streaming;
	}
};

Y.WebRTC = WebRTC;

