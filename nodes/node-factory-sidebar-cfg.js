module.exports = function (RED) {
    let pacote = require('pacote');
    let tarHelpers = require('./lib/tarhelpers.js');
    
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
                []
            ]
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

                            /* these are no templates, these are files - no mustache intrepretation */
                            allFiles.forEach(function(element) {
                                element.syntax = "plain"
                            });

                            var lastNode = allFiles[allFiles.length - 1];

                            var nodeDevOp = createDevOpsNode(msg.pkgname, msg.pkgversion, allFiles[0].x, allFiles[0].y, allFiles[0].id)
                            var nrInstallNode = createNodeRedInstallNode(lastNode.x, lastNode.y)
                            var tarballNode = createTarballNode(lastNode.x, lastNode.y, nrInstallNode.id)

                            let pkgjson = allFiles.filter( a => {
                                return a.filename == "package.json"
                            })[0];

                            if ( pkgjson) {
                                let ctnt = JSON.parse(pkgjson.template);
                                nodeDevOp.pversion     = ctnt.version
                                nodeDevOp.pdescription = ctnt.description || "Empty"
                                nodeDevOp.pauthorname  = ctnt.author || "Empty"
                                nodeDevOp.pauthoremail = ctnt.author || "Empty"
                            }

                            lastNode.wires[0].push(tarballNode.id)

                            allFiles.push(nodeDevOp);
                            allFiles.push(tarballNode);
                            allFiles.push(nrInstallNode);

                            allFiles = [
                                createGroup(msg.pkgname, nodeDevOp.pversion || msg.pkgversion, allFiles)
                            ].concat(allFiles);

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
                        
                        pacote.manifest(
                            msg.pkgname + "@" + msg.pkgversion
                        ).then(manifest => {
                            RED.comms.publish(
                                "nodedev:perform-autoimport-nodes",
                                RED.util.encodeObject({
                                    msg: "notify",
                                    text: "Found url for " + msg.pkgname + "@" + msg.pkgversion,
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