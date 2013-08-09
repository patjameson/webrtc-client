var RTCPeerConnection = window.webkitRTCPeerConnection || window.mozRTCPeerConnection,
    RTCSessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription,
    RTCIceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate,
    getUserMedia = null,
    firefox = false,
    chrome = true;

    attachMediaStream = function(element, stream) {
        if (element == null) {
            throw new Error('The video element provided does not seem to exist. Stream can not be attached.');
        } else {
            if (element.srcObject !== undefined) {
                element.srcObject = stream;
            } else if (element.mozSrcObject !== undefined) {
                element.mozSrcObject = stream;
            } else if (element.src !== undefined) {
                element.src = URL.createObjectURL(stream);
            }
            element.play();
        }
    };

if (navigator.webkitGetUserMedia !== undefined) {
    chrome = true;
    getUserMedia = navigator.webkitGetUserMedia.bind(navigator);
} else if (navigator.mozGetUserMedia !== undefined) {
    firefox = true;
    getUserMedia = navigator.mozGetUserMedia.bind(navigator);
}
