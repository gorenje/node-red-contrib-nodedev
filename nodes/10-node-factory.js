module.exports = function (RED) {
    "use strict";
    
    var mustache = require("mustache");
    var fs = require('fs');
    var path = require('path');

    function extractTokens(tokens, set) {
        set = set || new Set();
        tokens.forEach(function (token) {
            if (token[0] !== 'text') {
                set.add(token[1]);
                if (token.length > 4) {
                    extractTokens(token[4], set);
                }
            }
        });
        return set;
    }

    function parseContext(key) {
        var match = /^(flow|global)(\[(\w+)\])?\.(.+)/.exec(key);
        if (match) {
            var parts = {};
            parts.type = match[1];
            parts.store = (match[3] === '') ? "default" : match[3];
            parts.field = match[4];
            return parts;
        }
        return undefined;
    }

    function parseEnv(key) {
        var match = /^env\.(.+)/.exec(key);
        if (match) {
            return match[1];
        }
        return undefined;
    }

    /**
     * Custom Mustache Context capable to collect message property and node
     * flow and global context
     */

    function NodeContext(msg, nodeContext, parent, escapeStrings, cachedContextTokens) {
        this.msgContext = new mustache.Context(msg, parent);
        this.nodeContext = nodeContext;
        this.escapeStrings = escapeStrings;
        this.cachedContextTokens = cachedContextTokens;
    }

    NodeContext.prototype = new mustache.Context();

    NodeContext.prototype.lookup = function (name) {
        // try message first:
        try {
            var value = this.msgContext.lookup(name);
            if (value !== undefined) {
                if (this.escapeStrings && typeof value === "string") {
                    value = value.replace(/\\/g, "\\\\");
                    value = value.replace(/\n/g, "\\n");
                    value = value.replace(/\t/g, "\\t");
                    value = value.replace(/\r/g, "\\r");
                    value = value.replace(/\f/g, "\\f");
                    value = value.replace(/[\b]/g, "\\b");
                }
                return value;
            }

            // try env
            if (parseEnv(name)) {
                return this.cachedContextTokens[name];
            }

            // try flow/global context:
            var context = parseContext(name);
            if (context) {
                var type = context.type;
                var store = context.store;
                var field = context.field;
                var target = this.nodeContext[type];
                if (target) {
                    return this.cachedContextTokens[name];
                }
            }
            return '';
        }
        catch (err) {
            throw err;
        }
    }

    NodeContext.prototype.push = function push(view) {
        return new NodeContext(view, this.nodeContext, this.msgContext, undefined, this.cachedContextTokens);
    };

    function handleTemplate(msg,node,template) {
        var promises = [];
        var tokens = extractTokens(mustache.parse(template));
        var resolvedTokens = {};

        tokens.forEach(function (name) {
            var env_name = parseEnv(name);
            if (env_name) {
                var promise = new Promise((resolve, reject) => {
                    var val = RED.util.evaluateNodeProperty(env_name, 'env', node)
                    resolvedTokens[name] = val;
                    resolve();
                });
                promises.push(promise);
                return;
            }

            var context = parseContext(name);
            if (context) {
                var type = context.type;
                var store = context.store;
                var field = context.field;
                var target = node.context()[type];
                if (target) {
                    var promise = new Promise((resolve, reject) => {
                        target.get(field, store, (err, val) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolvedTokens[name] = val;
                                resolve();
                            }
                        });
                    });
                    promises.push(promise);
                    return;
                }
            }
        });

        return Promise.all(promises).then(function () {
            return mustache.render(template, new NodeContext(msg, node.context(), null, false, resolvedTokens));
        });
    }

    function NodeFactoryFunctionality(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var cfg = config;

        node.on('close', function () {
            node.status({});
        });

        node.on("input", function (msg, send, done) {
            try {
                send({payload: msg})
                send({payload: node.context()})

                var htmlPath = path.join(__dirname, 'templates', 'tmpl.html');
                var jsPath = path.join(__dirname, 'templates', 'tmpl.js');

                var jsonTmpl = fs.readFileSync(jsPath, 'utf8');
                var htmlTmpl = fs.readFileSync(htmlPath, 'utf8');

                handleTemplate(msg, node, jsonTmpl).then(function(data){
                    var jsData = data;
                    handleTemplate(msg, node, htmlTmpl).then(function (data) {
                        send({payload: [jsData,data]})
                        done()
                    }).catch( (err) => {
                        msg.error = err
                        done(err.message, msg)
                    })
                }).catch( (err) => {
                    msg.error = err
                    done(err.message, msg)
                })
                //send({ payload: jsonString })
            } catch (err) {
                msg.error = err
                done(err.message,msg)
            }
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
