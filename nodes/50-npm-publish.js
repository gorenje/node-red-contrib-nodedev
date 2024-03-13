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

                let registry = msg.npmregistry || cfg.registry || 'registry.npmjs.org'

                let manifest = JSON.parse(msg.contents.filter((d) => {
                    return d.name == "package.json"
                })[0].contents);

                var opts = {
                    npmVersion: "node-red-contrib-nodedev@0.3.2",
                    access: msg.npmaccess || cfg.access || "public",
                    otp: msg.npmotp || cfg.otp,
                    authToken: auth_token,
                };
                opts[`//${registry}/:_authToken`] = auth_token

                var userscope = manifest.name.split("/")[0];
                opts[userscope + ":registry"] = `https://${registry}`

                if (msg.npmpublish || cfg.action == "publish") {

                    // generate readme content - it seems that npm publish does this.
                    let rdme = msg.contents.filter((d) => {
                        return d.name == "README.md"
                    })[0];

                    if ( rdme ) {
                        manifest["readmeFilename"] = "README.md";
                        manifest["readme"] = rdme.contents;
                    }

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
                } else if (msg.npmunpublish || cfg.action == "unpublish") {
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
            })
        });
    }
    
    RED.nodes.registerType("NpmPublish", NpmPublishFunctionality);
}
