module.exports = function (RED) {
    function NpmTarBallFunctionality(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var cfg = config;

        const tarStream = require('tar-stream');
        const pakoGzip = require('pako')

        node.on('close', function () {
            node.status({});
        });

        node.on("input", function (msg, send, done) {
            const pack = tarStream.pack()

            var buffer = [];

            msg.contents.forEach((elem) => {
                if (elem.type == "base64") {
                    pack.entry({ name: "package/" + elem.name }, Buffer.from(elem.contents, 'base64'))
                } else {
                    pack.entry({ name: "package/" + elem.name }, elem.contents)
                }
            })

            pack.on('end', function () {
                try {
                    var buf = Buffer.from(pakoGzip.gzip(Buffer.concat(buffer)))
                    msg.payload = buf;
                    send(msg);
                } catch (ex) {
                    msg.errors = ex
                    done("failed to encode buffer", msg)
                }
            });

            pack.on('data', function (data) {
                buffer.push(data)
            });

            pack.on('error', (err) => {
                msg.error = err
                done("tar packing failed", msg)
            })

            pack.finalize() 
        });
    };

    RED.nodes.registerType("NpmTarBall", NpmTarBallFunctionality);
}