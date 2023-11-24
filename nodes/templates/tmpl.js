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
                  "data": RED._("{{ node.name}}.notify.msgfrombackend"),
                })
        );
      {{/node.bak2frtcomm}}
        send(msg);
        done();
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
          node.error("{{ node.name }}: " + RED._("{{ node.name }}.notifyf2b.submissionfailed") + ": " + err.toString())
        }
      } else {
        res.sendStatus(404);
      }
    });
  {{/node.frt2bakcomm}}
}
