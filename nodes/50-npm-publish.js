module.exports = function (RED) {
    function NpmPublishFunctionality(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var cfg = config;

        const libpub = require('libnpmpublish');

        node.on('close', function () {
            node.status({});
        });

        node.on("input", function (msg, send, done) {
            RED.util.evaluateNodeProperty(cfg.authToken, cfg.authTokenType, node, msg, (err, result) => {
                if (err || result.trim() == "") {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Failed, no AUTH TOKEN provided."
                    });

                    msg.error = err;
                    done("failed to get auth token", msg)
                    return;
                }

                var auth_token = result;
                var tarball = Buffer.from(msg.payload)

                var manifest = JSON.parse(msg.contents.filter((d) => {
                    return d.name == "package.json"
                })[0].contents);

                var opts = {
                    userAgent: "node-red-contrib-nodedev@1.1.1",
                    access: "public",
                    otp: msg.npmotp || cfg.otp,
                    authToken: auth_token,
                    '//registry.npmjs.org/:_authToken': auth_token,
                };

                var userscope = manifest.name.split("/")[0];
                opts[userscope + ":registry"] = "https://registry.npmjs.org"

                if (msg.npmpublish || cfg.action == "publish") {
                    libpub.publish(
                        manifest, tarball, opts
                    ).then((data) => {
                        msg.payload = JSON.stringify(data);
                        send(msg)
                        done()
                    }).catch((exp) => {
                        msg.error = exp;
                        done("publish failed", msg)
                    })
                } else {
                    if (msg.npmunpublish || cfg.action == "unpublish") {
                        libpub.unpublish(
                            manifest.name, opts
                        ).then((data) => {
                            msg.payload = JSON.stringify(data);
                            send(msg)
                            done()
                        }).catch((exp) => {
                            msg.error = exp;
                            done("unpublish failed", msg)
                        })
                    }
                }
            })
        });
    }
    
    RED.nodes.registerType("NpmPublish", NpmPublishFunctionality);
}
