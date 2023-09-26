module.exports = function(RED) {
  function {{ node.name }}Functionality(config) {
    RED.nodes.createNode(this,config);

    var node = this;
    var cfg = config;

    node.on('close', function() {
      node.status({});
    });

    node.on("input", function(msg, send, done) {
        send(msg);
        done();
    });
  }
  RED.nodes.registerType("{{ node.name }}", {{ node.name }}Functionality);
}
