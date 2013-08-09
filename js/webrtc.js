/**
 * WebRTC module for YUI
 *
 */
function WebRTC(config) {
    WebRTC.superclass.constructor.apply(this, arguments);
}

WebRTC.NAME = 'webrtc';

Y.extend(WebRTC, Y.Base, {
    /**
     * This is the server that finds the external ip address when the client is behind a NAT
     */
    DEFAULT_STUN_SERVER: {'url': 'stun:stun.l.google.com:19302'},

    /**
     * The socket.io connection to the server that is used for handshaking between two clients.
     */
    _socket: io.connect('/'),

    /**
     * The type of connection this will be.
     *
     * @param type {String} Either media, data, or both.
     */
    _type: '',

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
    _newConnectionCallback: function () {},

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
     * @param type {String} Can be 'both', 'media', or 'data'. Defaults to 'both'.
     * @param callback {Function} Called after user has joined the room.
     */
    startStream: function (type, callback) {
        var thisWebRTC = this;

        this._type = type;

        if (type === 'both' || type === 'media' || typeof type === undefined) {
            thisWebRTC._startLocalStream(function () {
                thisWebRTC._makeConnection(callback);
            });
        } else {
            thisWebRTC._makeConnection(callback);
        }
    },

    /**
     * Broadcasts a message to the room.
     *
     * @param message {String} The message to be broadcasted.
     * @param dcs {Array} array of DataChannels to send the message to.
     */
    send: function (message, dcs) {
        dcs = dcs || this._dcs;
        var i;
        for (i = 0;i < dcs.length;i++) {
            console.log(message);
            if (dcs[i] !== undefined) {
                dcs[i].send(message);
            }
        }
    },

    /**
     * Broadcasts a file download to the room given a file input element
     *
     * @param id {String} The id of the file input element.
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

            thisWebRTC.send('start' + numChunks + ',' + filename, thisWebRTC._file_dcs);
            for (i = 0;i < numChunks;i++) {
                setTimeout(function() {
                    thisWebRTC.send(e.target.result.substring(j*chunkSize, j*chunkSize + chunkSize), thisWebRTC._file_dcs);
                    j++;
                }, (i+1)*200);
            }
        };

        reader.readAsText(file);
    },

    /**
     * Sets the video element that will display the local video stream.
     *
     * @param id {String} The id of the video element.
     */
    setLocal: function (id) {
        this._localStreamElement = document.getElementById(id);
    },

    /**
     * Adds a video element to display remote streams. The remote stream that
     * will be displayed coresponds to the order at which they were added with
     * addRemote.
     *
     * @param id {String} The id of the video element.
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
        var thisWebRTC = this;
        getUserMedia({audio: false, video: true}, function (stream) {
            thisWebRTC._localStream = stream;

            attachMediaStream(thisWebRTC._localStreamElement, thisWebRTC._localStream);

            callback();
        }, function(error) {
            console.log('Error getting media device');
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
        var thisWebRTC = this;
        
        this._file_dcs[id] = this._pcs[id].createDataChannel('file', {'reliable': false});

        this._file_dcs[id].onmessage = function(message) {
            console.log('test');
            console.log(message);
            if (thisWebRTC._downloadStatus > 0) {
                thisWebRTC._download += message.data;

                thisWebRTC._downloadStatus--;

                if (thisWebRTC._downloadStatus === 0) {
                    //TODO XSS (download name and content) Y.escape
                    uriContent = "data:application/octet-stream," + encodeURIComponent(thisWebRTC._download);
                    
                    Y.one('body').append('<a style="position:absolute;display:none" id="webrtc-file-download" href="' +
                        uriContent + '" download="' + thisWebRTC._downloadName + '"></a>');
                    Y.one('#webrtc-file-download').simulate('click');
                    Y.one('#webrtc-file-download').remove();
                    
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

        this._dcs[id] = this._pcs[id].createDataChannel('data', {'reliable': false});
        
        this._dcs[id].onmessage = function (message) {
            console.log('here');
            thisWebRTC.fire('message', {
                message: message.data
            });
        }
    },

    /**
     * Creates a connection between two peer connections, starts a datachannel, and adds the localStream.
     *
     * @param id {String} the id of the local peer connection
     */
    _createConn: function(id) {
        var configuration = {'iceServers': [this.DEFAULT_STUN_SERVER]},
            connection = null;

        connection = {'optional': [{'RtpDataChannels': true}], 'mandatory': {
            'OfferToReceiveAudio': true,
            'OfferToReceiveVideo': true,
            'MozDontOfferDataChannel': true
        }};

        this._pcs[id] = new RTCPeerConnection(configuration, connection);
        if (this._type !== 'media') {
            this._startDataChannel(id);
        }

        //this will only exist if the user chooses 'media' or 'both'
        if (this._localStream) {
            this._pcs[id].addStream(this._localStream);
        }
    },

    /**
     * Handles the handshaking with the other client through a server, communicating with the server
     * via WebSockets.
     *
     * WebRTC Ordering:
     * The ordering of the WebRTC handshake is extremely important for a connection to be successful. 
     * The following is the order that this script uses to make a connection. We will use client1 and 
     * client2 as the names of two web browsers trying to connect to each other.
     * 
     * 1. client1 creates an RTCPeerConnection object
     * 2. client1 adds its video stream using RTCPeerConnection.addStream() [if desired]
     * 3. client1 calls RTCPeerConnection.createOffer(), which gives client1 a description
     *    of its media capabilities (SDP)
     * 4. client1 sends the description to client2 through any means (this script is using
     *    WebSockets currently)
     * 5. client2 creates an RTCPeerConnection object
     * 6. client2 adds its video stream using RTCPeerConnection.addStream() [if desired]
     * 7. client2 sets client1's description as its remote description using
     *    RTCPeerConnection.setRemoteDescription()
     * 8. As soon as the remote description is set, ICECandidates start being generated by client2.
     *    These ICECandidates are sent over to client1 similarly to how the descriptions were sent.
     * 9. When client1 recieves the ICECandidates, it calls RTCPeerConnection.addIceCandidate() for
     *    each candidate.
     * 10. client2 calls RTCPeerConnection.createAnswer(), which gives client2 its own description
     * 11. client2 sends the description to client1 through any means (this script is using
     *    WebSockets currently)
     * 12. client1 sets client2's description as its remote description using
     *    RTCPeerConnection.setRemoteDescription()
     * 13. As soon as the remote description is set, ICECandidates start being generated by client1.
     *    These ICECandidates are sent over to client2 similarly to how the descriptions were sent.
     * 14. When client2 recieves the ICECandidates, it calls RTCPeerConnection.addIceCandidate() for
     *    each candidate.
     * 15. Connection complete!
     *
     * Connection Chaining:
     * If you are joining a room with more than one other client, you can not reliably call createOffer
     * to every client at the same time. The connections sometimes fail. To solve this, _makeConnection
     * waits for the onaddstream method to fire before starting to connect to the next client.
     *
     * @param callback {function} will be called after successfully joining the room
     */
    _makeConnection: function (callback) {
        var thisWebRTC = this;

        //the server calls this to signify that it knows what room this client is in.
        this._socket.on('joined', function (data) {
            client_id = data.client_id;
            id = data.id;

            //this is where the connection 'chaining' starts.
            if (client_id !== 0) {
                thisWebRTC._createConn(0);
                thisWebRTC._updateDescription(thisWebRTC._pcs[0], client_id, 0);
            }

            callback(id);
        });

        this._socket.on('add_desc', function (data) {
            var client_id = data.from_client_id,
                id = data.id,
                owner = false;

            console.log(data.client_id + " <------ " + client_id);

            if (thisWebRTC._pcs[client_id] === undefined) {
                thisWebRTC._createConn(client_id);
                owner = true;
            }

            //called when we recieve the stream from the other client
            thisWebRTC._pcs[client_id].onaddstream = function (event) {
                thisWebRTC.fire('newConnection');

                thisWebRTC._remoteStreams[thisWebRTC._remoteStreams.length] = event.stream;

                attachMediaStream(thisWebRTC._remoteStreamElements[thisWebRTC._remoteStreamElements.length-1], event.stream);

                thisWebRTC._isStreaming = true;

                //move on to the connecting to the next client if there are more clients.
                if (data.client_id > client_id + 1) {
                    thisWebRTC._createConn(client_id + 1);
                    thisWebRTC._updateDescription(thisWebRTC._pcs[client_id + 1], data.client_id, client_id + 1);
                }
            };

            //called when we recieve an ice candidate from the other client
            thisWebRTC._pcs[client_id].onicecandidate = function (event) {
                if (event.candidate) {
                    thisWebRTC._socket.emit('cand', {
                        'client_id': client_id,
                        'from_client_id': data.client_id,
                        'cand': event.candidate,
                        'id': id
                    });
                }
            };

            thisWebRTC._pcs[client_id].setRemoteDescription(new RTCSessionDescription(data.desc));

            if (owner) {
                thisWebRTC._pcs[client_id].createAnswer(function (desc) {
                    thisWebRTC._pcs[client_id].setLocalDescription(desc);

                    console.log(data.client_id + " ------> " + data.from_client_id);
                    thisWebRTC._socket.emit('desc', {
                        'client_id': data.from_client_id,
                        'from_client_id': data.client_id,
                        'desc': desc,
                        'id': id
                    });
                });
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

        //tell the server what room to join.
        this._socket.emit('join', {
            'id': this._roomId
        });
    },

    /**
     * Sends the media parameters via SDP with the pc.
     *
     * @param pc {RTCPeerConnection} the peer connection
     *
     */
    _updateDescription: function (pc, client_id2, _client_id) {
        var thisWebRTC = this;
        pc.createOffer(function (desc) {
            pc.setLocalDescription(desc);
            console.log(client_id2 + " ------> " + _client_id);
            thisWebRTC._socket.emit('desc', {
                'client_id': _client_id,
                'from_client_id': client_id2,
                'desc': desc,
                'id': id
            });
        }, null);
    },
});

Y.WebRTC = WebRTC;
