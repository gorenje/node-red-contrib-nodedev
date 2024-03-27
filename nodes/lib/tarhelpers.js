module.exports = (function () {

    var tarStream = require('tar-stream');
    var streamx = require('streamx');
    var pakoGzip = require('pako');
    let pathUtil = require('path')

    /*
     * there is no indication in a tar file of whether a file is binary or textual.
     * we can only make a guess by the extension of the filename.
     ***/
    var computeFormat = (filename) => {
        let ext = pathUtil.extname(filename).substr(1).toLowerCase()

        return {
            "html": "html",
            "js": "javascript",
            "md": "markdown",
            "json": "json",
            "txt": "text",
            "css": "css",
            "yaml": "yaml",
            "yml": "yaml",
            "svg": "xml",
            "xml": "xml",
            "ts": "typescript",

            /* binary formats are encoded in base64 */
            "png": "base64",
            "tiff": "base64",
            "tif": "base64",
            "jpg": "base64",
            "jpeg": "base64",
            "bin": "base64",
            "bmp": "base64",
            "gif": "base64",
            "woff2": "base64",
            "woff": "base64",
            "ttf": "base64",
            "mov": "base64",
            "ico": "base64",
            "eot": "base64",
        }[ext] || "text";
    }

    var convertTarFile = (RED, tgzData, onFinish, onError) => {
        const extract = tarStream.extract()

        var allFiles = [];

        extract.on('entry', function (header, stream, next) {
            // header is the tar header
            // stream is the content body (might be an empty stream)
            // call next when you are done with this entry

            var buffer = [];

            stream.on('data', function (data) {
                buffer.push(data)
            });

            stream.on('end', function () {
                let filenameWithPath = header.name.replace(/^package\//, '')
                let filename = pathUtil.basename(filenameWithPath)
                let frmt = computeFormat(filename);

                allFiles.push({
                    id: RED.util.generateId(),
                    type: "PkgFile",
                    name: filename,
                    filename: filenameWithPath,
                    dirname: pathUtil.dirname(filenameWithPath),
                    template: Buffer.concat(buffer).toString(frmt == "base64" ? 'base64' : 'utf8'),
                    syntax: filename == "package.json" ? "mustache" : "plain",
                    format: frmt,
                    output: "str",
                    x: 0,
                    y: 0,
                    wires: [[]]
                })

                next() // ready for next entry
            })

            stream.resume() // just auto drain the stream
        })

        extract.on('finish', function () {
            allFiles = allFiles.sort((a, b) => { return a.dirname < b.dirname ? -1 : (a.dirname >  b.dirname ? 1 : 0) } )

            for (var idx = 0; idx < allFiles.length; idx++) {
                allFiles[idx].x = 250 * Math.floor(idx / 40)
                allFiles[idx].y = 50 * (idx % 40)
                allFiles[idx].wires = allFiles[idx + 1] ? [[allFiles[idx + 1].id]] : [[]]
            }

            onFinish(allFiles)
        })

        extract.on('error', onError );
        var stream = streamx.Readable.from(Buffer.from(pakoGzip.inflate(new Uint8Array(tgzData))))
        stream.pipe(extract);
    }


    let exports = {
        computeFormat: computeFormat,
        convertTarFile: convertTarFile
    }
    
    return exports;
})();
