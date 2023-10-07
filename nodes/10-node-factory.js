module.exports = function (RED) {
    "use strict";

    var fs = require('fs');
    var path = require('path');
    
    var mustache = require("mustache");
    var tarStream = require('tar-stream');
    var streamx = require('streamx');
    var pakoGzip = require('pako');

    var spcRepDict = {
        "ocb2": "{{",
        "ocb3": "{{{",
        "ccb3": "}}}",
        "ccb2": "}}"
    };

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

    function parseIntern(key) {
        var match = /^__\.(.+)$/.exec(key);
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

            var spcRep = parseIntern(name)
            if ( spcRep ) {
                return spcRepDict[spcRep] || ("UNFOUND - " + spcRep);
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

    function handleTemplate(msg, node, template) {
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

    function convertToPkgFileNodes(msg, jsCtnt, htmlCtnt) {
        var allNodes = [];

        var secondId = RED.util.generateId();

        allNodes.push({
            id: RED.util.generateId(),
            type: "PkgFile",
            name: msg.node.name + ".js",
            filename: "nodes/" + msg.node.name.toLowerCase() + ".js",
            template: jsCtnt,
            syntax: "mustache",
            format: "javascript",
            output: "str",
            x: 100,
            y: 50,
            wires: [[secondId]]
        })

        allNodes.push({
            id: secondId,
            type: "PkgFile",
            name: msg.node.name + ".html",
            filename: "nodes/" + msg.node.name.toLowerCase() + ".html",
            template: htmlCtnt,
            syntax: "mustache",
            format: "html",
            output: "str",
            x: 100,
            y: 100,
            wires: [[]]
        })

        return allNodes;
    }

    function createManifestFiles(msg, node, nodeDefinitions) {
        /* ASSUMPTION: assume the .js file is defined first and 
        then the .html file in the node definitions */

        var packageJsonPath = path.join(__dirname, 'templates', 'tmplpackage.json');
        var readmePath = path.join(__dirname, 'templates', 'tmplreadme.md');
        var licensePath = path.join(__dirname, 'templates', 'tmpllicense');

        var pkjsTmpl = fs.readFileSync(packageJsonPath, 'utf8');
        var rdmeTmpl = fs.readFileSync(readmePath, 'utf8');
        var lcnsTmpl = fs.readFileSync(licensePath, 'utf8');

        spcRepDict["nodestanza"] = " \"" + msg.node.name.toLowerCase() + "\": \"" + nodeDefinitions[0].filename + "\""

        var content = {};

        var promises = [
            handleTemplate(msg, node, pkjsTmpl).then((c) => { content["pkjs"] = c }),
            handleTemplate(msg, node, rdmeTmpl).then((c) => { content["rdme"] = c }),
            handleTemplate(msg, node, lcnsTmpl).then((c) => { content["lcns"] = c }),
        ];

        return Promise.all(promises).then( () => {
            var secondId = RED.util.generateId();
            var thirdId = RED.util.generateId();

            nodeDefinitions.push({
                id: RED.util.generateId(),
                type: "PkgFile",
                name: "LICENSE",
                filename: "LICENSE",
                template: content["lcns"],
                syntax: "mustache",
                format: "text",
                output: "str",
                x: 100,
                y: -100,
                wires: [[ secondId ]]
            })

            nodeDefinitions.push({
                id: secondId,
                type: "PkgFile",
                name: "README.md",
                filename: "README.md",
                template: content["rdme"],
                syntax: "mustache",
                format: "markdown",
                output: "str",
                x: 100,
                y: -50,
                wires: [[thirdId]]
            })

            nodeDefinitions.push({
                id: thirdId,
                type: "PkgFile",
                name: "package.json",
                filename: "package.json",
                template: content["pkjs"],
                syntax: "mustache",
                format: "json",
                output: "str",
                x: 100,
                y: 0,
                wires: [[nodeDefinitions[0].id]]
            })

            return nodeDefinitions;
        })
    }

    function NodeFactoryFunctionality(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        var cfg = config;

        node.on('close', function () {
            node.status({});
        });

        node.on("input", function (msg, send, done) {
            if (msg.node && msg.node.__task == "generate_from_templates") {
                try {
                    var htmlPath = path.join(__dirname, 'templates', 'tmpl.html');
                    var jsPath = path.join(__dirname, 'templates', 'tmpl.js');

                    var jsonTmpl = fs.readFileSync(jsPath, 'utf8');
                    var htmlTmpl = fs.readFileSync(htmlPath, 'utf8');

                    handleTemplate(msg, node, jsonTmpl).then(function (data) {
                        var jsData = data;

                        handleTemplate(msg, node, htmlTmpl).then(function (data) {
                            var nodeDef = convertToPkgFileNodes(msg, jsData, data)

                            if (msg.node.createmanifest ) {
                                /* create the package.json, readme and license files */
                                createManifestFiles(msg, node, nodeDef).then( (data) => {
                                    var nodeImpStr = JSON.stringify(data);

                                    send({ payload: nodeImpStr })

                                    RED.comms.publish(
                                        "nodedev:perform-autoimport-nodes",
                                        RED.util.encodeObject({
                                            msg: "autoimport",
                                            payload: nodeImpStr,
                                            topic: msg.topic,
                                            nodeid: node.id,
                                            _msg: msg
                                        })
                                    );
                                }).catch( (err) => {
                                    msg.error = err
                                    done(err.message, msg)
                                })
                            } else {
                                var nodeImpStr = JSON.stringify(nodeDef);

                                send({ payload: nodeImpStr })

                                RED.comms.publish(
                                    "nodedev:perform-autoimport-nodes",
                                    RED.util.encodeObject({
                                        msg: "autoimport",
                                        payload: nodeImpStr,
                                        topic: msg.topic,
                                        nodeid: node.id,
                                        _msg: msg
                                    })
                                );
                            }
                            done()
                        }).catch((err) => {
                            msg.error = err
                            done(err.message, msg)
                        })
                    }).catch((err) => {
                        msg.error = err
                        done(err.message, msg)
                    })
                    //send({ payload: jsonString })
                } catch (err) {
                    msg.error = err
                    done(err.message, msg)
                }
            } else {
                /* assume that payload is a buffer with a .tgz if not, error out */
                try {
                    const extract = tarStream.extract()

                    var allFiles = [];

                    /* 
                     * there is no indication in a tar file of whether a file is binary or textual.
                     * we can only make a guess by the extension of the filename.
                     ***/
                    var computeFormat = (filename) => {
                        var ext = filename.split(".").at(-1);

                        return {
                            "html": "html",
                            "js": "javascript",
                            "md": "markdown",
                            "json": "json",
                            /* binary formats are encoded in base64 */
                            "png": "base64",
                            "tiff": "base64",
                            "tif": "base64",
                            "jpg": "base64",
                            "jpeg": "base64",
                            "bin": "base64",
                            "bmp": "base64",
                            "gif": "base64",
                        }[ext.toLowerCase()] || "text";
                    };

                    extract.on('entry', function (header, stream, next) {
                        // header is the tar header
                        // stream is the content body (might be an empty stream)
                        // call next when you are done with this entry

                        var buffer = [];

                        stream.on('data', function (data) {
                            buffer.push(data)
                        });

                        stream.on('end', function () {
                            var frmt = computeFormat(header.name.split("/").at(-1));

                            allFiles.push({
                                id: RED.util.generateId(),
                                type: "PkgFile",
                                name: header.name.split("/").at(-1),
                                filename: header.name.replace(/^package\//, ''),
                                template: Buffer.concat(buffer).toString(frmt == "base64" ? 'base64' : 'utf8'),
                                syntax: "mustache",
                                format: frmt,
                                output: "str",
                                x: 100,
                                y: 50 * (allFiles.length + 1),
                                wires: [
                                    []
                                ]
                            })

                            next() // ready for next entry
                        })

                        stream.resume() // just auto drain the stream
                    })

                    extract.on('finish', function () {
                        // all entries read, wire them together
                        for (var idx = 0; idx < allFiles.length - 1; idx++) {
                            allFiles[idx].wires = [[allFiles[idx + 1].id]];
                        }

                        msg.payload = JSON.stringify(allFiles);
                        send(msg)

                        RED.comms.publish(
                            "nodedev:perform-autoimport-nodes",
                            RED.util.encodeObject({
                                msg: "autoimport",
                                payload: msg.payload,
                                topic: msg.topic,
                                nodeid: node.id,
                                _msg: msg
                            })
                        );

                        done()
                    })

                    extract.on('error', function (err) {
                        msg.error = err;
                        done("extraction error", msg)
                    });

                    var stream = streamx.Readable.from(Buffer.from(pakoGzip.inflate(new Uint8Array(msg.payload))))
                    stream.pipe(extract);
                } catch (err) {
                    msg.error = err
                    done(err.message, msg)
                }
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
