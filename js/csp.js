;(function() {
if (!window.console) {
    window.console = {
        log: function() { }
    }
}
var id = 0;
csp = {
    'readyState': {
        'initial': 0,
        'opening': 1,
        'open':    2,
        'closing': 3,
        'closed':  4
    }
};
csp.util = {};

// Add useful url parsing library to socket.util
(function() {
// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
function parseUri (str) {
    var o   = parseUri.options,
        m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
        uri = {},
        i   = 14;
    while (i--) uri[o.key[i]] = m[i] || "";
    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
        if ($1) uri[o.q.name][$1] = $2;
    });
    return uri;
};
parseUri.options = {
    strictMode: false,
    key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
    q:   {
        name:   "queryKey",
        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
    parser: {
        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
        loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
};
csp.util.parseUri = parseUri;
})();

csp.util.isSameDomain = function(urlA, urlB) {
    var a = csp.util.parseUri(urlA);
    var b = csp.util.parseUri(urlB);
    return ((urlA.port == urlB.port ) && (urlA.host == urlB.host) && (urlA.protocol = urlB.protocol))
}

csp.util.chooseTransport = function(url, options) {
    console.log(location.toString())
    if (location.toString().match('file://').index === 0) {
      console.log('local file, use jsonp')
      return transports.jsonp // XXX      
    }
    console.log('choosing');
    if (csp.util.isSameDomain(url, location.toString())) {
        console.log('same domain, xhr');
        return transports.xhr;
    }
    console.log('not xhr');
    try {
        if (window.XMLHttpRequest && (new XMLHttpRequest()).withCredentials !== undefined) {
            console.log('xhr')
            return transports.xhr;
        }
    } catch(e) { }
    console.log('jsonp');
    return transports.jsonp
}


var PARAMS = {
    'xhrstream':   {"is": "1", "bs": "\n"},
    'xhrpoll':     {"du": "0"},
    'xhrlongpoll': {},
    'sselongpoll': {"bp": "data: ", "bs": "\r\n", "se": "1"},
    'ssestream':   {"bp": "data: ", "bs": "\r\n", "se": "1", "is": "1"}
};

csp.CometSession = function() {
    var self = this;
    self.id = ++id;
    self.url = null;
    self.readyState = csp.readyState.initial;
    self.sessionKey = null;
    var transport = null;
    self.write = function() { throw new Error("invalid readyState"); }
    self.onopen = function() {
//        console.log('onopen', self.sessionKey);
    }

    self.onclose = function(code) {
//        console.log('onclose', code);
    }

    self.onread = function(data) {
//        console.log('onread', data);
    }
    self.connect = function(url, options) {
        options = options || {};
        var timeout = options.timeout || 10000;
        self.readyState = csp.readyState.opening;
        self.url = url;
        console.log('c url', url);
        transport = new (csp.util.chooseTransport(url, options))(self.id, url, options);
        var handshakeTimer = window.setTimeout(self.close, timeout);
        transport.onHandshake = function(data) {
            self.readyState = csp.readyState.open;
            self.sessionKey = data.session;
            self.write = transport.send;
            transport.onPacket = self.onread;
            transport.resume(self.sessionKey, 0, 0);
            clearTimeout(handshakeTimer);
            self.onopen();
        }
        transport.handshake();
    }
    self.close = function() {
        transport.close();
        self.readyState = csp.readyState.closed;
        self.onclose();
    }
}

var Transport = function(cspId, url) {
    console.log('url', url);
    var self = this;
    self.opened = false;
    self.cspId = cspId;
    self.url = url;
    self.buffer = "";
    self.packetsInFlight = null;
    self.sending = false;
    self.sessionKey = null;
    self.lastEventId = null;
    
    this.handshake = function() {
        self.opened = true;
    }
    self.processPackets = function(packets) {
        for (var i = 0; i < packets.length; i++) {
            var p = packets[i];
            if (p === null)
                return self.doClose();
            var ackId = p[0];
            var encoding = p[1];
            var data = p[2];
            if (self.lastEventId != null && ackId <= self.lastEventId)
                continue;
            if (self.lastEventId != null && ackId != self.lastEventId+1)
                throw new Error("CSP Transport Protocol Error");
            self.lastEventId = ackId;
            if (encoding == 1) // percent encoding
                data = unescape(data);
            self.onPacket(data);
        }
    }
    self.resume = function(sessionKey, lastEventId, lastSentId) {
        self.sessionKey = sessionKey;
        self.lastEventId = lastEventId;
        self.lastSentId = lastSentId;
        self.reconnect();
    }
    self.send = function(data) {
        self.buffer += data;
        if (!self.packetsInFlight) {
            self.doSend();
        }
    }
    self.doSend = function() {
        throw new Error("Not Implemented");
    }
    self.close = function() {
        self.stop();
    }
    self.stop = function() {
        self.opened = false;
        clearTimeout(cometTimer);
        clearTimeout(sendTimer);
        clearTimeout(handshakeTimer);
    }
    var cometBackoff = 50; // msg
    var backoff = 50;
    var handshakeTimer = null;
    var sendTimer = null;
    var cometTimer = null;
    self.handshakeCb = function(data) {
        console.log('handshakeCb!');
        if (self.opened) {
            console.log('do onHandshake');
            self.onHandshake(data);
            backoff = 50;
        }
    }
    self.handshakeErr = function() {
        if (self.opened) {
//            handshakeTimer = setTimeout(self.handshake, backoff);
//            backoff *= 2;
        }
    }
    self.sendCb = function() {
        self.packetsInFlight = null;
        backoff = 50;
        if (self.opened) {
            if (self.buffer) {
                self.doSend();
            }
        }
    }
    self.sendErr = function() {
        if (self.opened) {
            sendTimer = setTimeout(self.doSend, backoff);
            backoff *= 50;
        }
    }
    self.cometCb = function(data) {
        if (self.opened) {
            self.processPackets(data);
            self.reconnect();
        }
    }
    self.cometErr = function() {
        if (self.opened) {
            cometTimer = setTimeout(self.reconnect, cometBackoff);
            cometBackoff *= 2;
        }
    }
}

var transports = {};

transports.xhr = function(cspId, url) {
    var self = this;
    Transport.call(self, cspId, url);
    var makeXhr = function() {
        if (window.XDomainRequest) {
            return new XDomainRequest();
        }
        // TODO: use XDomainRequest where available.
        return new XMLHttpRequest();
    }
    var sendXhr = makeXhr();
    var cometXhr = makeXhr();
    if (!csp.util.isSameDomain(url, location.toString())) {
        if (!window.XDomainRequest)
        if (sendXhr.withCredentials === undefined) {
            throw new Error("Invalid cross-domain transport");
        }
    }

    var makeRequest = function(type, url, args, cb, eb, timeout) {
        var xhr;
        if (type == 'send') { xhr = sendXhr; }
        if (type == 'comet') { xhr = cometXhr; }
        xhr.open('POST', self.url + url, true);
        xhr.setRequestHeader('Content-Type', 'text/plain')
        var payload = ""
        for (key in args) {
            payload += key + '=' + args[key] + '&';
        }
        payload = payload.substring(0, payload.length-1)
        var aborted = false;
        var timer = null;
//        console.log('setting on ready state change');
        xhr.onreadystatechange = function() {
            console.log('ready state', xhr.readyState)
            try {
              console.log('status', xhr.status)
            } catch (e) {}
            if (aborted) { 
                //console.log('aborted'); 
                return eb(); 
            }
            if (xhr.readyState == 4) {
                try {
                    if (xhr.status == 200) {
                        clearTimeout(timer);
                        // XXX: maybe the spec shouldn't wrap ALL responses in ( ).
                        //      -mcarter 8/11/09
                        var data = xhr.responseText.substring(1, xhr.responseText.length-1)
//                        console.log('data', xhr.responseText);
                        cb(JSON.parse(data));
//                        cb(eval(xhr.responseText));
                        return;
                    }
///                    console.log('status', xhr.status);
                } catch(e) { 
                    //console.log('exception', e);
                }
//                console.log('ready state 4, no exception, status != 200')
                try {
//                    console.log('xhr.responseText', xhr.responseText);
                } catch(e) { 
                    //console.log('ex'); 
                }
                return eb();
            }
        }
        if (timeout) {
            timer = setTimeout(function() { aborted = true; xhr.abort(); }, timeout*1000);
        }
        console.log('send xhr', payload);
        xhr.send(payload)

    }

    this.handshake = function() {
        self.opened = true;
        makeRequest("send", "/handshake", { d:"{}" }, self.handshakeCb, self.handshakeErr, 10);
    }
    this.doSend = function() {
        var args;
        if (!self.packetsInFlight) {
            self.packetsInFlight = self.toPayload(self.buffer)
            self.buffer = "";
        }
        args = { s: self.sessionKey, d: self.packetsInFlight };
        makeRequest("send", "/send", args, self.sendCb, self.sendErr, 10);
    }
    this.reconnect = function() {
        var args = { s: self.sessionKey, a: self.lastEventId }
        makeRequest("comet", "/comet", args, self.cometCb, self.cometErr, 40);
    }
    this.toPayload = function(data) {
        var payload = escape(JSON.stringify([[++self.lastSentId, 0, data]]));
        return payload
    }
}


csp._jsonp = {};
var _jsonpId = 0;
function setJsonpCallbacks(cb, eb) {
    csp._jsonp['cb' + (++_jsonpId)] = cb;
    csp._jsonp['eb' + (_jsonpId)] = eb;
    return _jsonpId;
}
function removeJsonpCallback(id) {
    delete csp._jsonp['cb' + id];
    delete csp._jsonp['eb' + id];
}
function getJsonpErrbackPath(id) {
    return 'parent.csp._jsonp.eb' + id;
}
function getJsonpCallbackPath(id) {
    return 'parent.csp._jsonp.cb' + id;
}

transports.jsonp = function(cspId, url) {
    var self = this;
    Transport.call(self, cspId, url);
    var createIframe = function() {
        var i = document.createElement("iframe");
        i.style.display = 'block';
        i.style.width = '0';
        i.style.height = '0';
        i.style.border = '0';
        i.style.margin = '0';
        i.style.padding = '0';
        i.style.overflow = 'hidden';
        i.style.visibility = 'hidden';
        return i;
    }
    var ifr = {
        'bar':   createIframe(),
        'send':  createIframe(),
        'comet': createIframe()
    };

    var killLoadingBar = function() {
        window.setTimeout(function() {
            document.body.appendChild(ifr.bar);
            document.body.removeChild(ifr.bar);
        }, 0);
    }
    var rId = 0;
    var makeRequest = function(rType, url, args, cb, eb, timeout) {
//        console.log('makeRequest', rType, url, args, cb, eb, timeout);

        window.setTimeout(function() {
            var temp = ifr[rType];
            // IE6+ uses contentWindow.document, the others use temp.contentDocument.
            var doc = temp.contentDocument || temp.contentWindow.document || temp.document;
            var head = doc.getElementsByTagName('head')[0];
            var errorSuppressed = false;
            function errback(isIe) {
                if (!isIe) {
                    var scripts = doc.getElementsByTagName('script');
                    var s1 = doc.getElementsByTagName('script')[0]; 
                    var s2 = doc.getElementsByTagName('script')[1]; 
                    s1.parentNode.removeChild(s1);
                    s2.parentNode.removeChild(s2);
                }
                removeJsonpCallback(jsonpId);
                if (!errorSuppressed && self.opened) {
                    eb.apply(null, arguments);
                }
            }
            function callback() {
                errorSuppressed = true;
                if (self.opened) {
                    cb.apply(null, arguments);
                }
                else {
//                    console.log('suppressing callback', rType, url, args, cb, eb, timeout);
                }
            }
            var jsonpId = setJsonpCallbacks(callback, errback);
            url += '?'
            for (key in args) {
                url += key + '=' + args[key] + '&';
            }
            if (rType == "send") {
                url += 'rs=;&rp=' + getJsonpCallbackPath(jsonpId);
            }
            else if (rType == "comet") {
                url += 'bs=;&bp=' + getJsonpCallbackPath(jsonpId);
            }
            var s = doc.createElement("script");
            s.src = self.url + url;
            head.appendChild(s);

            if (s.onreadystatechange === null) { // IE
                // TODO: I suspect that if IE gets half of an HTTP body when
                //       the connection resets, it will go ahead and execute
                //       the script tag as if all were well, and then fail
                //       silently without a loaded event. For this reason
                //       we should probably also set a timer of DURATION + 10
                //       or something to catch timeouts eventually.
                //      -Mcarter 8/11/09
                s.onreadystatechange = function() {
                    if (s.readyState == "loaded") {
                        errback(true);
                    }
                }
            }
            else {
                var s = doc.createElement("script");
                s.innerHTML = getJsonpErrbackPath(jsonpId) + '(false);'
                head.appendChild(s);
                killLoadingBar();
            }
        }, 0);

    }

    this.handshake = function() {
        self.opened = true;
        makeRequest("send", "/handshake", {d: "{}"}, self.handshakeCb, self.handshakeErr, 10);
    }
    this.doSend = function() {
        var args;
        if (!self.packetsInFlight) {
            self.packetsInFlight = self.toPayload(self.buffer)
            self.buffer = "";
        }
        args = { s: self.sessionKey, d: self.packetsInFlight };
        makeRequest("send", "/send", args, self.sendCb, self.sendErr, 10);
    }
    this.reconnect = function() {
        var args = { s: self.sessionKey, a: self.lastEventId }
        makeRequest("comet", "/comet", args, self.cometCb, self.cometErr, 40);
    }
    this.toPayload = function(data) {
        var payload = escape(JSON.stringify([[++self.lastSentId, 0, data]])); // XXX: firefox only!
        return payload
    }
    document.body.appendChild(ifr.send);
    document.body.appendChild(ifr.comet);
    killLoadingBar();
}







// Add csp.JSON 
/*
    http://www.JSON.org/json2.js
    2009-06-29

    Public Domain.

    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
    This code should be minified before deployment.
    See http://javascript.crockford.com/jsmin.html

*/


var JSON = {};
csp.JSON = JSON;
csp.CometSession.prototype.JSON = JSON;
(function () {

    function f(n) {
        // Format integers to have at least two digits.
        return n < 10 ? '0' + n : n;
    }

    if (typeof Date.prototype.toJSON !== 'function') {

        Date.prototype.toJSON = function (key) {

            return isFinite(this.valueOf()) ?
                   this.getUTCFullYear()   + '-' +
                 f(this.getUTCMonth() + 1) + '-' +
                 f(this.getUTCDate())      + 'T' +
                 f(this.getUTCHours())     + ':' +
                 f(this.getUTCMinutes())   + ':' +
                 f(this.getUTCSeconds())   + 'Z' : null;
        };

        String.prototype.toJSON =
        Number.prototype.toJSON =
        Boolean.prototype.toJSON = function (key) {
            return this.valueOf();
        };
    }

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        },
        rep;


    function quote(string) {

        escapable.lastIndex = 0;
        return escapable.test(string) ?
            '"' + string.replace(escapable, function (a) {
                var c = meta[a];
                return typeof c === 'string' ? c :
                    '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"' :
            '"' + string + '"';
    }


    function str(key, holder) {


        var i,          // The loop counter.
            k,          // The member key.
            v,          // The member value.
            length,
            mind = gap,
            partial,
            value = holder[key];


        if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }


        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }


        switch (typeof value) {
        case 'string':
            return quote(value);

        case 'number':


            return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':



            return String(value);

        case 'object':

            if (!value) {
                return 'null';
            }

            gap += indent;
            partial = [];

            if (Object.prototype.toString.apply(value) === '[object Array]') {


                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }

                v = partial.length === 0 ? '[]' :
                    gap ? '[\n' + gap +
                            partial.join(',\n' + gap) + '\n' +
                                mind + ']' :
                          '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }

            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    k = rep[i];
                    if (typeof k === 'string') {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            } else {


                for (k in value) {
                    if (Object.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }

            v = partial.length === 0 ? '{}' :
                gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' +
                        mind + '}' : '{' + partial.join(',') + '}';
            gap = mind;
            return v;
        }
    }

    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {

            var i;
            gap = '';
            indent = '';


            if (typeof space === 'number') {
                for (i = 0; i < space; i += 1) {
                    indent += ' ';
                }


            } else if (typeof space === 'string') {
                indent = space;
            }


            rep = replacer;
            if (replacer && typeof replacer !== 'function' &&
                    (typeof replacer !== 'object' ||
                     typeof replacer.length !== 'number')) {
                throw new Error('JSON.stringify');
            }

            return str('', {'': value});
        };
    }

    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {

            var j;

            function walk(holder, key) {

                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }

            cx.lastIndex = 0;
            if (cx.test(text)) {
                text = text.replace(cx, function (a) {
                    return '\\u' +
                        ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }

            if (/^[\],:{}\s]*$/.
test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@').
replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

                j = eval('(' + text + ')');


                return typeof reviver === 'function' ?
                    walk({'': j}, '') : j;
            }

            throw new SyntaxError('JSON.parse');
        };
    }
}());
})();




