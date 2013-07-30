/**
 * WebRTC module for YUI
 *
 */
function WebRTC() {}

WebRTC.prototype = {
    /**
     * This is the server that finds the external ip address when the client is behind a NAT
     */
    DEFAULT_STUN_SERVER: {'url': 'stun:stun.l.google.com:19302'},

    /**
     * The socket.io connection to the server that is used for handshaking between two clients.
     */
    _socket: io.connect('/'),

    /**
     * The video DOM element that displays the local video stream.
     */
    _localStreamElement: null,

    /**
     * The video DOM elements that display each external video stream.
     */
    _remoteStreamElements: [],

    /**
     * The local stream object recieved from getUserMedia
     */
    _localStream: null,

    /**
     * The remote stream objects recieved from the onaddstream callback of
     * the RTCPeerConnections.
     */
    _remoteStreams: [],

    /**
     * The room id that clients use to connect to each other.
     */
    _roomId: '',

    /**
     * This is true when there is video streaming out to external clients.
     */
    _isStreaming: false,

    /**
     * When a client calls "send" and the data channel hasn't been starts, we
     * save the messages in this array to be sent over when the data channel
     * starts.
     */
    _disconnectedMessages: [],

    /**
     * The RTCPeerConnection objects that correspond to each connection that is made
     * with a client.
     */
    _pcs: [],

    /**
     * The data channels that correspond to each RTCPeerConnection(_pcs). _dcs is for normal
     * messages and _file_dcs are specifically for file sharing.
     */
    _dcs: [],
    _file_dcs: [],

    /**
     * This is set to whatever function is passed through the onConnection method. It is
     * called when a new connection has been established.
     */
    _newConnectionCallback: null,

    /**
     * If a download has started, _downloadStatus will be the number of chunks that
     * remain to be recieved.
     */
    _downloadStatus: 0,

    /**
     * The actual data in the downloaded file. It is appended each time a chunk is
     * recieved.
     */
    _download: '',

    /**
     * The name of the file that is being recieved.
     */
    _downloadName: '',

    /**
     * Decides whether it should start the camera or not and then starts the connection.
     *
     * @param {String} type can be 'both', 'media', or 'data'. Defaults to 'both'.
     * @param {Function} callback Called after user has joined the room.
     */
    startStream: function (type, callback) {
        var thisWebRTC = this;

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
        for (i = 0;i < this._dcs.length;i++) {
            this._dcs[i].onmessage = callback;
        }
    },

    /**
     * Broadcasts a message to the room.
     *
     * @param message {String} The message to be broadcasted.
     * @param dc {Array} array of DataChannels to send the message to.
     */
    send: function (message, dcs) {
        dcs = dcs || _dcs;
        var i;
        for (i = 0;i < dcs.length;i++) {
            if (dcs[i] !== undefined) {
                dcs[i].send(message);
            } else {
                this._disconnectedMessages.push(message);
            }
        }
    },

    /**
     * Broadcasts a file download to the room given a file input element
     *
     * @param {String} id The id of the file input element.
     */
    sendFile: function (id) {
        var thisWebRTC = this,
            reader = new FileReader(),
            file = document.getElementById(id).files[0];

        reader.onload = function(e) {
            var filename = document.getElementById(id).value.split(/(\/|\\)/).pop(),
                size = file.size,
                chunkSize = 500,
                numChunks = Math.ceil(size / chunkSize),
                j = 0,
                i;

            thisWebRTC.sendChunk('start' + numChunks + ',' + filename);
            for (i = 0;i < numChunks;i++) {
                setTimeout(function() {
                    thisWebRTC.send(e.target.result.substring(j*chunkSize, j*chunkSize + chunkSize), _file_dcs);
                    j++;
                }, (i+1)*200);
            }
        };

        reader.readAsText(file);
    },

    /**
     * Sets the video element that will display the local video stream.
     *
     * @param {String} id The id of the video element.
     */
    setLocal: function (id) {
        this._localStreamElement = document.getElementById(id);
    },

    /**
     * Adds a video element to display remote streams. The remote stream that
     * will be displayed coresponds to the order at which they were added with
     * addRemote.
     *
     * @param {String} id The id of the video element.
     */
    addRemote: function (id) {
        this._remoteStreamElements.push(document.getElementById(id));
    },

    /**
     * Stops the peer connection from sending video data.
     */
    pause: function () {
        this._pcs[0].removeStream(this._localStream);
        this._updateDescription();
        this._isStreaming = false;
    },

    /**
     * Returns true if the local video is streaming.
     */
    isStreaming: function () {
        return _isStreaming;
    },

    /**
     * Resumes the stream by reinitiating the handshake and having the other peers start
     * streaming their video to the client.
     */
    resume: function () {
        this._pcs[0].addStream(this._localStream);
        this._updateDescription();
        this._isStreaming = true;
    },

    /**
     * Stops sending and recieving audio.
     */
    mute: function () {

    },

    /**
     * Gets the current room id.
     */
    getId: function () {
        return this._roomId;
    },

    /**
     * Sets the room id. Used before calling the startStream method to join an existing
     * room or create a room with a specific id.
     *
     * @param roomId {String} the id of the room.
     */
    setId: function (roomId) {
        this._roomId = roomId;
    },

    /**
     * Sets the ice servers. The default is stun:stun.l.google.com:19302
     *
     * servers {Array} The desired ice servers
     */
    setIceServers: function (servers) {
        if (typeof servers === 'array') {
            _ice_servers = servers;
        } else {
            _ice_servers = [servers];
        }
    },

    /**
     * Gets the local video stream
     */
    _getLocalStream: function () {
        return this._localStream;
    },

    /**
     * Gets the remote video streams.
     */
    _getRemoteStreams: function () {
        return this._remoteStreams;
    },

    /**
     * Requests the video stream from the browser, stores the stream, and attaches
     * the stream to the video element.
     */
    _startLocalStream: function (callback) {
        thisWebRTC = this;
        getUserMedia({audio: true, video: true}, function (stream) {
            thisWebRTC._localStream = stream;

            attachMediaStream(thisWebRTC._localStreamElement, thisWebRTC._localStream);

            callback();
        });
    },

    /**
     * Creates and starts an unreliable data channel.
     *
     * NOTE: Data channel is currently implemented in browsers as UDP-esque messages.
     * A version with SCTP will be releasing on the stable build of chrome in the next few
     * release cycles. It is currently in canary as a flag.
     */
    _startDataChannel: function (id) {
        thisWebRTC = this;

        this._dcs[id] = this._pcs[id].createDataChannel('data', {'reliable': false});
        this._file_dcs[id] = this._pcs[id].createDataChannel('file', {'reliable': false});

        if (this._dcs[0] !== undefined && this._dcs[0].onmessage !== undefined) {
            this._file_dcs[id].onmessage = function(message) {
                if (thisWebRTC._downloadStatus > 0) {
                    thisWebRTC._download += message.data;

                    thisWebRTC._downloadStatus--;

                    if (thisWebRTC._downloadStatus === 0) {
                        uriContent = "data:application/octet-stream," + encodeURIComponent(this._download);
                        
                        Y.one('body').append('<a style="position:absolute;display:none" id="webrtc-file-download" href="' +
                            uriContent + '" download="' + this._downloadName + '"></a>');
                        Y.one('#webrtc-file-download').simulate('click');
                        
                        thisWebRTC._download = '';
                    }
                } else {
                    if (message.data.substring(0, 5) === 'start') {
                        var splitComma = message.data.indexOf(',');
                        thisWebRTC._downloadStatus = parseInt(message.data.substring(5, splitComma), 10);
                        thisWebRTC._downloadName = message.data.substring(splitComma+1);
                    }
                }
            };
        } else {
            this._file_dcs[id].onmessage = function(message) {
                var splitComma = message.data.indexOf(","),
                    filename = message.data.substring(0, splitComma),
                    filedata = message.data.substring(splitComma+1);
                uriContent = "data:application/octet-stream; filename=" + filename + "," + encodeURIComponent(filedata);
                location.href = uriContent;
            };
        }

        this._dcs[id].onopen = function () {
            _isDataChannelOpen = true;
            var i;
            for (i = 0;i < thisWebRTC._disconnectedMessages.length;i++) {
                thisWebRTC._dcs[id].send(thisWebRTC._disconnectedMessages[i], _dcs);
            }
        };
    },

    /**
     * Creates a connection between two peer connections, starts a datachannel, adds the localStream,
     * and starts the handshake.
     *
     * @param id2 {String} the id of the remote peer connection
     * @param id {String} the id of the local peer connection
     */
    _createConn: function(id2, id) {
        var configuration = {'iceServers': [this.DEFAULT_STUN_SERVER]},
            connection = {'optional': [{'RtpDataChannels': true }]};
        this._pcs[id] = new RTCPeerConnection(configuration, connection);
        this._startDataChannel(id);

        this._pcs[id].addStream(this._localStream);

        this._updateDescription(this._pcs[id], id2, id);
    },

    /**
     * Handles the web socket connection between the server.
     *
     * @param callback {function} the function that will be called when this instance has joined
     * the room
     *
     * @param pc {RTCPeerConnection} the RTCPeerConnection to be used when making the connection
     */
    _makeConnection: function (callback) {
        var thisWebRTC = this;

        this._socket.on('joined', function (data) {
            client_id = data.client_id;
            id = data.id;

            if (client_id !== 0) {
                thisWebRTC._createConn(client_id, 0);
            }

            callback(id);
        });

        this._socket.on('add_desc', function (data) {
            client_id = data.from_client_id;
            
            id = data.id;

            console.log(data.client_id + " <------ " + client_id);

            var owner = false;

            if (thisWebRTC._pcs[client_id] === undefined) {
                var configuration = {'iceServers': [thisWebRTC.DEFAULT_STUN_SERVER]},
                    connection = {'optional': [{'RtpDataChannels': true }]};

                thisWebRTC._pcs[client_id] = new RTCPeerConnection(configuration, connection);
                thisWebRTC._startDataChannel(client_id);
                owner = true;

                if (thisWebRTC._localStream) {
                    thisWebRTC._pcs[client_id].addStream(thisWebRTC._localStream);
                }
            }

            thisWebRTC._pcs[client_id].onaddstream = function (event) {
                thisWebRTC._remoteStreams[thisWebRTC._remoteStreams.length] = event.stream;
                attachMediaStream(thisWebRTC._remoteStreamElements[thisWebRTC._remoteStreamElements.length-1],
                    thisWebRTC._remoteStreams[thisWebRTC._remoteStreams.length-1]);
                thisWebRTC._isStreaming = true;
            };

            thisWebRTC._pcs[client_id].onicecandidate = function (event) {
                if (event.candidate) {
                    thisWebRTC._socket.emit('cand', {'client_id': client_id, 'from_client_id': data.client_id, 'cand': event.candidate, 'id': id});
                }
            };

            thisWebRTC._pcs[client_id].setRemoteDescription(new RTCSessionDescription(data.desc));

            _streaming = true;

            if (owner) {
                thisWebRTC._pcs[client_id].createAnswer(function (desc) {
                    thisWebRTC._pcs[client_id].setLocalDescription(desc);

                    console.log(data.client_id + " ------> " + data.from_client_id);

                    thisWebRTC._socket.emit('desc', {'client_id': data.from_client_id, 'from_client_id': data.client_id, 'desc': desc, 'id': id});
                });
            }

            thisWebRTC._newConnectionCallback();

            if (!owner) {
                if (data.client_id > client_id+1) {
                    thisWebRTC._createConn(data.client_id, client_id+1);
                }
            }
        });

        this._socket.on('add_cand', function (data) {
            if (thisWebRTC._pcs[data.client_id] === undefined) {
                if (cands[data.client_id] === undefined) {
                    cands[data.client_id] = [];
                }
                cands[data.client_id].push(data.cand);
            } else {
                thisWebRTC._pcs[data.client_id].addIceCandidate(new RTCIceCandidate(data.cand));
            }
        });

        this._socket.emit('join', {'id': this._roomId});
    },

    /**
     * Sends the media parameters via SDP with the pc.
     *
     * @param pc {RTCPeerConnection} the peer connection
     *
     */
    _updateDescription: function (pc, client_id2, _client_id) {
        thisWebRTC = this;
        pc.createOffer(function (desc) {
            pc.setLocalDescription(desc);
            console.log(client_id2 + " ------> " + _client_id);
            thisWebRTC._socket.emit('desc', {'client_id': _client_id, 'from_client_id': client_id2, 'desc': desc, 'id': id});
        }, null);
    },

    onConnection: function (callback) {
        this._newConnectionCallback = callback;
    }
};

Y.WebRTC = WebRTC;