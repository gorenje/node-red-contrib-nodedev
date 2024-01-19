module.exports = function(RED) {
  function Core{{ node.name }}Functionality(config) {
    RED.nodes.createNode(this,config);

    var node = this;
    var cfg = config;

    node.on('close', function() {
      node.status({});
    });

    /* msg handler, in this case pass the message on unchanged */
    node.on("input", function(msg, send, done) {
      {{#node.bak2frtcomm}}
        RED.comms.publish("{{node.name}}:message-from-backend",
               RED.util.encodeObject({
                  ...msg,
                 "data": RED._("{{ node.namelwr}}.label.msgfrombackend"),
                })
        );
      {{/node.bak2frtcomm}}
        // How to send a status update
        node.status({ fill: "green", shape: "ring", text: RED._("{{ node.namelwr}}.label.statusset") });

        // Send a message and how to handle errors.
        try {
          try {
            send(msg);
            done();
          } catch ( err ) {
            // use node.error if the node might send subsequent messages
            node.error("error occurred", { ...msg, error: err })
            done();
          }
        } catch (err) {
          // use done if the node won't send anymore messages for the
          // message it received.
          msg.error = err
          done(err.message, msg)
        }
    });
  }

  RED.nodes.registerType("{{ node.name }}", Core{{ node.name }}Functionality);

{{ #node.frt2bakcomm }}
  RED.httpAdmin.post("/{{ node.name }}/:id",
    RED.auth.needsPermission("{{ node.name }}.write"),
    (req, res) => {
      var node = RED.nodes.getNode(req.params.id);
      if (node != null) {
        try {
          if (req.body && node.type == "{{ node.name }}") {
              /* here goes the code for handling a request from the frontend */

              /* this sends the request to the input handler above */
              node.receive(req.body);

              /* this tells the frontend that all went well */
              res.status(200).send({
                "status": "ok"
              })
          } else {
            res.sendStatus(404);
          }
        } catch (err) {
          console.error(err);
          res.status(500).send(err.toString());
          node.error("{{ node.name }}: " + RED._("{{ node.namelwr }}.label.submissionfailed") + ": " + err.toString(), { error: err })
        }
      } else {
        res.sendStatus(404);
      }
    });
  {{/node.frt2bakcomm}}
}
