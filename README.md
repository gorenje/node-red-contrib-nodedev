## Node-RED nodes for the development of Node-RED nodes in Node-RED using Node-RED nodes.

*What?*

The idea behind this collection of nodes to democratise the development of Node-RED nodes. Normally the development of your [own nodes](https://nodered.org/docs/creating-nodes/) will require the use of a third-party editor. Something like VSCode or Vim or Atom or god forbid, [Emacs](https://discourse.nodered.org/t/node-red-node-development-in-node-red/81525/2). This requirement makes creating nodes that much harder. So why not create nodes for Node-RED in Node-RED? After all, if you are using Node-RED, you probably understand how to use Node-RED.

So this package tries to provide some supporting nodes for making node development in Node-RED possible and simpler. I have created a set of nodes that fulfill my needs, everything else is bound my imagination. 

*What do these nodes provide?*

- A presentation a nodes package collection in the form of nodes. The nodes that represent a file in the package are called `PkgFile` and are a template representation of the files content. Template as they parsed by mustache so that `{{ replaceme }}` will be replaced. But this can also be deactivated using the syntax specification.
- A `NpmTarball` node will create a gzipped tarball for uploading to [npmjs.com](https://npmjs.com) where all nodes live. This does not need to have since nodes can be installed localling into the Node-RED instance.
- A `NRInstall` node allows for installing the node package into the Node-RED instance in which the flow is running. This means that nodes can be created, tested and modified with Node-RED. There are a few tricks so that Node-RED does not need to be restarted upon updating the package, more below.
- A `NodeFactory` node that can create templates for node development. It also converts existing `.tgz` packages to `PkgFile` nodes, meaning that existing packages can easily be ported to this style of development. 
- A `NpmPublish` allows node packages to be published to a node registry, for example [npmjs](https://www.npmjs.com/). The NpmPublish can also be used to publish to private registries, for example, those based on [Verdaccio](https://verdaccio.org/).
- A `OTPGenerate` node can be used to generate an One Time Password (OTP) for publishing nodes to registries. For example the NPMjs.com registry.

*This is all very confusing?*

Of course, all this is very meta and it gets worse since these nodes are maintained by this [flow](https://flowhub.org/f/b92be5062203ff69). These nodes are creating in Node-RED in a kind of a bootstrapping for further node development in Node-RED.

This is not an inbuilt extension of Node-RED and obviously a more integrated workflow would be simpler. This is a attempt to find a better solution to node development, one by which testing and fixing nodes becomes faster.

It also gets more confusing since these nodes will open the Node-RED import dialog with pre-defined nodes. These are generally safe to import since that's how this package creates an initial set of nodes for representing a node package. Also importing nodes for an unknown node package is not recommended unless it happens to be your own package!

### Screencast

For a detailed explanation on how to use these nodes, check out the [screencast](https://blog.openmindmap.org/nodedev) presenting the NodeDev workflow.

### Motivation

A comparison of Node-RED extensions and indirections

| | Link Call |  Subflow | Link Nodes[^4] | Custom Node | Function node | Flow Tab |
|:--|:--|:--|:--|:--|:--|:--|
| Outputs [^1]  | =1 | >=1 | =1 | >=1 | >=1 | - |
| Embeddable[^2] | Yes | Yes | - | Yes | Yes | Yes |
| Modifiable[^3] | Yes | Yes | Yes | - | Yes | Yes |
| Packages[^5] | - | -  | - | Yes | Yes | - |
| Reusable[^6] | - | Yes | - | Yes | - | Yes |
| Button[^7] | - | - | - | Yes | - | - |
| Iconification[^8] | Yes | Yes | Yes | Yes | Yes | - |

What this package does is make custom nodes modifiable within Node-RED.

[^1]: Number of outputs definable. Subflows can have many outputs, link-call nodes only ever have one output. Zero outputs is possible for all extensions, one is standard and more than one is difficult.
[^2]: Embeddable means with the functionality can be included in a flow.  Link-in/-out nodes redirect the flow of messages without those messages returning to the point where they left the original flow.
[^3]: Does Node-RED provide support of modifying the extension? Node-RED does not provide any support for modifying custom nodes *within* Node-RED.
[^4]: A combination of Link-in and Link-out nodes.
[^5]: Can external NPMjs packages be included in the extension?
[^6]: Is there a structured form of reusability for other flows? Subflows are structured to be reused, function nodes are not.
[^7]: Can the extension be triggered with a button, i.e., as an inject node?
[^8]: Can the icon be customised to make for simpler identification?

### Examples 

Examples are included:

- Converting an existing tar-gzip package file into a collection of `PkgFile` nodes for testing and maintaince and development --> [flow](https://flowhub.org/f/eef4037a6d25a1e0)
- `NodeFactory` example of creating a boilerplate node for inclusion in a node package that can be installed into Node-RED --> [flow](https://flowhub.org/f/7bece6814c033925)
- The [FlowHub node package](https://flowhub.org/f/4a831589774ecb04) is developed using the NodeDev nodes
- Also the [introspection node package](https://flowhub.org/f/d73d76db3df96ba2) uses the NodeDev nodes

### Config node with sidebar

The following [animation](https://cdn.openmindmap.org/content/1697462227098_confignode2.gif) shows how the example of a config node with sidebar button works:

![img](https://cdn.openmindmap.org/content/1697462227098_confignode2.gif)

This [animation](https://cdn.openmindmap.org/content/1697013164685_out-fps15.gif) shows the development and installation of a palette node:

![img](https://cdn.openmindmap.org/content/1697013164685_out-fps15.gif)


### Importing existing packages

Using the `Package Import` sidebar, it is also possible to install existing packages to find out how others have built their nodes. 

The gif shows some of the features:

- import existing package,
- view the source files in Node-RED,
- preview of file content is shown in the info box,
- installing package locally is possible using the NodeDevOps node.

This [animation](https://cdn.openmindmap.org/content/1701013172299_nodedevinstall.gif) shows those features:

![img](https://cdn.openmindmap.org/content/1701013172299_nodedevinstall.gif)

Of course making changes to the PkgFile nodes and then reinstalling the package will reflect those changes. This makes it simple to take an existing package, make modifications to suit oneself and then push those changes upstream to the original developer(s).

### Tips

*How to avoid restarting Node-RED?*

Normally when developing nodes for Node-RED, a restart is necessary to flush older versions of the nodes out of Node-RED. This can be avoided by renaming the package each time its installed into Node-RED. There is no need to rename nodes, just the entire once in the `package.json`. Something I do is use a random number as extension to the package name. The workflow then becomes:

1. Create nodes
2. Install nodes
3. Using the palette manager to remove the node package
4. Reload the browser since it too has a cache of node code
5. Make modifications to the nodes
6. Change the package name
7. Reinstall the nodes
8. Repeat from step 3

Since all this happens in the browser, there is no leaving Node-RED, making it more efficient to test and modify nodes. Renaming of packages can be done automagically as demonstrated by the [flow](https://flowhub.org/f/b92be5062203ff69) that maintains these nodes.

### Artifacts

- [Flow that maintains](https://flowhub.org/f/b92be5062203ff69) this codebase
- [GitHub repo](https://github.com/gorenje/node-red-contrib-nodedev)
- [NPMjs node package](https://www.npmjs.com/package/@gregoriusrippenstein/node-red-contrib-nodedev)
- [Node-RED node package](https://flows.nodered.org/node/@gregoriusrippenstein/node-red-contrib-nodedev)

### Similar Projects

- [node-maker](https://github.com/steveorevo/node-maker) which helps to make UI components for nodes in Node-RED.

### Outlook

Wherever the road shall lead, there it will go.

