var socket = io.connect('/');
var sessions, pc1, id, dc1, clientId = -1;

var DEFAULT_STUN_SERVER = {'url': 'stun:stun.l.google.com:19302'};

var _localStreamElement = null,
    _remoteStreamElements = [],
    _roomId = '',
    _isStreaming = false,
    _localStream = null,
    _remoteStreams = [],
    _isDataChannelOpen = false,
    _disconnectedMessages = [],
    _owner = true,
    _pcs = [],
    _newConnectionCallback = null;

function WebRTC() {}

WebRTC.prototype = {
    startStream: function (type, callback) {
        // var configuration = {'iceServers': [DEFAULT_STUN_SERVER]};
        // var connection = {'optional': [{'RtpDataChannels': true }]};
        // var pc = new RTCPeerConnection(configuration, connection);

        var thisWebRTC = this;

        if (type === 'both' || type === 'media' || typeof type === undefined) {
            thisWebRTC._startLocalStream(function () {
                // pc.onaddstream = function (event) {
                //  _remoteStreams[0] = event.stream;
                //  attachMediaStream(_remoteStreamElements[0], _remoteStreams[0]);
                //  _isStreaming = true;
                // };

                // if (type == 'both' || typeof type === undefined) {
                //  dc1 = pc.createDataChannel('test', {'reliable': false});

                //  thisWebRTC._startDataChannel();
                // }

                thisWebRTC._makeConnection(callback);
            });
        }
        // } else if (type === 'data') {
        //     dc1 = pc.createDataChannel('test', {'reliable': false});
            
        //     thisWebRTC._startDataChannel();

        //     thisWebRTC._makeConnection(callback);
        // }
    },

    onMessage: function (callback) {
        //dc1.onmessage = callback;
    },

    send: function (message) {
        if (_isDataChannelOpen) {
            dc1.send(message);
        } else {
            _disconnectedMessages.push(message);
        }
    },

    setLocal: function (element) {
        _localStreamElement = document.getElementById(element);
    },

    addRemote: function (element) {
        _remoteStreamElements.push(document.getElementById(element));
    },

    pause: function () {
        pc1.removeStream(_localStream);
        this._updateDescription();
        _isStreaming = false;
    },

    isStreaming: function () {
        return paused;
    },

    resume: function () {
        pc1.addStream(_localStream);
        this._updateDescription();
        _isStreaming = true;
    },

    mute: function () {

    },

    getId: function () {
        return _roomId;
    },

    setId: function (roomId) {
        _owner = false;
        _roomId = roomId;
    },

    setIceServers: function (servers) {
        if (typeof servers === 'array') {
            _ice_servers = servers;
        } else {
            _ice_servers = [servers];
        }
    },

    isStreaming: function () {
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
            var i;
            for (i = 0;i < _disconnectedMessages.length;i++) {
                dc1.send(_disconnectedMessages[i]);
            }
        };
    },

    _makeConnection: function (callback, pc) {
        var thisWebRTC = this;

        socket.emit('join', {'id': _roomId});

        socket.on('joined', function (data) {
            client_id = data.client_id;
            id = data.id;

            console.log('joined');

            var i;
            for (i = 0;i < client_id;i++) {
                var configuration = {'iceServers': [DEFAULT_STUN_SERVER]};
                var connection = {'optional': [{'RtpDataChannels': true }]};
                _pcs[i] = new RTCPeerConnection(configuration, connection);

                var curNumConn = i;
                _pcs[i].onicecandidate = function (event) {
                    console.log('onicecandidate');
                    if (event.candidate) {
                        socket.emit('cand', {'client_id': i, 'from_client_id': client_id, 'cand': event.candidate, 'id': id});
                    }
                };

                _pcs[i].onaddstream = function (event) {
                    _remoteStreams[_remoteStreams.length] = event.stream;
                    attachMediaStream(_remoteStreamElements[_remoteStreamElements.length-1], _remoteStreams[_remoteStreams.length-1]);
                    _isStreaming = true;
                };

                _pcs[i].addStream(_localStream);

                thisWebRTC._updateDescription(_pcs[i], i);
            }

            callback(id);
        });

        socket.on('add_desc', function (data) {
            client_id = data.from_client_id;
            id = data.id;

            console.log('adddesc' + client_id);

            var owner = false;
            if (_pcs[client_id] === undefined) {
                var configuration = {'iceServers': [DEFAULT_STUN_SERVER]};
                var connection = {'optional': [{'RtpDataChannels': true }]};
                _pcs[client_id] = new RTCPeerConnection(configuration, connection);
                owner = true;
            }

            console.log('before');
            _pcs[client_id].addStream(_localStream);

            console.log('before2');
            _pcs[client_id].onaddstream = function (event) {
                _remoteStreams[_remoteStreams.length] = event.stream;
                attachMediaStream(_remoteStreamElements[_remoteStreamElements.length-1], _remoteStreams[_remoteStreams.length-1]);
                _isStreaming = true;
            };

            console.log('before3');
            var curNumConn = client_id;
            _pcs[client_id].onicecandidate = function (event) {
                console.log('onicecandidatehere');
                if (event.candidate) {
                    socket.emit('cand', {'client_id': client_id, 'from_client_id': data.client_id, 'cand': event.candidate, 'id': id});
                }
            };

            console.log('before4' + client_id);
            console.log(data);
            if (_pcs[client_id] !== undefined)
                _pcs[client_id].setRemoteDescription(new RTCSessionDescription(data.desc));
            console.log('after');

            _streaming = true;

            var curNumConn = client_id;
            console.log(curNumConn);

            console.log('before5');
            if (owner) {
                _pcs[curNumConn].createAnswer(function (desc) {
                    console.log('in here');
                    _pcs[curNumConn].setLocalDescription(desc);
                    console.log(data.client_id + " ---------------> " + data.from_client_id);
                    socket.emit('desc', {'client_id': data.from_client_id, 'from_client_id': data.client_id, 'desc': desc, 'id': id, 'numConn': curNumConn});
                });
            }

            _newConnectionCallback();
        });

        socket.on('add_cand', function (data) {
            console.log('test');
            console.log(new RTCIceCandidate(data.cand));
            console.log(data.client_id);
            _pcs[data.client_id].addIceCandidate(new RTCIceCandidate(data.cand));
        });
    },

    _updateDescription: function (pc, _client_id) {
        pc.createOffer(function (desc) {
            pc.setLocalDescription(desc);
            console.log(client_id + " ---------------> " + _client_id);
            socket.emit('desc', {'client_id': _client_id, 'from_client_id': client_id, 'desc': desc, 'id': id});
        }, null);
    },

    onConnection: function (callback) {
        _newConnectionCallback = callback;
    }
};

Y.WebRTC = WebRTC;

