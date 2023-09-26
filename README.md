## Node-RED nodes for the development of Node-RED nodes in Node-RED using Node-RED nodes.

*What?*

The idea behind this collection of nodes to democratise the development of Node-RED nodes. Normally the development of your [own nodes](https://nodered.org/docs/creating-nodes/) will require the use of a third-party editor. Something like VSCode or Vim or Atom or god forbid, [Emacs](https://discourse.nodered.org/t/node-red-node-development-in-node-red/81525/2). This requirement makes creating nodes that much harder. So why not create nodes for Node-RED in Node-RED? After all, if you are using Node-RED, you probably understand how to use Node-RED.

So this package tries to provide some supporting nodes for making node development in Node-RED possible and simpler. I have created a set of nodes that fulfill my needs, everything else is bound my imagination. 

*What do these nodes provide?*

- A presentation a nodes package collection in the form of nodes. The nodes that represent a file in the package are called `PkgFile` and are a template representation of the files content. Template as they parsed by mustache so that `{{ replaceme }}` will be replaced. But this can also be deactivated using the syntax specification.
- A `NpmTarball` node will create a gzipped tarball for uploading to [npmjs.com](https://npmjs.com) where all nodes live. This does not need to have since nodes can be installed localling into the Node-RED instance.
- A `NRInstall` node allows for installing the node package into the Node-RED instance in which the flow is running. This means that nodes can be created, tested and modified with Node-RED. There are a few tricks so that Node-RED does not need to be restarted upon updating the package, more below.
- A `NodeFactory` node that can create templates for node development. It also converts existing `.tgz` packages to `PkgFile` nodes, meaning that existing packages can easily be ported to this style of development. 

*This is all very confusing?*

Of course, all this is very meta and it gets worse since these nodes are maintained by this [flow](https://flowhub.org/f/b92be5062203ff69). These nodes are creating in Node-RED in a kind of a bootstrapping for further node development in Node-RED.

This is not an inbuilt extension of Node-RED and obviously a more integrated workflow would be simpler. This is a attempt to find a better solution to node development, one by which testing and fixing nodes becomes faster.

It also gets more confusing since these nodes will open the Node-RED import dialog with pre-defined nodes. These are generally safe to import since that's how this package creates an initial set of nodes for representing a node package. Also importing nodes for an unknown node package is not recommended unless it happens to be your own package!

### Examples 

Examples are included:

- Converting an existing tar-gzip package file into a collection of `PkgFile` nodes for testing and maintaince and development --> [flow](https://flowhub.org/f/eef4037a6d25a1e0)
- `NodeFactory` example of creating a boilerplate node for inclusion in a node package that can be installed into Node-RED --> [flow](https://flowhub.org/f/7bece6814c033925)

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

### Outlook

Wherever the road shall lead, there it will go.
