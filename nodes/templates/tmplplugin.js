module.exports = function (RED) {
  const OnReceiveHookName = "onReceive.{{ node.name }}"
  const OnPreuninstallHookName = "preUninstall.{{ node.name }}"

  function {{ node.name }}OnReceiveHook(evnt) {
    try {
      let nde = RED.nodes.getNode(evnt.destination.id)
      nde.status({ fill: "green", shape: "ring", text: "msg received" })
      setTimeout(() => { nde.status({}) }, 1000)
    } catch (ex) {
      console.error(ex)
    }
  }

  RED.plugins.registerPlugin("msg-tracer-plugin", {
    onadd: () => {
      RED.hooks.add(OnReceiveHookName, {{ node.name }}OnReceiveHook)

      // add hook to uninstall package so that the hook for this
      // plugin are removed.
      RED.hooks.add(OnPreuninstallHookName, (evnt) => {
        if (evnt.module == "{{__.ocb3}} pname {{__.ccb3}}") {
          RED.hooks.remove(OnReceiveHookName)
          RED.hooks.remove(OnPreuninstallHookName)
        }
      })
    }
  })
}