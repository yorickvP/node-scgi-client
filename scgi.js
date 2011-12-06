/* https://github.com/claudioc/node-scgi/blob/master/scgi.js */
var urlparser = require('url')
,       net = require('net')
, CGIParser = require('cgi/parser')

module.exports = function makeSCGIRequest() {
    var connect_params = [].slice.call(arguments)
    // I could make this a connect-layer, but that would be slow
    // as it would have to query the scgi process if the page can be served
    return function SCGIRequest(req, res) {
        var headers = req.headers
        var resParsed = urlparser.parse(req.url)
        // prepare some headers to send to the scgi server
        var h = {
            "CONTENT_LENGTH"  : headers['content-length'] || "0",
            "SCGI"            : "1",
            "REQUEST_METHOD"  : req.method,
            "REQUEST_URI"     : resParsed.href,
            "SCRIPT_NAME"     : resParsed.pathname,
            "QUERY_STRING"    : (resParsed.query || '') }

        if (headers['content-type'])
            h['CONTENT_TYPE'] = headers['content-type']
        if (headers['authorization'])
            h['AUTH_TYPE'] = headers.authorization.split(' ')[0]

        // add the http request headers
        Object.keys(headers).forEach(function(k) {
            h['HTTP_' + k.replace('-', '_').toUpperCase()] = headers[k] })

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
        message.push(",")

        // connect and send stuff
        var stream = net.connect.apply(net, connect_params)
        stream.on('connect', function() {    
            message.forEach(stream.write.bind(stream))
            // pipe the request body to the scgi server
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

