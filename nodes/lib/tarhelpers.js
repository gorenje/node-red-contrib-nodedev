module.exports = (function () {

    var tarStream = require('tar-stream');
    var streamx = require('streamx');
    var pakoGzip = require('pako');

    /*
     * there is no indication in a tar file of whether a file is binary or textual.
     * we can only make a guess by the extension of the filename.
     ***/
    var computeFormat = (filename) => {
        var ext = filename.split(".").at(-1);

        return {
            "html": "html",
            "js": "javascript",
            "md": "markdown",
            "json": "json",
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
            "tff": "base64",
        }[ext.toLowerCase()] || "text";
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
                var frmt = computeFormat(header.name.split("/").at(-1));

                allFiles.push({
                    id: RED.util.generateId(),
                    type: "PkgFile",
                    name: header.name.split("/").at(-1),
                    filename: header.name.replace(/^package\//, ''),
                    // @ts-ignore
                    template: Buffer.concat(buffer).toString(frmt == "base64" ? 'base64' : 'utf8'),
                    syntax: "plain", // not mustache templates, these are files.
                    format: frmt,
                    output: "str",
                    x: 250 * Math.floor(allFiles.length / 40),
                    y: 50 * (allFiles.length % 40),
                    wires: [
                        []
                    ]
                })

                next() // ready for next entry
            })

            stream.resume() // just auto drain the stream
        })

        extract.on('finish', function () {
            // all entries read, wire them together
            for (var idx = 0; idx < allFiles.length - 1; idx++) {
                allFiles[idx].wires = [[allFiles[idx + 1].id]];
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
