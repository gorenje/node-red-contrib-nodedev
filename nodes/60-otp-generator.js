const OTPAuth = require('otpauth');

module.exports = function (RED) {
    function OTPGeneratorNode(config) {
        RED.nodes.createNode(this, config);

        let node = this;
        let cfg = config

        node.on('input', function (msg, send, done) {
            RED.util.evaluateNodeProperty(cfg.secret, cfg.secretType, node, msg, (err, result) => {
                if (err) {
                    node.status({ fill: "red", shape: "dot", text: "Failed" });
                    node.error("error occurred", { ...msg, _err: err })
                } else {
                    let opts = undefined

                    if (typeof msg.payload !== "object") {
                        opts = {
                            issuer: cfg.issuer,
                            label: cfg.label,
                            digits: parseInt(cfg.digits),
                            secret: msg.payload || result,
                            algorithm: cfg.algorithm,
                        };
                    } else {
                        opts = { ...msg.payload }

                        opts.issuer = opts.issuer || cfg.issuer
                        opts.label = opts.label || cfg.label
                        opts.digits = opts.digits || parseInt(cfg.digits)
                        opts.secret = opts.secret || result
                        opts.algorithm = opts.algorithm || cfg.algorithm
                    }

                    let otp = undefined

                    if (cfg.otptype == 'totp') {
                        opts.period = parseInt((typeof msg.payload == "object" && msg.payload.period) || cfg.period)
                        otp = new OTPAuth.TOTP(opts)
                    } else if (cfg.otptype == 'hotp') {
                        opts.counter = parseInt((typeof msg.payload == "object" && msg.payload.counter) || cfg.counter)
                        otp = new OTPAuth.HOTP(opts)
                    } else {
                        return node.error("unknown type: " + cfg.otptype, msg)
                    }

                    let otpvalue = otp.generate();

                    if (cfg.propertyType === 'flow' || cfg.propertyType === 'global') {
                        node.context()[cfg.propertyType].set(cfg.property, otpvalue, () => {
                            send(msg);
                            done()
                        })
                        return;
                    } else {
                        RED.util.setMessageProperty(msg, cfg.property || 'payload', otpvalue, true);
                        send(msg);
                    }
                }
            })
        });
    }

    RED.nodes.registerType('OTPGenerate', OTPGeneratorNode);
}