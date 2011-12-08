/*jshint asi:true laxbreak:true */
/* requires node-protoparse (npm install protoparse).
 * or just install this using npm install scgi-server
----------------------------------------------------------------------------
Copyright (c) YorickvP (contact me on github if you want)

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 * ---------------------------------------------------------------------------*/
/* originally based upon https://github.com/claudioc/node-scgi/blob/master/scgi.js */
var urlparser = require('url')
,       net = require('net')
, CGIParser = require('cgi/parser')

var SERVER_SOFTWARE = "Node/"+process.version;
var SERVER_PROTOCOL = "HTTP/1.1";
var GATEWAY_INTERFACE = "CGI/1.1";

// every argument you pass to this function will be passed to net.connect
module.exports = function makeSCGIRequest(port, host) {
    var connect_params = ('number' == typeof port) ? [port, host] : [port]
    var opts = arguments[('number' == typeof port) ? ('string' == typeof host) ? 2 : 1 : 0] || {}
    if (!opts.mountPoint) opts.mountPoint = ''
    if (!opts.serverName) opts.serverName = 'unknown'
    if (!opts.serverPort) opts.serverPort = 80
    if (!opts.documentRoot) opts.documentRoot = ''
    if (!opts.overrides) opts.overrides = {}
    // I could make this a connect-layer, but that would be slow
    // as it would have to query the scgi process if the page can be served
    return function SCGIRequest(req, res) {
        var headers = req.headers
        var resParsed = urlparser.parse(req.url)
        // prepare some headers to send to the scgi server
        var h = {
            "SCGI"            : "1",
            "CONTENT_LENGTH"  : (headers['content-length'] || "0") + "",
            "GATEWAY_INTERFACE": GATEWAY_INTERFACE,
            "PATH_INFO"       : resParsed.pathname.slice(opts.mountPoint.length),
            "PATH_TRANSLATED" : opts.documentRoot + resParsed.pathname.slice(opts.mountPoint.length),
            "QUERY_STRING"    : resParsed.query || "",
            "REMOTE_ADDR"     : req.connection.remoteAddress || "",
            "REMOTE_NAME"     : req.connection.remoteAddress || "", /* If the hostname is not available for
               performance reasons or otherwise, the server MAY substitute the REMOTE_ADDR value. */
            "REQUEST_METHOD"  : req.method,
            "REQUEST_URI"     : resParsed.href,
            "SCRIPT_NAME"     : opts.mountPoint,
            "SERVER_NAME"     : opts.serverName,
            "SERVER_PORT"     : opts.serverPort + "",
            "SERVER_PROTOCOL" : SERVER_PROTOCOL,
            "SERVER_SOFTWARE" : SERVER_SOFTWARE }

        // somehow breaks weave
        //if (headers['authorization']) {
        //    h['AUTH_TYPE'] = headers.authorization.split(' ')[0]
        //    if (h['AUTH_TYPE'].toLowerCase() == 'basic')
        //        h['REMOTE_USER'] = Buffer(headers.authorization.split(' ')[1], 'base64').toString().split(':')[0] }

        if (headers['content-type'])
            h['CONTENT_TYPE'] = headers['content-type']

        // add the http request headers
        Object.keys(headers).forEach(function(k) {
            h['HTTP_' + k.replace('-', '_').toUpperCase()] = headers[k]+"" })
        
        // add the overrides from opts
        Object.keys(opts.overrides).forEach(function(k) {
            h[k] = opts.overrides[k]+"" })

        var message = Object.keys(h).map(function(headername) {
            // headername + "\0" + data + "\0"
            var ls = [headername, h[headername]].map(Buffer.byteLength)
              , buf = new Buffer(ls[0] + ls[1] + 2)
            buf.write(headername)
            buf[ls[0]] = 0
            buf.write(h[headername], ls[0] + 1)
            buf[ls[0] + 1 + ls[1]] = 0
            return buf })
        // calculate the message length
          , tl = message.reduce(function(p, c) { return p + c.length }, 0)
        // put the message length before the message, and add a ,
        message.unshift(new Buffer(tl + ":"))
        message.push(new Buffer(","))

        // connect and send stuff
        var stream = net.connect.apply(net, connect_params)

        // very evil bug :/ need to pause the stream and buffer some data
        var post_buffer = []
        post_buffer.ondata = post_buffer.push.bind(post_buffer)
        req.on('data', post_buffer.ondata)
        req.pause()
        stream.on('connect', function() {  
            message.forEach(function(x) {
                stream.write(x)})
            // pipe the request body to the scgi server
            req.removeListener('data', post_buffer.ondata)
            post_buffer.forEach(function(x) {
                stream.write(x)})
            req.resume()
            req.pipe(stream) })


        // thankfully, the scgi response is identical to cgi responses, so I can use
        // the excellent work put into the cgi module to parse it
        var cgiResult = new CGIParser(stream)
        // When the blank line after the headers has been parsed, then
        // the 'headers' event is emitted with a Headers instance.
        cgiResult.on('headers', function(headers) {
            headers.forEach(function(header) {
                // Don't set the 'Status' header. It's special, and should be
                // used to set the HTTP response code below.
                if (header.key === 'Status') return
                res.setHeader(header.key, header.value) })
            res.writeHead(parseInt(headers.status) || 200)

            // The response body is piped to the response body of the HTTP request
            cgiResult.pipe(res) })

        stream.on('end', function() {
            if (cgiResult) cgiResult.cleanup() })}}

