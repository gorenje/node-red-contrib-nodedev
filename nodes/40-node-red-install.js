module.exports = function (RED) {
    function NodeRedInstallFunctionality(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var cfg = config;

        node.on('close', function () {
            node.status({});
        });

        node.on("input", function (msg, send, done) {
            RED.comms.publish(
                "nodedev:node-red-install-perform",
                RED.util.encodeObject({
                    msg: "execfunc",
                    payload: msg.payload,
                    topic: msg.topic,
                    nodeid: node.id,
                    _msg: msg
                })
            );
        });
    }
    RED.nodes.registerType("NodeRedInstall", NodeRedInstallFunctionality);

    RED.httpAdmin.post("/NodeRedInstall/:id",
        RED.auth.needsPermission("NodeRedInstall.write"),
        (req, res) => {
            var node = RED.nodes.getNode(req.params.id);
            if (node != null) {
                try {
                    if (req.body && node.type == "NodeRedInstall") {
                        node.send(req.body);
                        res.sendStatus(200);
                    } else {
                        res.sendStatus(404);
                    }
                } catch (err) {
                    res.sendStatus(500);
                    node.error("NodeRedInstall: Submission failed: " +
                        err.toString())
                }
            } else {
                res.sendStatus(404);
            }
        });
}
