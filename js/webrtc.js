var socket = io.connect('/');
var sessions, pc1, id, dc1;

var DEFAULT_STUN_SERVER = {'url': 'stun:stun.l.google.com:19302'};

var _localStreamElement = null,
	_remoteStreamElement = null,
	_roomId = '',
	clientId = -1,
	_isStreaming = false,
	_localStream = null,
	_remoteStream = null,
	_isDataChannelOpen = false,
	_disconnectedMessages = [],
	_owner = true;

function WebRTC() {}

WebRTC.prototype = {
	startStream: function (type, callback) {
		var configuration = {'iceServers': [DEFAULT_STUN_SERVER]};
		var connection = {'optional': [{'RtpDataChannels': true }]};
		pc1 = new RTCPeerConnection(configuration, connection);

		thisWebRTC = this;

		if (type == 'both' || type == 'media' || typeof type === undefined) {
			thisWebRTC._startLocalStream(function() {
				pc1.addStream(_localStream);

				pc1.onaddstream = function (event) {
					_remoteStream = event.stream;
					attachMediaStream(_remoteStreamElement, _remoteStream);
					_isStreaming = true;
				};

				if (type == 'both' || typeof type === undefined) {
					dc1 = pc1.createDataChannel('test', {'reliable': false});

					thisWebRTC._startDataChannel();
				}

				thisWebRTC._makeConnection(callback);
			});
		} else if (type == 'data') {
			dc1 = pc1.createDataChannel('test', {'reliable': false});
			
			thisWebRTC._startDataChannel();

			thisWebRTC._makeConnection(callback);
		}
	},

	setDataChannelCallback: function(callback) {
		dc1.onmessage = callback;
	},

	send: function(message) {
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
		this._updateDescription();
		_isStreaming = false;
	},

	isStreaming: function() {
		return paused;
	},

	resume: function() {
		pc1.addStream(_localStream);
		this._updateDescription();
		_isStreaming = true;
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
	},

	_startLocalStream: function (callback) {
		getUserMedia({audio: true, video: true}, function (stream) {
			_localStream = stream;

			attachMediaStream(_localStreamElement, _localStream);

			callback();
		});
	},

	_startDataChannel: function () {
		dc1.onmessage = null;

		dc1.onopen = function () {
			_isDataChannelOpen = true;
			for (var i = 0;i < _disconnectedMessages.length;i++) {
				dc1.send(_disconnectedMessages[i]);
			}
		};
	},

	_makeConnection: function (callback) {
		var thisWebRTC = this;
		pc1.onicecandidate = function (event) {
			if (event.candidate) {
				socket.emit('cand', {'client_id': client_id, 'cand': event.candidate, 'id': id});
			}
		};

		socket.emit('join', {'id': _roomId});

		socket.on('joined', function (data) {
			client_id = data.client_id;
			id = data.id;

			if (_roomId === '') {
				thisWebRTC._updateDescription();
			}

			callback(id);
		});

		socket.on('add_desc', function (data) {
			client_id = data.client_id;
			id = data.id;

			pc1.setRemoteDescription(new RTCSessionDescription(data.desc));

			_streaming = true;

			if (_roomId !== '') {
				pc1.createAnswer(function (desc) {
					pc1.setLocalDescription(desc);
					socket.emit('desc', {'client_id': client_id, 'desc': desc, 'id': id});
				});
			}
		});

		socket.on('add_cand', function (data) {
			pc1.addIceCandidate(new RTCIceCandidate(data.cand));
		});
	},

	_updateDescription: function() {
		pc1.createOffer(function(desc) {
			pc1.setLocalDescription(desc);
			socket.emit('desc', {'client_id': client_id, 'desc': desc, 'id': id});
		}, null);
	}
};

Y.WebRTC = WebRTC;

