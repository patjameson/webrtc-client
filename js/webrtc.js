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
    _dcs = [],
    _newConnectionCallback = null,
    cands = [];

function WebRTC() {}

WebRTC.prototype = {
    startStream: function (type, callback) {
        // var configuration = {'iceServers': [DEFAULT_STUN_SERVER]};
        // var connection = {'optional': [{'RtpDataChannels': true }]};
        // var pc = new RTCPeerConnection(configuration, connection);

        var thisWebRTC = this;

        if (type === 'both' || type === 'media' || typeof type === undefined) {
            thisWebRTC._startLocalStream(function () {

                thisWebRTC._makeConnection(callback);
            });
        }
    },

    onMessage: function (callback) {
        var i;
        for (i = 0;i < _dcs.length;i++) {
            _dcs[i].onmessage = callback;
        }
    },

    send: function (message) {
        var i;
        for (i = 0;i < _dcs.length;i++) {
            if (_dcs[i] !== undefined) {
                _dcs[i].send(message);
            } else {
                _disconnectedMessages.push(message);
            }
        }
    },

    sendFile: function (id) {
        var thisWebRTC = this;
        var reader = new FileReader();
        reader.onload = function(e) {
            var filename = document.getElementById(id).value.split(/(\/|\\)/).pop();
            thisWebRTC.send(filename + "," + e.target.result);
        }
        reader.readAsText(document.getElementById(id).files[0]);
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

    _startDataChannel: function (id) {
        _dcs[id] = _pcs[id].createDataChannel('test', {'reliable': false});
        if (_dcs[0] !== undefined && _dcs[0].onmessage !== undefined) {
            _dcs[id].onmessage = function(message) {
                var splitComma = message.data.indexOf(",");
                var filename = message.data.substring(0, splitComma);
                var filedata = message.data.substring(splitComma+1);
                uriContent = "data:application/octet-stream; filename=" + filename + "," + encodeURIComponent(filedata);
                location.href = uriContent;
            };
        } else {
            _dcs[id].onmessage = function(message) {
                var splitComma = message.data.indexOf(",");
                var filename = message.data.substring(0, splitComma);
                var filedata = message.data.substring(splitComma+1);
                uriContent = "data:application/octet-stream; filename=" + filename + "," + encodeURIComponent(filedata);
                location.href = uriContent;
            };
        }

        _dcs[id].onopen = function () {
            _isDataChannelOpen = true;
            var i;
            for (i = 0;i < _disconnectedMessages.length;i++) {
                _dcs[id].send(_disconnectedMessages[i]);
            }
        };
    },

    _makeConnection: function (callback, pc) {
        var thisWebRTC = this;

        socket.emit('join', {'id': _roomId});

        socket.on('joined', function (data) {
            client_id = data.client_id;
            id = data.id;

            var i;
            for (i = 0;i < client_id;i++) {
                var configuration = {'iceServers': [DEFAULT_STUN_SERVER]};
                var connection = {'optional': [{'RtpDataChannels': true }]};
                _pcs[i] = new RTCPeerConnection(configuration, connection);
                thisWebRTC._startDataChannel(i);

                _pcs[i].onicecandidate = function (event) {
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

            console.log(data.client_id + " <------ " + client_id);

            var owner = false;
            if (_pcs[client_id] === undefined) {
                var configuration = {'iceServers': [DEFAULT_STUN_SERVER]};
                var connection = {'optional': [{'RtpDataChannels': true }]};
                _pcs[client_id] = new RTCPeerConnection(configuration, connection);
                thisWebRTC._startDataChannel(client_id);
                owner = true;
            }

            _pcs[client_id].addStream(_localStream);

            _pcs[client_id].onaddstream = function (event) {
                _remoteStreams[_remoteStreams.length] = event.stream;
                attachMediaStream(_remoteStreamElements[_remoteStreamElements.length-1], _remoteStreams[_remoteStreams.length-1]);
                _isStreaming = true;
            };

            _pcs[client_id].onicecandidate = function (event) {
                if (event.candidate) {
                    socket.emit('cand', {'client_id': client_id, 'from_client_id': data.client_id, 'cand': event.candidate, 'id': id});
                }
            };

            if (_pcs[client_id] !== undefined)
                _pcs[client_id].setRemoteDescription(new RTCSessionDescription(data.desc));

            _streaming = true;

            if (owner) {
                console.log('owner');
                _pcs[client_id].createAnswer(function (desc) {
                    _pcs[client_id].setLocalDescription(desc);
                    console.log(data.client_id + " ------> " + data.from_client_id);
                    socket.emit('desc', {'client_id': data.from_client_id, 'from_client_id': data.client_id, 'desc': desc, 'id': id});
                });
            }

            var i;
            if (cands[client_id] !== undefined) console.log('numcand' + cands[client_id].length);
            for (i = 0;cands[client_id] !== undefined && i < cands[client_id].length;i++) {
                _pcs[client_id].addIceCandidate(new RTCIceCandidate(cands[i]));
            }

            _newConnectionCallback();
        });

        socket.on('add_cand', function (data) {
            if (_pcs[data.client_id] === undefined) {
                if (cands[data.client_id] === undefined) cands[data.client_id] = [];
                cands[data.client_id].push(data.cand);
            } else {
                _pcs[data.client_id].addIceCandidate(new RTCIceCandidate(data.cand));
            }
        });
    },

    _updateDescription: function (pc, _client_id) {
        pc.createOffer(function (desc) {
            pc.setLocalDescription(desc);
            console.log(client_id + " ------> " + _client_id);
            socket.emit('desc', {'client_id': _client_id, 'from_client_id': client_id, 'desc': desc, 'id': id});
        }, null);
    },

    onConnection: function (callback) {
        _newConnectionCallback = callback;
    }
};

Y.WebRTC = WebRTC;

