/**
 * Mocks the RTCPeerConnection and DataChannel for unit testing purposes
 */

function RTCPeerConnection (configuration, connection) {}

RTCPeerConnection.prototype = {
    onaddstream: function() {},
    onicecandidate: function() {},
    addStream: function (stream) {

    },
    setRemoteDescription: function (desc) {

    },
    createAnswer: function (callback) {
        callback('testDescAnswer');
    },
    createOffer: function (callback) {
        callback('testDescOffer');
    },
    setLocalDescription: function (desc) {

    },
    addIceCandidate: function (cand) {

    },
    removeStream: function (stream) {

    },
    createDataChannel: function (name, options) {
        return new DataChannel();
    }
};

function DataChannel () {}

DataChannel.prototype = {
    onmessage: function (message) {},
    send: function (message) {
        this.onmessage();
    }
}
