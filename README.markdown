SCGI-Client
===========

[Simple Common Gateway Interface](http://en.wikipedia.org/wiki/Simple_Common_Gateway_Interface) client for [node.js](http://nodejs.org/).

This is basically a rewritten and updated version of [claudioc's node-scgi](https://github.com/claudioc/node-scgi), which I created so I could run firefox-sync behind a node proxy.

Example
=======

    var SCGIClient = require('scgi-client');
    var http = require('http');
    
    http.createServer(SCGIClient(8085)).listen(80)

Usage
=======

    SCGIClient(port, [host], [opts])(request, response)
    SCGIClient(path, [opts])(request, response)

    opts = {
    	mountPoint: '', // when you have http://abc.def.com/blahscript/ and want blahscript to be your scgi path
    	serverName: 'unknown', // ip/hostname of your server, passed to the scgi server
    	serverPort: 80, // port of your server, passed to the scgi server
    	documentRoot: '' } // directory your webserver is serving documents from, passed to scgi server

Installation
============
    
    npm install scgi-client
    
Missing things
==============

AUTH_TYPE and REMOTE_USER headers are not sent, because they seem to break firefox-sync. I've also not implemented them with digest auth.