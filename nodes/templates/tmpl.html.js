(function(){
  
{{ #node.frt2bakcomm }}
    function sendToBackend(node,data = {}) {

      $.ajax({
        url:         "{{ node.name }}/" + node.id,
        type:        "POST",
        contentType: "application/json; charset=utf-8",

        data: JSON.stringify({
          ...data,
          hello:  "world",
        }),

        success: function (resp) {
          RED.notify( node._("{{ node.namelwr }}.label.success"), {
            type: "warning",
            timeout: 2000
          });
        },

        error: function (jqXHR, textStatus, errorThrown) {
          if (jqXHR.status == 404) {
            RED.notify("Node has not yet been deployed, please deploy.", "error");
          } else if (jqXHR.status == 405) {
            RED.notify("Not Allowed.", "error");
          } else if (jqXHR.status == 500) {
            RED.notify(node._("common.notification.error", {
              message: node._("inject.errors.failed")
            }), "error");
          } else if (jqXHR.status == 0) {
            RED.notify(node._("common.notification.error", {
              message: node._("common.notification.errors.no-response")
            }), "error");
          } else {
            RED.notify(node._("common.notification.error", {
              message: node._("common.notification.errors.unexpected", {
                status: jqXHR.status, message: textStatus }) }), "error");
          }
        }
      });
    }
{{ /node.frt2bakcomm }}

  function frontendSupportFunction() {
  }

  var functTwo = (arg) => {

  };
  
  RED.nodes.registerType('{{ node.name }}',{
    color: '{{ node.color }}',
    icon: "{{{ node.icon }}}",
    category: '{{ node.category }}',
    defaults: {
      name: {
        value:"",
      },
    {{#node.minify}}
      l: { value: false },
    {{/node.minify}}
    },

    {{#node.hasinput}}
    inputs: 1,
    {{/node.hasinput}}
    {{^node.hasinput}}
    inputs: 0,
    {{/node.hasinput}}

    outputs: {{ node.outputcount }},

    label: function() {
      return (this.name || this._def.paletteLabel);
    },

    labelStyle: function() {
      return this.name?"node_label_italic":"";
    },

    onpaletteadd: function() {
      {{#node.bak2frtcomm}}
      this.messageFromBackendHandler = (topic,dataobj) => {
        console.log( "here goes the code for handling a message from the backend", topic, dataobj);

        RED.notify(this._("{{ node.namelwr}}.label.commfrombackend"), {
            type: "success",
            timeout: 2000
        });
      };
      RED.comms.subscribe('{{node.name}}:message-from-backend',this.messageFromBackendHandler);
      {{/node.bak2frtcomm}}
    },

    onpaletteremove: function() {
      {{#node.bak2frtcomm}}
      RED.comms.unsubscribe('{{node.name}}:message-from-backend',this.messageFromBackendHandler);
      {{/node.bak2frtcomm}}
    },

    oneditprepare: function() {
    },

    oneditcancel: function() {
    },

    oneditsave: function() {
    },

    oneditresize: function(size) {
    },

    {{#node.hasbutton}}
    button: {
      enabled: function() {
        return !this.changed
      },

      onclick: function () {
        if (this.changed) {
          return RED.notify(RED._("notification.warning", {
            message: RED._("notification.warnings.undeployedChanges")
          }), "warning");
        }

        {{ #node.frt2bakcomm }}
        var that = this;
        sendToBackend(that, { "payload": that._("{{ node.namelwr}}.label.buttonpressed")})
        {{ /node.frt2bakcomm }}

        /* here goes the button code to be executed on click */
      }
    },
    {{/node.hasbutton}}

  });
})();
