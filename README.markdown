SCGI-Client
===========

[Simple Common Gateway Interface](http://en.wikipedia.org/wiki/Simple_Common_Gateway_Interface) client for [node.js](http://nodejs.org/).

This is basically a rewritten and updated version of [claudioc's node-scgi](https://github.com/claudioc/node-scgi), which I created so I could run firefox-sync behind a node proxy.

Example
=======

    var SCGIClient = require('scgi-client');
    var http = require('http');
    
    http.createServer(SCGIClient(8085)).listen(80)


