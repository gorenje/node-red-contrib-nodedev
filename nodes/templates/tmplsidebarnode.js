module.exports = function (RED) {
  function Config{{ node.name }}Functionality(config) {
    RED.nodes.createNode(this, config)
  }
  RED.nodes.registerType('{{ node.name }}Cfg', Config{{ node.name }}Functionality);
}