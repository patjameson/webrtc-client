//This simulates the server. Much of the io code here is taken from
//the webrtc-server code.
function io() {}

var sessions = {},
    sockets = {};

io.prototype = {
    connect: function () {
        return this;
    },

    //Instead of doing .emit after this mock server gets a message, 
    //these callbacks will be called.
    joinedCallback: function () {},
    addDescCallback: function () {},
    addCandCallback: function () {},

    on: function(message, callback) {
        if (message == 'joined') {
            this.joinedCallback = callback;
        } else if (message == 'add_desc') {
            this.addDescCallback = callback;
        } else if (message = 'add_cand') {
            this.addCandCallback = callback;
        }
    },

    emit: function(message, data) {
        if (message == 'join') {
            if (data.id !== '' && sockets[data.id] !== undefined) {
                client_id = sockets[data.id].length;
                id = data.id;
            } else {
                var id;
                do {
                    id = Math.floor(Math.random()*1000000);
                } while (id in sockets);

                client_id = 0;
                sockets[id] = [];
            }

            function callbacks() {}

            thisWebRTC = this;

            callbacks.prototype = {
                joinedCallback: thisWebRTC.joinedCallback,
                addDescCallback: thisWebRTC.addDescCallback,
                addCandCallback: thisWebRTC.addCandCallback
            }

            sockets[id].push(new callbacks());
            this.joinedCallback({'id': id, 'client_id': client_id});
        } else if (message == 'desc') {
            sockets[data.id][data.client_id].addDescCallback(data);
        } else if (message == 'cand') {
            sockets[data.id][data.client_id].addCandCallback({'cand': data.cand, 'client_id': data.from_client_id});
        }
    }
}

io = new io();