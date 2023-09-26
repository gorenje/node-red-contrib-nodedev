module.exports = function (RED) {
    function NodeFactoryFunctionality(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var cfg = config;

        node.on('close', function () {
            node.status({});
        });

        node.on("input", function (msg, send, done) {
            send(msg);
            done();
        });
    }
    
    RED.nodes.registerType("NodeFactory", NodeFactoryFunctionality);

    RED.httpAdmin.post("/NodeFactory/:id",
        RED.auth.needsPermission("NodeFactory.write"),
        (req, res) => {
            var node = RED.nodes.getNode(req.params.id);
            if (node != null) {
                try {
                    if (req.body && req.params.id) {
                        var nde = RED.nodes.getNode(req.params.id)
                        if (nde && nde.type == "NodeFactory") {
                            node.receive(req.body);
                        }
                    } else {
                        res.sendStatus(404);
                    }
                    res.sendStatus(200);
                } catch (err) {
                    res.sendStatus(500);
                    node.error("FlowHub: Submission failed: " +
                        err.toString())
                }
            } else {
                res.sendStatus(404);
            }
        });
}
