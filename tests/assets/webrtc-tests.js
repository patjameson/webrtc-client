YUI.add('webrtc-tests', function(Y) {

    var suite = new Y.Test.Suite("webrtc");
    var Assert = Y.Assert;

    suite.add(new Y.Test.Case({
        name: "WebRTC tests",

        setUp: function () {
            
        },

        "WebRTC should be able to start and get the video stream": function () {
            var webrtc1 = new Y.WebRTC(),
                thisTest = this;

            webrtc1.setLocal('vid11');

            webrtc1.startStream('both', function(id) {
                thisTest.resume(function () {
                    Assert.isTrue(webrtc1._getLocalStream().getVideoTracks().length > 0);
                });
            });

            this.wait();
        },

/*        "WebRTC should complete the handshake": function () {
            var webrtc1 = new Y.WebRTC(),
                webrtc2 = new Y.WebRTC(),
                thisTest = this,
                numStreams1 = 1;

            webrtc1.setLocal('vid11');
            
            webrtc1.onConnection(function () {
                thisTest.resume(function () {
                    numStreams1++;
                    Y.one('#streams').append('<video id="vid1' + numStreams1 + '" width="400px" autoplay></video>');
                    webrtc1.addRemote('vid1' + numStreams1);

                    //checking to make sure there are video tracks for each of the video elements,
                    //indicating that the handshake was successful.
                    Assert.isTrue(webrtc1._getLocalStream().getVideoTracks().length > 0 &&
                        webrtc2._getLocalStream().getVideoTracks().length > 0 &&
                        webrtc1._getRemoteStreams()[0].getVideoTracks().length > 0 &&
                        webrtc2._getRemoteStreams()[0].getVideoTracks().length > 0);
                });
            });

            webrtc1.startStream('both', function(id) {
                    webrtc2.setLocal('vid21');

                    webrtc2.setId(id);

                    var numStreams2 = 1;

                    webrtc2.onConnection(function() {
                        numStreams2++;
                        Y.one('#streams').append('<video id="vid2' + numStreams2 + '" width="400px" autoplay></video>');
                        webrtc2.addRemote('vid2' + numStreams2);
                    });

                    webrtc2.startStream('both', function(id) {
                    });
            });

            this.wait();
        }
*/
        "send": function () {
            //create some peerConnections with DataChannels
            var webrtc1 = new WebRTC();
             
        },
        "sendFile": function () {

        },
        "setLocal": function () {

        },
        "addRemote": function () {

        },
        "pause": function () {

        },
        "resume": function () {

        },
        "isStreaming": function () {

        },
        "mute/unmute": function () {

        },
        "getId/setId": function () {

        },
        "setIceServers": function () {

        },
        "_getLocalStream": function () {

        },
        "_getRemoteStreams": function () {

        },
        "_startLocalStream": function () {

        },
        "_startDataChannel": function () {

        },
        "_createConn": function () {

        },
        "_makeConnection": function () {

        },
        "_updateDescription": function () {

        }
    }));

    'WebR
    Y.Test.Runner.add(suite);
}, '@VERSION@' ,{requires:['webrtc', 'test']});
