module.exports = function (RED) {
    "use strict";

    var fs = require('fs');
    var path = require('path');
    
    var mustache = require("mustache");

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

    function createPluginNodeDefintions(msg, node) {
        var sidebarHtmlPath = path.join(__dirname, 'templates', 'tmplsidebar.html');
        var nodeJsPath = path.join(__dirname, 'templates', 'tmplsidebarnode.js');
        var nodeHtmlPath = path.join(__dirname, 'templates', 'tmplsidebarnode.html');

        var content = {};

        var promises = [
            handleTemplate(msg, node, fs.readFileSync(sidebarHtmlPath, 'utf8')).then((c) => { content["sbht"] = c }),
            handleTemplate(msg, node, fs.readFileSync(nodeJsPath, 'utf8')).then((c) => { content["ndjs"] = c }),
            handleTemplate(msg, node, fs.readFileSync(nodeHtmlPath, 'utf8')).then((c) => { content["ndht"] = c }),
        ];

        return Promise.all(promises).then(() => {
            var secondId = RED.util.generateId();
            var thirdId = RED.util.generateId();

            return [{
                id: RED.util.generateId(),
                type: "PkgFile",
                name: msg.node.name + "Cfg.js",
                filename: "nodes/" + msg.node.namelwr + ".js",
                template: content["ndjs"],
                syntax: "mustache",
                format: "javascript",
                output: "str",
                x: 100,
                y: 50,
                wires: [[secondId]]
            },

            {
                id: secondId,
                type: "PkgFile",
                name: "Sidebar: " + msg.node.name + ".html",
                filename: "plugins/" + msg.node.namelwr + ".html",
                template: content["sbht"],
                syntax: "mustache",
                format: "html",
                output: "str",
                x: 100,
                y: 100,
                wires: [[thirdId]]
            },

            {
                id: thirdId,
                type: "PkgFile",
                name: msg.node.name + "Cfg.html",
                filename: "nodes/" + msg.node.namelwr + ".html",
                template: content["ndht"],
                syntax: "mustache",
                format: "html",
                output: "str",
                x: 100,
                y: 150,
                wires: [[]]
            }]
        })
    }

    function createRealPluginNodeDefintions(msg,node) {
        var pluginJsPath = path.join(__dirname, 'templates', 'tmplplugin.js');
        var content = {};

        var promises = [
            handleTemplate(msg, node, fs.readFileSync(pluginJsPath, 'utf8')).then((c) => { content["jsac"] = c }),
        ];

        return Promise.all(promises).then(() => {
            return [{
                id: RED.util.generateId(),
                type: "PkgFile",
                name: msg.node.name + "Plugin.js",
                filename: "plugins/" + msg.node.namelwr + ".js",
                template: content["jsac"],
                syntax: "mustache",
                format: "javascript",
                output: "str",
                x: 100,
                y: 50,
                wires: [[]]
            }]
        })
    }

    function createSimpleNodeDefintions(msg,node) {
        var htmlPath = path.join(__dirname, 'templates', 'tmpl.html');
        var htmlJsPath = path.join(__dirname, 'templates', 'tmpl.html.js');
        var jsPath = path.join(__dirname, 'templates', 'tmpl.js');
        var localeJsonPath = path.join(__dirname, 'templates', 'locale', 'en-US', 'tmpl.json')
        var localeHtmlPath = path.join(__dirname, 'templates', 'locale', 'en-US', 'tmpl.html')

        var content = {};

        var promises = [
            handleTemplate(msg, node, fs.readFileSync(htmlPath, 'utf8')).then((c) => { content["html"] = c }),
            handleTemplate(msg, node, fs.readFileSync(htmlJsPath, 'utf8')).then((c) => { content["htjs"] = c }),
            handleTemplate(msg, node, fs.readFileSync(jsPath, 'utf8')).then((c) => { content["jasc"] = c }),
            handleTemplate(msg, node, fs.readFileSync(localeJsonPath, 'utf8')).then((c) => { content["ljsn"] = c }),
            handleTemplate(msg, node, fs.readFileSync(localeHtmlPath, 'utf8')).then((c) => { content["lhtm"] = c }),
        ];

        return Promise.all(promises).then(() => {
            var secondId = RED.util.generateId();
            var secondIdTempJs = RED.util.generateId();
            var thirdId = RED.util.generateId();
            var fourthId = RED.util.generateId();

            return [{
                id: RED.util.generateId(),
                type: "PkgFile",
                name: msg.node.name + ".js",
                filename: "nodes/" + msg.node.namelwr + ".js",
                template: content["jasc"],
                syntax: "mustache",
                format: "javascript",
                output: "str",
                x: 100,
                y: 50,
                wires: [[secondIdTempJs]]
            },
            {
                "id": secondIdTempJs,
                "type": "template",
                "name": msg.node.name + ".html.js",
                "field": msg.node.name+ "TmplJs",
                "fieldType": "msg",
                "format": "javascript",
                "syntax": "mustache",
                "template": content["htjs"],
                "x": 100,
                "y": 100,
                "wires": [
                    [
                        secondId
                    ]
                ]
            },
            {
                id: secondId,
                type: "PkgFile",
                name: msg.node.name + ".html",
                filename: "nodes/" + msg.node.namelwr + ".html",
                template: content["html"],
                syntax: "mustache",
                format: "html",
                output: "str",
                x: 100,
                y: 150,
                wires: [[thirdId]]
            },
            {
                id: thirdId,
                type: "PkgFile",
                name: "Locale: " + msg.node.name + ".json",
                filename: "nodes/locales/en-US/" + msg.node.namelwr + ".json",
                template: content["ljsn"],
                syntax: "mustache",
                format: "json",
                output: "str",
                x: 120,
                y: 200,
                wires: [[fourthId]]
            },
            {
                id: fourthId,
                type: "PkgFile",
                name: "Locale: " + msg.node.name + ".html",
                filename: "nodes/locales/en-US/" + msg.node.namelwr + ".html",
                template: content["lhtm"],
                syntax: "mustache",
                format: "html",
                output: "str",
                x: 120,
                y: 250,
                wires: [[]]
            }
            ]
        })
    }

    function createNodeDefintions(msg, node) {
        if ( msg.node.isplugin ) {
            return createPluginNodeDefintions(msg, node)
        } else if (msg.node.isrealplugin ) {
            return createRealPluginNodeDefintions(msg, node)
        } else {
            return createSimpleNodeDefintions(msg, node)
        }
    }

    function createManifestFiles(msg, node, nodeDefinitions) {
        var packageJsonPath = path.join(__dirname, 'templates', 'tmplpackage.json');
        var readmePath = path.join(__dirname,      'templates', 'tmplreadme.md');
        var licensePath = path.join(__dirname,     'templates', 'tmpllicense');
        var changelogPath = path.join(__dirname,   'templates', 'tmplchangelog.md');

        /* ASSUMPTION: assume the .js file is defined first and
            then the .html file in the node definitions */
        spcRepDict["nodestanza"] = " \"" + msg.node.namelwr + "\": \"" + nodeDefinitions[0].filename + "\""
        if ( msg.node.isplugin ) {
            spcRepDict["pluginstanza"] = " \"sidebar-plugin\": \"" + nodeDefinitions[1].filename + "\""
        }
        if (msg.node.isrealplugin) {
            spcRepDict["pluginstanza"] = " \"" + msg.node.namelwr + "\": \"" + nodeDefinitions[0].filename + "\""
        }

        var content = {};

        var promises = [
            handleTemplate(msg, node, fs.readFileSync(packageJsonPath, 'utf8')).then((c) => { content["pkjs"] = c }),
            handleTemplate(msg, node, fs.readFileSync(readmePath,      'utf8')).then((c) => { content["rdme"] = c }),
            handleTemplate(msg, node, fs.readFileSync(licensePath,     'utf8')).then((c) => { content["lcns"] = c }),
            handleTemplate(msg, node, fs.readFileSync(changelogPath,   'utf8')).then((c) => { content["chlg"] = c }),
        ];

        return Promise.all(promises).then( () => {
            var secondId = RED.util.generateId();
            var thirdId = RED.util.generateId();
            var fourthId = RED.util.generateId();

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
                y: -150,
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
                y: -100,
                wires: [[thirdId]]
            })

            nodeDefinitions.push({
                id: thirdId,
                type: "PkgFile",
                name: "CHANGELOG.md",
                filename: "CHANGELOG.md",
                template: content["chlg"],
                syntax: "mustache",
                format: "markdown",
                output: "str",
                x: 100,
                y: -50,
                wires: [[fourthId]]
            })

            nodeDefinitions.push({
                id: fourthId,
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
            send({ payload: msg.node })
            
            if (msg.node && msg.node.__task == "generate_from_templates") {
                try {
                    createNodeDefintions(msg,node).then( (nodeDef) => {
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
                } catch (err) {
                    msg.error = err
                    done(err.message, msg)
                }
            } else {
                /* assume that payload is a buffer with a .tgz if not, error out */
                try {
                    const onError = (err) => {
                        msg.error = err;
                        done("extraction error", msg)
                    }

                    const onFinish = (allFiles) => {
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
                    }
                    
                    require('./lib/tarhelpers.js').convertTarFile(RED, msg.payload, onFinish, onError)
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
