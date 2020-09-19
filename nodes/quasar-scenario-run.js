module.exports = function(RED) {
    function run(config) {
        RED.nodes.createNode(this, config);

        this.creditnals = config.creditnals;
        this.scenario = config.scenario;
        this.clientNode = RED.nodes.getNode(this.creditnals);
        this.launching = false;

        let node = this;

        if (node.clientNode) {
            node.status({fill: "red", shape: "ring", text: "disconnected"});

            node.clientNode.register(node);

            if (node.clientNode.connected) {
                node.status({ fill: "green", shape: "ring", text: "connected" });
            }

            this.errorHandler = function(error) {
                node.status({ fill: "red", shape: "ring", text: "error" });

                node.launching = false;

                node.clientNode.reconnect();

                if (done) {
                    done(error);
                } else {
                    node.error(error, error.message);
                }
            };

            this.on("input", function(msg, send, done) {
                if (node.clientNode.connected) {
                    node.status({ fill: "green", shape: "ring", text: "connected" });
                } else {
                    node.status({ fill: "red", shape: "ring", text: "disconnected" });
                }

                node.launching = true;

                node.debug("Cookies: " + node.clientNode.client.cookies);

                scenario = msg.scenario || node.scenario;

                node.clientNode.client.scenarioRun(scenario)
                    .then(response => {
                        node.send({payload: response});

                        node.launching = false;
                    })
                    .catch(error => node.errorHandler);
            });
        }

        this.on('close', function(done) {
            try {
                if (node.clientNode) {
                    node.clientNode.deregister(node, function() {
                        node.launching = false;

                        done();
                    });
                } else {
                    done();
                }
            } catch(error) {
                done();
            }
        });
    }

    RED.nodes.registerType("quasar-scenario-run", run);
}
