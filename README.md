## Node-RED node development in Node-RED

These nodes support the development of nodes in Node-RED by providing a framework for creating tar-balls which can be submitted to NPMjs.com

But also these nodes allow for local installation of nodes to test within Node-RED. If done correnctly, no restart of Node-RED is required, only reloading of the editor.

These nodes are maintained in this [flow](https://flowhub.org/f/b92be5062203ff69) and any pull requests here will be integrated there.


### Examples 

Examples are included, all of which require the installation of the [instrospection](https://flows.nodered.org/node/@gregoriusrippenstein/node-red-contrib-introspection) node package:

- Convertining an existing tar-gzip package file into a collection of PkgFiles for testing and maintaince and development
- NodeFactory example of creating a boilerplate node for inclusion in a node collection

