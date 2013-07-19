/**
 * WebRTC module for YUI
 *
 */

var socket = io.connect('/');
var sessions, pc1, id, dc1, clientId = -1;

var DEFAULT_STUN_SERVER = {'url': 'stun:stun.l.google.com:19302'};

var _localStreamElement = null,
    _remoteStreamElements = [],
    _roomId = '',
    _isStreaming = false,
    _localStream = null,
    _remoteStreams = [],
    _disconnectedMessages = [],
    _pcs = [],
    _dcs = [],
    _newConnectionCallback = null,
    _type = 'both',
    _downloadStatus = 0
    _download = '',
    _downloadName = '';

function WebRTC() {}

WebRTC.prototype = {
    /**
     * Decides whether it should start the camera or not and then starts the connection.
     *  
     * @param {String} type Can be 'both', 'media', or 'data'. Defaults to 'both'.
     * @param {Function} callback Called after user has joined the room.
     */
    startStream: function (type, callback) {
        var thisWebRTC = this;
        _type = type | _type;

        if (type === 'both' || type === 'media' || typeof type === undefined) {
            thisWebRTC._startLocalStream(function () {
                thisWebRTC._makeConnection(callback);
            });
        } else {
            thisWebRTC._makeConnection(callback);
        }
    },

    /**
     * Sets the callback for the datachannels.
     * 
     * @param {Function} callback The function to called when a message is broadcasted to the channel.
     */
    onMessage: function (callback) {
        var i;
        for (i = 0;i < _dcs.length;i++) {
            _dcs[i].onmessage = callback;
        }
    },

    /**
     * Broadcasts a message to the room.
     *
     * @param {String} message The message to be broadcasted.
     */
    send: function (message) {
        var i;
        for (i = 0;i < _dcs.length;i++) {
            if (_dcs[i] !== undefined) {
                _dcs[i].send(message);
                console.log('test');
            } else {
                _disconnectedMessages.push(message);
            }
        }
    },

    /**
     * Broadcasts a file download to the room given a file input element
     *
     * @param {String} id The id of the file input element.
     */
    sendFile: function (id) {
        var thisWebRTC = this;
        var reader = new FileReader();
        var file = document.getElementById(id).files[0];
        reader.onload = function(e) {
            var filename = document.getElementById(id).value.split(/(\/|\\)/).pop();
            var size = file.size;
            var chunkSize = 500;
            var numChunks = Math.ceil(size / chunkSize);
            thisWebRTC.send('start' + numChunks + ',' + filename);
            var j = 0;
            for (var i = 0;i < numChunks;i++) {
                setTimeout(function() {
                    thisWebRTC.send(e.target.result.substring(j*chunkSize, j*chunkSize + chunkSize));
                    j++;
                }, (i+1)*200);
            }
        }
        reader.readAsText(file);
    },

    /**
     * Sets the video element that will display the local video stream.
     *
     * @param {String} id The id of the video element.
     */
    setLocal: function (id) {
        _localStreamElement = document.getElementById(id);
    },

    /**
     * Adds a video element to display remote streams. The remote stream that
     * will be displayed coresponds to the order at which they were added with
     * addRemote.
     *
     * @param {String} id The id of the video element.
     */
    addRemote: function (id) {
        _remoteStreamElements.push(document.getElementById(id));
    },

    /**
     * Stops the peer connection from sending video data.
     */
    pause: function () {
        pc1.removeStream(_localStream);
        this._updateDescription();
        _isStreaming = false;
    },

    /**
     * 
     */
    isStreaming: function () {
        return paused;
    },

    /**
     *
     */
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
                if (_downloadStatus > 0) {
                    console.log(_downloadStatus);

                    _download += message.data;

                    _downloadStatus--;

                    if (_downloadStatus == 0) {
                        uriContent = "data:application/octet-stream," + encodeURIComponent(_download);
                        
                        Y.one('body').append('<a style="position:absolute;display:none" id="webrtc-file-download" href="' + uriContent + '" download="' + _downloadName + '"></a>');
                        Y.one('#webrtc-file-download').simulate('click');
                        
                        _download = '';
                    }
                } else {
                    if (message.data.substring(0, 5) === 'start') {
                        var splitComma = message.data.indexOf(',');
                        _downloadStatus = parseInt(message.data.substring(5, splitComma));
                        _downloadName = message.data.substring(splitComma+1);
                        console.log(_downloadStatus + " " + _downloadName);
                    }
                }
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

    _createConn: function(id2, id) {
        var configuration = {'iceServers': [DEFAULT_STUN_SERVER]};
        var connection = {'optional': [{'RtpDataChannels': true }]};
        _pcs[id] = new RTCPeerConnection(configuration, connection);
        this._startDataChannel(id);

        _pcs[id].addStream(_localStream);

        this._updateDescription(_pcs[id], id2, id);
    },

    _makeConnection: function (callback, pc) {
        var thisWebRTC = this;

        socket.emit('join', {'id': _roomId});

        socket.on('joined', function (data) {
            client_id = data.client_id;
            id = data.id;

            if (client_id != 0) {
                thisWebRTC._createConn(client_id, 0);
            }

            callback(id);
        });

        socket.on('add_desc', function (data) {
            client_id = data.from_client_id;
            
            id = data.id;

            console.log(data.client_id + " <------ " + client_id);

            var owner = false;
            if (_pcs[client_id] === undefined) {
                console.log('craeting one for, ' + client_id);
                var configuration = {'iceServers': [DEFAULT_STUN_SERVER]};
                var connection = {'optional': [{'RtpDataChannels': true }]};
                _pcs[client_id] = new RTCPeerConnection(configuration, connection);
                thisWebRTC._startDataChannel(client_id);
                owner = true;

                if (_localStream) {
                    _pcs[client_id].addStream(_localStream);
                }
            }

            _pcs[client_id].onaddstream = function (event) {
                console.log('2');
                _remoteStreams[_remoteStreams.length] = event.stream;
                attachMediaStream(_remoteStreamElements[_remoteStreamElements.length-1], _remoteStreams[_remoteStreams.length-1]);
                _isStreaming = true;
            };

            _pcs[client_id].onicecandidate = function (event) {
                if (event.candidate) {
                    socket.emit('cand', {'client_id': client_id, 'from_client_id': data.client_id, 'cand': event.candidate, 'id': id});
                }
            };

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

            _newConnectionCallback();
            console.log(data.client_id + " " + (client_id+1));

            if (!owner) {
                if (data.client_id > client_id+1) {
                    thisWebRTC._createConn(data.client_id, client_id+1);
                }
            }
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

    _updateDescription: function (pc, client_id2, _client_id) {
        pc.createOffer(function (desc) {
            pc.setLocalDescription(desc);
            console.log(client_id2 + " ------> " + _client_id);
            socket.emit('desc', {'client_id': _client_id, 'from_client_id': client_id2, 'desc': desc, 'id': id});
        }, null);
    },

    onConnection: function (callback) {
        _newConnectionCallback = callback;
    }
};

Y.WebRTC = WebRTC;

