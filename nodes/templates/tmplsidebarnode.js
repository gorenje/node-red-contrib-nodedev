module.exports = function (RED) {
  function Config{{ node.name }}Functionality(config) {
    RED.nodes.createNode(this, config)
  }
  
  RED.nodes.registerType('{{ node.name }}Cfg', Config{{ node.name }}Functionality);

{{ #node.frt2bakcomm }}
  RED.httpAdmin.post("/{{ node.name }}Cfg",
    RED.auth.needsPermission("{{ node.name }}Cfg.write"),
    (req, res) => {
      try {
        if (req.body) {
          res.status(200).send({
            "status": "ok",
            "value": "server says, data was : '" + req.body.data + "'"
          })
        } else {
          res.sendStatus(404);
        }
      } catch (err) {
        console.error(err);
        res.status(500).send(err.toString());
      }
    });
{{ /node.frt2bakcomm }}
}