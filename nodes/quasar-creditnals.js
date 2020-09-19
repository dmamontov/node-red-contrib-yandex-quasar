const Quasar = require('../lib/quasar.js');

module.exports = function(RED) {
    function creditnals(config) {
        RED.nodes.createNode(this, config);

        this.username = config.login;
        this.password = config.password;

        this.connected = false;
        this.connecting = false;
        this.closing = false;

        this.registeredNodes = {};

        let node = this;

        this.register = function(callNode) {
            node.registeredNodes[callNode.id] = callNode;

            if (Object.keys(node.registeredNodes).length === 1) {
                node.connect();
            }
        };

        this.deregister = function(callNode, done) {
            delete node.registeredNodes[callNode.id];
            if (node.closing) {
                return done();
            }

            if (Object.keys(node.registeredNodes).length === 0) {
                if (node.connected || node.connecting) {
                    node.disconnect();
                }
            }

            done();
        };

        this.setStatusOfRegisteredNodes = function(status) {
            for (let id in node.registeredNodes) {
                if (node.registeredNodes.hasOwnProperty(id)) {
                    node.registeredNodes[id].status(status);
                }
            }
        }

        this.sendToRegisteredNodes = function(msg) {
            for (let id in node.registeredNodes) {
                if (node.registeredNodes.hasOwnProperty(id)) {
                    node.registeredNodes[id].send(msg);
                }
            }
        }

        this.setErrorOfRegisteredNodes = function(error) {
            for (let id in node.registeredNodes) {
                if (node.registeredNodes.hasOwnProperty(id)) {
                    node.registeredNodes[id].error(error);
                }
            }
        }

        this.reconnect = function() {
            node.connected = false;
            node.connecting = false;

            if (!node.closing && Object.keys(node.registeredNodes).length > 0) {
                clearTimeout(node.reconnectTimeOut);
                node.reconnectTimeOut = setTimeout(() => { node.connect(); }, 3000);
            }
        };

        this.disconnect = function() {
            if (node.connected || node.connecting) {
                try {
                    node.client.logout()
                        .then(() => {
                            node.client = null;
                            node.platformStatus = null;
                            node.connected = false;
                            node.connecting = false;

                            node.setStatusOfRegisteredNodes({ fill: "red", shape: "ring", text: "disconnected" });
                        })
                        .catch(error => {
                            node.setStatusOfRegisteredNodes({ fill: "red", shape: "ring", text: "error" });
                        });
                } catch (exception) {
                }
            }
        };

        this.connect = function() {
            if (!node.connected && !node.connecting) {
                node.reconnectTimeOut = null;
                node.connecting = true;

                try {
                    node.client = new Quasar(node.username, node.password);

                    node.setStatusOfRegisteredNodes({ fill: "yellow", shape: "ring", text: "connecting" });

                    node.client.login()
                        .then(() => {
                            node.connected = true;
                            node.connecting = false;

                            node.setStatusOfRegisteredNodes({ fill: "green", shape: "ring", text: "connected" });
                        })
                        .catch(error => {
                            node.setStatusOfRegisteredNodes({ fill: "red", shape: "ring", text: "error" });
                            console.log(error.toString());
                            node.disconnect();
                            node.reconnect();
                        });
                } catch (exception) {
                    console.log(exception);
                    node.setErrorOfRegisteredNodes(exception.toString());
                }
            }

            this.on('close', function(done) {
                try {
                    node.closing = true;
                    node.disconnect();

                    done();
                } catch(error) {
                    done();
                }
            });
        }
    }

    RED.nodes.registerType('quasar-creditnals', creditnals);
};
