module.exports = function (RED) {
    function NodeDevOpsFunctionality(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var cfg = config;

        node.on('close', function () {
            node.status({});
        });

        node.on("input", function (msg, send, done) {
            msg.commit_message = msg.githubmessage;
            
            if (msg.randompackagename) {
                msg.pversion = ( 
                    Math.random().toString().substring(2).substring(2, 3) + "." + 
                    Math.random().toString().substring(2).substring(2, 3) + "." + 
                    Math.random().toString().substring(2).substring(2, 5).replace(/^0/, '1')
                )
            }

            if (msg.randompackagename && (msg.gitcommit || msg.npmpublish || msg.npmunpublish) ) {
                done("Cannot randomise package and perform GitHub or NPM operation", msg)
                return
            }
            send(msg);
            done();
        });
    }

    RED.nodes.registerType("NodeDevOps", NodeDevOpsFunctionality);

    RED.httpAdmin.post("/NodeDevOps/:id",
        RED.auth.needsPermission("NodeDevOps.write"),
        (req, res) => {
            var node = RED.nodes.getNode(req.params.id);
            if (node != null) {
                try {
                    if (req.body && node.type == "NodeDevOps") {                        
                        node.receive(req.body);
                        res.status(200).send({ status: "ok" })
                    } else {
                        res.sendStatus(404);
                    }
                } catch (err) {
                    console.error(err);
                    res.status(500).send(err.toString());
                    node.error("NodeDevOps: Submission failed: " + err.toString())
                }
            } else {
                res.sendStatus(404);
            }
        });
}
