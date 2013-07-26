YUI.add('webrtc-tests', function(Y) {

    var suite = new Y.Test.Suite("webrtc");
    var Assert = Y.Assert;

    suite.add(new Y.Test.Case({
        name: "WebRTC tests",

        setUp: function () {
            
        },

        "WebRTC should be able to start and get the video stream": function () {
            var webrtc1 = new Y.WebRTC();

            webrtc1.setLocal('vid11');

            var thisTest = this;

            webrtc1.startStream('both', function(id) {
                thisTest.resume(function () {
                    Assert.isTrue(webrtc1._getLocalStream().getVideoTracks().length > 0);
                });
            });

            this.wait();
        }, 

        "WebRTC should complete the handshake": function () {
            var webrtc1 = new Y.WebRTC();

            webrtc1.setLocal('vid11');

            var thisTest = this;

            var numStreams = 1;

            webrtc1.onConnection(function() {
                numStreams++;
                Y.one('#streams').append('<video id="vid1' + numStreams + '" width="400px" autoplay></video>');
                webrtc1.addRemote('vid1' + numStreams);
            });

            webrtc1.startStream('both', function(id) {
                thisTest.resume(function () {
                    var webrtc2 = new Y.WebRTC();

                    webrtc2.setLocal('vid21');

                    webrtc2.setId(id);

                    webrtc2.onConnection(function() {
                        numStreams++;
                        Y.one('#streams').append('<video id="vid2' + numStreams + '" width="400px" autoplay></video>');
                        webrtc1.addRemote('vid2' + numStreams);
                    });

                    webrtc2.startStream('both', function(id) {
                        thisTest.resume(function () {
                            Assert.isTrue(true);
                        });
                    });

                    thisTest.wait();
                });
            });

            this.wait();
        }
    }));
    Y.Test.Runner.add(suite);
}, '@VERSION@' ,{requires:['webrtc', 'test']});