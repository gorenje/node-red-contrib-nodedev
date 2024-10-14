module.exports = function (RED) {
    let pacote = require('pacote');
    let tarHelpers = require('./lib/tarhelpers.js');
    
    let dirGrpColours = (dirname) => {

        dirname = (dirname.startsWith("dist/") || dirname == "dist") ? "dist" : dirname
        dirname = (dirname.startsWith("nodes/locales/") || dirname == "nodes/locales" ) ? "nodes/locales" : dirname
        dirname = (dirname.startsWith("locales/") || dirname == "locales") ? "nodes/locales" : dirname
        dirname = (dirname.startsWith("samples/") || dirname == "samples") ? "examples" : dirname
        dirname = (dirname != "." && dirname.startsWith(".")) ? ".dir" : dirname
        
        let lookup = {
            ".dir": {
                "stroke": "#dbcbe7",
                "fill": "#dbcbe7",
            },
            ".": {
                "stroke": "#ffefbf",
                "fill": "#ffefbf",
            },
            "examples": {
                "stroke": "#addb7b",
                "fill": "#addb7b",
            },
            "nodes": {
                "stroke": "#c8e7a7",
                "fill": "#c8e7a7",
            },
            "plugins": {
                "stroke": "#92d04f",
                "fill": "#92d04f",
            },
            "nodes/lib": {
                "stroke": "#e3f3d3",
                "fill": "#e3f3d3",
            },
            "assets": {
                "stroke": "#0070c0",
                "fill": "#0070c0",
            },
            "icons": {
                "stroke": "#3f93cf",
                "fill": "#3f93cf",
            },
            "nodes/icons": {
                "stroke": "#3f93cf",
                "fill": "#3f93cf",
            },
            "dist": {
                "stroke": "#ffbfbf",
                "fill": "#ffbfbf"                
            },
            "nodes/locales": {
                "stroke": "#bfdbef",
                "fill": "#bfdbef",               
            }
        }

        return lookup[dirname] || {}
    }

    function ConfigNodeFactorySidebarFunctionality(config) {
        RED.nodes.createNode(this, config)
    }

    RED.nodes.registerType('NodeFactorySidebarCfg', ConfigNodeFactorySidebarFunctionality);

    function createDevOpsNode(pkgname, pkgversion, x, y, nodeid) {
        return {
            "id": RED.util.generateId(),
            "type": "NodeDevOps",
            "name": "",
            "pname": pkgname,
            "pversion": pkgversion,
            "pauthorname": "",
            "pauthoremail": "",
            "pdescription": "",
            "noderedinstall": true,
            "randompackagename": false,
            "ignore_package_check": false,
            "gitcommit": false,
            "gitcheckforchange": false,
            "githubowner": "",
            "githubrepo": "",
            "githubbranch": "main",
            "githubauthor": "",
            "githubauthoremail": "",
            "githubmessage": "",
            "npmpublish": false,
            "npmunpublish": false,
            "npmotp": "",
            "x": x - 120,
            "y": y - 50,
            "wires": [
                [nodeid]
            ]
        }
    }

    function createTarballNode(x,y,nodeid) {
        return {
            "id": RED.util.generateId(),
            "type": "NpmTarBall",
            "name": "",
            "x": x+150,
            "y": y+50,
            "wires": [
                [nodeid]
            ]
        };
    }

    function createNodeRedInstallNode(x,y) {
        return {
            "id": RED.util.generateId(),
            "type": "NodeRedInstall",
            "name": "",
            "x": x+300,
            "y": y+100,
            "wires": [
            ]
        }
    }

    function createGroupForDirectory(dirname, allIds) {
        // no label position means that the label goes top-left.
        return {
            "id": RED.util.generateId(),
            "type": "group",
            "name": `Dir: ${dirname}`,
            "style": {
                "label": true,
                // "label-position": "ne",
                "color": "#001f60",
                "stroke-opacity": "0.75",
                "fill-opacity": "0.5",
                ...dirGrpColours(dirname)
            },
            "nodes": allIds
        }
    }

    function createGroup(pkgname, pversion, allFiles) {
        return {
            "id": RED.util.generateId(), 
             "type": "group",
             "name": "Package: " + pkgname + "@" + pversion,
             "style": {
                "label": true,
                "label-position": "ne",
                "color": "#001f60"
            },
            "nodes": allFiles.map( d => d.id )
        }
    }

    RED.httpAdmin.post("/NodeDevOtpGenerator",
        RED.auth.needsPermission("nodedev.write"),
        (req, res) => {
            try {
                if ( req.body ) {
                    var msg = req.body;
                    var cfgnode = req.body.cfgnode;
                    var node = RED.nodes.getNode(cfgnode.id)

                    RED.util.evaluateNodeProperty(cfgnode.secret, cfgnode.secretType, node, msg, (err, result) => {
                        if (err || (result || "").trim() == "") {
                            res.sendStatus(404);
                        } else {
                            const OTPAuth = require('otpauth');
                            let otp = undefined

                            let opts = {
                                issuer: cfgnode.issuer,
                                label: cfgnode.otplabel,
                                digits: parseInt(cfgnode.digits),
                                secret: result,
                                algorithm: cfgnode.algorithm,
                            };

                            if (cfgnode.otptype == 'totp') {
                                opts.period = parseInt(cfgnode.period)
                                otp = new OTPAuth.TOTP(opts)
                            } else if (cfg.otptype == 'hotp') {
                                opts.counter = parseInt(cfgnode.counter)
                                otp = new OTPAuth.HOTP(opts)
                            } else {
                                return res.send("unknown otp type").status(404)
                            }
                            
                            res.send({data:{otp:otp.generate()}}).status(200)
                        }
                    })
                } else {
                    res.sendStatus(406);
                }
            } catch (ex) {
                console.error("ERROR", ex)
                res.sendStatus(500);
            }
        }
    )

    RED.httpAdmin.post("/NodeFactorySidebarCfg",
        RED.auth.needsPermission("nodedev.write"),
        (req, res) => {
            try {
                if (req.body) {
                    var msg = req.body;
                    if ( msg.pkgname && msg.pkgversion ) {
                        const onFinish = (allFiles) => {

                            var lastNode = allFiles.at(-1);

                            var nodeDevOp = createDevOpsNode(msg.pkgname, msg.pkgversion, allFiles[0].x, allFiles[0].y, allFiles[0].id)
                            var nrInstallNode = createNodeRedInstallNode(lastNode.x, lastNode.y)
                            var tarballNode = createTarballNode(lastNode.x, lastNode.y, nrInstallNode.id)

                            let pkgjson = allFiles.filter( a => {
                                return a.filename == "package.json" && a.dirname == "."
                            })[0];

                            if ( pkgjson) {
                                let ctnt = JSON.parse(pkgjson.template);
                                nodeDevOp.pversion     = ctnt.version
                                nodeDevOp.pdescription = ctnt.description || "Empty"
                                nodeDevOp.pauthorname  = ctnt.author || "Empty"
                                nodeDevOp.pauthoremail = ctnt.author || "Empty"
                            }

                            lastNode.wires[0].push(tarballNode.id)

                            /* group by dirname */
                            let groupByDirectory = {}
                            let dirGroups = []
                            allFiles.forEach(a => {
                                (groupByDirectory[a.dirname] ||= []).push(a.id)
                            })

                            Object.keys(groupByDirectory).forEach(d => {
                                dirGroups.push(createGroupForDirectory(d, groupByDirectory[d]))
                            })

                            let nodeDevNodes = [
                                nodeDevOp,
                                tarballNode,
                                nrInstallNode
                            ]

                            allFiles = [
                                createGroup(msg.pkgname, nodeDevOp.pversion || msg.pkgversion, dirGroups.concat(nodeDevNodes))
                            ].concat(dirGroups).concat(nodeDevNodes).concat(allFiles)

                            RED.comms.publish(
                                "nodedev:perform-autoimport-nodes",
                                RED.util.encodeObject({
                                    msg: "autoimport",
                                    payload: JSON.stringify(allFiles),
                                })
                            );
                        }

                        const onError = (err) => {
                            RED.comms.publish(
                                "nodedev:perform-autoimport-nodes",
                                RED.util.encodeObject({
                                    msg: "notify",
                                    text: "Failed to create nodes for " + msg.pkgname + "@" + msg.pkgversion + ": " + err,
                                    type: "error",
                                })
                            );
                        }

                        if (msg.pkgname.match(/^git@github.com:.+[.]git/i) || msg.pkgname.match(/https?:\/\/github.com\//i) ) {
                            let mth = msg.pkgname.match(/^git@github.com:(.+)\/(.+)[.]git/i) || msg.pkgname.match(/https?:\/\/github.com\/([^\/]+)\/([^\/]+)\/?/i)

                            let tarballUrl = "https://github.com/" + mth[1] + "/" + mth[2] + "/tarball/" + msg.pkgversion

                            RED.comms.publish(
                                "nodedev:perform-autoimport-nodes",
                                RED.util.encodeObject({
                                    msg: "notify",
                                    text: "Importing GitHub repo: <b>" + msg.pkgname + "</b> @ <b>" +  msg.pkgversion + "</b>",
                                    type: "warning",
                                })
                            );

                            import('got').then((module) => {
                                module.got.get(tarballUrl,
                                    {
                                        timeout: {
                                            request: 25000,
                                            response: 25000
                                        },
                                        responseType: 'buffer'
                                    }).then(resp => {
                                        try {
                                            tarHelpers.convertTarFile(RED, resp.body, onFinish, onError);
                                        } catch (err) {
                                            onError(err)
                                        }
                                    }).catch(err => {
                                        onError(err)
                                    });
                            }).catch(err => {
                                onError(err)
                            });
                        } else {
                            pacote.manifest(
                                msg.pkgname + "@" + msg.pkgversion,
                                { registry: msg.pkgregistry || 'https://registry.npmjs.org' }
                            ).then(manifest => {
                                RED.comms.publish(
                                    "nodedev:perform-autoimport-nodes",
                                    RED.util.encodeObject({
                                        msg: "notify",
                                        text: "Found url for <b>" + msg.pkgname + "</b> @ <b>" + msg.pkgversion + "</b>",
                                        type: "warning",
                                    })
                                );

                                import('got').then((module) => {
                                    module.got.get(manifest._resolved,
                                        {
                                            timeout: {
                                                request: 25000,
                                                response: 25000
                                            },
                                            responseType: 'buffer'
                                        }).then(resp => {
                                            try {
                                                tarHelpers.convertTarFile(RED, resp.body, onFinish, onError);
                                            } catch (err) {
                                                onError(err)
                                            }
                                        }).catch(err => {
                                            onError(err)
                                        });
                                }).catch(err => {
                                    onError(err)
                                });

                            }).catch(err => {
                                RED.comms.publish(
                                    "nodedev:perform-autoimport-nodes",
                                    RED.util.encodeObject({
                                        msg: "notify",
                                        text: "Failed to retrieve tgz file for " + msg.pkgname + "@" + msg.pkgversion + ": " + err,
                                        type: "error",
                                    })
                                );
                            })
                        }
                        
                        res.sendStatus(200);
                        
                        RED.comms.publish(
                            "nodedev:perform-autoimport-nodes",
                            RED.util.encodeObject({
                                msg: "notify",
                                text: "Retrieving " + msg.pkgname + "@" + msg.pkgversion,
                                type: "warning",
                            })
                        );
                    } else {
                        res.sendStatus(404);
                    }
                } else {
                    res.sendStatus(405);
                }
            } catch (err) {
                console.error("ERROR", err)
                res.sendStatus(500);
            }
        }
    );
}