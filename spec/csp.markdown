<title>Comet Session Protocol</title>
<style> ul { list-style: none; } </style>
<div style="list-style: none; width: 40em; font-family: monospace; text-align: justify;">

<!-- These are in the markdown source as h1's to avoid showing up in generated table of contents -->
<h1>Draft 0.3 Oct 10, 2009</h1>
<h1>Author: Michael Carter</h1>
<h1>Email: CarterMichael@gmail.com</h1>
<h1>Comet Session Protocol </h1>

[TOC]

## 1. Introduction ##

This specification describes the wire protocol that is Comet Session Protocol (CSP), a browser-targeted, bi-directional, and stream-based protocol that is much like TCP, though lacking flow control. CSP is intended to substantially ease the development of real-time web applications, such as chat, document collaboration, games, and stock feeds, to name a few examples.

By implementing the CSP specification, you can guarantee that your real-time web application server will work in all circumstances, no matter your users' browser or proxy/firewall circumstances, and without user experience or latency tradeoffs. 

### 1.1 How to read this specification ###

#### 1.1.1 Server Implementors ####

If you are implementing a Server, this specification should be read as a description of a wire protocol. You should have a working knowledge of the HTTP specification ([RFC 2616][]), and start by finding or implementing an HTTP server, as all CSP traffic is tunneled over HTTP. Before beginning the CSP-specific logic, read over the example CSP transcript a few times, and read the protocol section start to finish. Refer regularly back to the transcript.

  [RFC 2616]: http://www.ietf.org/rfc/rfc2616.txt

#### 1.1.2 Client Implementors ####

If you are implementing a Client, first read the API section <!-- TODO: Add link --> to understand how CSP is exposed to the end developer. Next, skip straight to the protocol transcript and read it a few times. Read the protocol section and pay particular attention to the "Implementing a Client" section. <!-- FIXME: which section again? --> The toughest hurdle when implementing a CSP client by following the specification is that transport implementation details are omitted. In some cases it should be obvious how to make the browser send the appropriate network data, and receive responses. In other cases, for instance with `ActiveX('htmlfile')` streaming, its far less clear exactly how to <!-- FIXME: finish paragraph -->


### 1.2 Brief Background ###

The term Comet refers to the practice of tunneling "real-time" or "server push" style communication within HTTP requests between a browser and an HTTP server. There are very many methods of Comet, referred to by this document as Comet transports, each with strengths and weaknesses that can usually be described by the following traits: 1) Robustness, 2) User Experience, 3) Latency, and 4) Bandwidth. The importance of these traits are listed in approximately descending order. The reason that such a wide range of Comet transports exist and are in use today is twofold: 1) The importance ordering of the above traits may vary between use-cases, and 2) A particular transport's traits may vary between browsers. 

The purpose of CSP is to unify these transports at the level of the wire protocol, making it much simpler to develop real-time web application servers. CSP provides the same message reliability and ordering guarantees offered by the underlying TCP protocol. This may seem a non-issue at first, but browsers open multiple TCP sockets to a particular server and arbitrarily map HTTP requests among them. A CSP session may therefore span multiple TCP sessions, effectively nullifying the ordering guarantees. Furthermore, the internet is an environment that is hostile to network communication, particularly Comet-style requests. Intermediaries such as proxies, firewalls, Anti-virus software, and even the browser's network stack will often interrupt or discard a long-standing request, thus negating the underlying TCP stream's reliability guarantees.


### 1.3 TODO ###

The protocol needs to use a more formalized grammar in order to be clear, particularly with regards to newline characters and json-encoded newlines.

## 2. Recommended Browser API ##

### 2.1 Overview ###

The recommended browser API is named `CometSession`, and looks like this:

    CometSession
        String url
        int readyState
        String sessionKey
    
        constructor()
        function connect(url=null)
        function close()
        function write()
    
        callback onread(String data)
        callback onopen()
        callback onclose(int code)



### 2.2 Ready States ###

    READYSTATE_INITIAL = 0
    READYSTATE_OPENING = 1
    READYSTATE_OPEN    = 2
    READYSTATE_CLOSING = 3
    READYSTATE_CLOSED  = 4


### 2.3 API Usage ###

    session = new CometSession()
    session.onopen = function() { session.write("hello world"); }
    session.onread = function(data) { alert("read: " + data); }
    session.onclose = function(code) { alert("closed: " + code); }
    session.connect("http://example.org/csp")


## 3. Protocol ##



### 3.1 URLs ###

The CSP is based on making HTTP requests to pre-defined URLs, relative to the `SESSION_URL` provided by the user to the `connect` method of the CometSession api. Those urls are computed as follows:

    [SESSION_URL]/comet
    [SESSION_URL]/handshake
    [SESSION_URL]/close
    [SESSION_URL]/send
    [SESSION_URL]/reflect
    [SESSION_URL]/static
    [SESSION_URL]/streamtest


Given the session url of `http://example.org/csp`, the following urls would be used:

    http://example.org/csp/comet
    http://example.org/csp/handshake
    http://example.org/csp/close
    http://example.org/csp/send
    http://example.org/csp/reflect
    http://example.org/csp/static
    http://example.org/csp/streamtest

Each of these URLs is a leaf in the filesystem, except for `static` which is a folder containing various static resources.

The server is recommended to serve a fully functioning CSP client, and that client should put a `CometSession` constructor in the global namespace. The client should be located at the url:

    [SESSION_URL]/static/csp.js


### 3.2 Establishing a Session (Handshake) ###

    csp = new CometSession()

When the user creates a new `csp` object, the `csp.readyState` is set to `READYSTATE_OPEN`.

    csp.connect('http://example.org/csp')


When the user invokes the `connect` method, `csp.readyState` is set to `READYSTATE_OPENING`, and an HTTP request will be made to the `/handshake` url. Either `POST` or `GET` is allowed as the HTTP method. If `GET` is used, the url querystring must have a variable named `d` with the value of a json-encoded object. If `POST` is used, then the `POST` body will be used as the value of `d`. No keys are required to be present in the json object, but additional keys may be present.

The body of the response will similarly contain a json object. The response object must include a `session` key and the value of the actual session key which will be used for all subsequent requests. This request must use the HTTP `GET` verb. No additional keys are required, but additional keys may be present

The json objects used in the handshake are allowed to contain extra fields for the purpose of extensions. These fields are ignored by this specification, but extensions may specify these fields as a means to negotiate extended behavior, such as opting to use an alternative to percent encoding as the binary packet encoding scheme.

NOTE: In order to describe the protocol concisely, some examples in this specification use `HTTP/1.0`, but in practice `HTTP/1.1` is allowed and generally preferred.

    (Client):
    
    HTTP/1.0 POST http://example.org/csp/handshake\r\n
    Content-length:4\r\n
    \r\n
    {}
    
    (Server):
    
    HTTP/1.0 200 OK\r\n
    Content-length: 26\r\n
    Content-type: text/html\r\n
    \r\n
    ({ "session": "abcdefg" })

The `SESSION_KEY` for this CSP session is `abcdefg`, as given by the handshake response. The format of the handshake response may be modified by the `REQUEST_PREFIX` and `REQUEST_SUFFIX` variables described in sections [3.3.3.11 REQUEST_PREFIX][rp] and [3.3.3.12 REQUEST_SUFFIX][rs]. 

[rp]: #33311-request_prefix
[rs]: #33312-request_suffix

`csp.readyState` is changed to `READYSTATE_OPEN`.

The `csp.onopen` callback is issued, and the user may now call `csp.write(data)` without causing an `Invalid Readystate` exception.

If a valid `200` response and session key is not received within a client-defined timeout period, then the `csp.onclose` callback will be issued with status code `ERR_CONNECT_TIMEOUT`. The recommended timeout period is 10 seconds.

### 3.3 Transferring Data ###

After a valid handshake, the client may send and receive packets of data.

#### 3.3.1 Packets ####

A packet is a tuple with three elements, of the general form `[ PACKET_ID, PACKET_ENCODING, PACKET_DATA ]`. `PACKET_ID` and `PACKET_ENCODING` are json integers, and `PACKET_DATA` is a json string. Packets are always delivered in batches, never on their own. (Though a batch can have zero, one, or more packets)

##### 3.3.1.1 Packet ids #####

The `PACKET_ID` of the first packet sent in a session must be `1`, and each subsequent packet must have an integer value that is one higher than the previous packet.

##### 3.3.1.2 Packing encodings #####

The purpose of the packet encoding is to allow both the server and client to encode unsafe bytes so as to ensure that data is able pass through intermediaries in both directions, as some byte values can cause unspecified behavior (usually some kind of failure) in browsers. For example, The 0x00 byte will never be present in the `xhr.responseText` variable even if the server includes it in the HTTP response.

Specifically, the `PACKET_ENCODING` is used to determine how the packet's receiver should parse `PACKET_DATA`. There are two acceptable values of `PACKET_ENCODING`:

A `PACKET_ENCODING` with the value `0` means that the `PACKET_DATA` is encoded in plain text. 

A `PACKET_ENCODING` with the value `1` means that the `PACKET_DATA` is [urlsafe base64 encoded][].

  [urlsafe base64 encoded]: http://tools.ietf.org/html/rfc3548#section-4

A server MUST send packets with `PACKET_ENCODING` = `1` whenever the `PACKET_DATA` contains byte values less than 32 or greater than 126. A server SHOULD use `PACKET_ENCODING` = `0` when `PACKET_DATA` contains only byte values between 32 and 126, inclusive.

A client may choose either encoding `PACKET_ENCODING` scheme. Some Comet transports encode all data in the HTTP url, and so `PACKET_ENCODING` = `1` must always be used.

Both client and server MUST be willing to accept and decode packets that use either value of `PACKET_ENCODING`.

##### 3.3.1.3 Packet Data #####

The `PACKET_DATA` is a json string, and SHOULD always have a non-zero length.

##### 3.3.1.4 The Null Packet #####

The server may send a packet with the json literal null as the value of `PACKET_DATA`. This packet is used by the server to mark the end of the session. The `PACKET_ENCODING` is ignored for the null packet.

Here is an example null packet:
    [43, 0, null]


#### 3.3.2 Packet Batches ####

A packet batch is an array of packets, represented as valid json, except there should be no new-line characters (`U+000A`) in the json representation. There may be json string encoded new line characters (`U+005C` + `U+006E`), however. 


#### 3.3.3 Variables ####

The goal of the downstream Comet protocol is to allow the client to utilize a wide array of Comet transports in three basic modes: polling, long polling, and streaming. To this end, various variables can be set on the session for the purpose of molding the server's interaction to fit the transport and mode chosen by the client. These variables can be set as querystring arguments in the url of any request. Once these variables are set, they persist for all future requests, until explicitly altered. Any permanent variable that cannot be parsed as specified should be ignored. For the purpose of setting variables, POST and GET HTTP requests are treated the same, except a non-empty POST body will override the DATA variable from the querystring (if any.)

There are also per-request variables that have noted functions. These variables are explictly stated to be non-persistent below, meaning that they have no direct bearing on future responses.




    Persistent Variables
    --------------------
    
    Spec Name       var name    default value
    
    REQUEST_PREFIX  "rp"        ""
    REQUEST_SUFFIX  "rs"        ""
    DURATION        "du"         "30"
    IS_STREAMING    "is"        "0"
    INTERVAL        "i"         "0"
    PREBUFFER_SIZE  "ps"        "0"
    PREAMBLE        "p"         ""
    BATCH_PREFIX    "bp"        ""
    BATCH_SUFFIX    "bs"        ""
    GZIP_OK         "g"         ""
    SSE             "se"        ""
    CONTENT_TYPE    "ct"        "text/html"
    PREBUFFER       *see PREBUFFER_SIZE
    SSE_ID          *see SSE
    
    Per-request variables
    ---------------------
    
    Spec Name       var name    default value
    
    SESSION_KEY     "s"         *Required, no default value.
    ACK_ID          "a"         "-1"
    DATA            "d"         ""
    NO_CACHE        "n"         *ignored

##### 3.3.3.1 DURATION #####

The DURATION variable signifies how long the server should leave a Comet request open before completing the response. A value of "0" will cause a response to always be sent immediately after a request is received, thus setting the connection mode to polling. Values of `DURATION` > `0` are used in conjunction with streaming and long polling, and will typically range from 10-45 seconds. A `DURATION` value of `0` will override `IS_STREAMING` with the value `0`, forcing the connection into polling mode.

##### 3.3.3.2 IS_STREAMING #####

The `IS_STREAMING` variable signifies to the server if the Comet HTTP response should be completed after a single batch of packets. A value of `1` for `IS_STREAMING` means that the server will never complete the HTTP response due to a batch of packets, only when the `DURATION` has expired. This is the streaming mode. Any other value for `IS_STREAMING` will cause the server to always complete the HTTP response after sending a batch of packets. In this case, the connection will be in long polling mode.

##### 3.3.3.3 INTERVAL #####

The `INTERVAL` varaible signifies the idle interval (time since the connection opened or the last packet batch was sent) after which an empty batch of packets will be sent. The `INTERVAL` variable will be ignored unless the value of `IS_STREAMING` is `1`. The purpose of the `INTERVAL` variable is to keep intermediaries from closing a streaming connection due to inactivity.

##### 3.3.3.4 PREBUFFER_SIZE #####

The `PREBUFFER_SIZE` variable is parsed as an integer and determines the number of empty bytes (U+0020) to send at the start of the body of each HTTP Comet response. It is ignored unless the value of `IS_STREAMING` is `1`. The purpose of the `PREBUFFER_SIZE` is to meet minimum buffering conditions that cause some intermediaries to delay delivery of initial events in a streaming connection. Obvious example include the IE and Webkit network stacks.

##### 3.3.3.5 PREAMBLE #####

The `PREAMBLE` variable indicates a default string that will be sent at the start of each Comet HTTP response body. These bytes will be sent after any empty bytes resulting from a `PREBUFFER_SIZE` > `0`. The purpose of the `PREAMBLE` is to enable various Comet transports, including iframe streaming and `ActiveX('htmlfile')` streaming. 

##### 3.3.3.6 BATCH_PREFIX #####

The `BATCH_PREFIX` variable indicates a default string that will be sent immediately before each batch of packets. The purpose of the `BATCH_PREFIX` variable is to enable various Comet transports, including jsonp polling/long polling, various forms of script-tag streaming, and sse.

##### 3.3.3.7 BATCH_SUFFIX #####

The `BATCH_SUFFIX` variable indicates a default string that will be sent immediately after each batch of packets. The purpose of the `BATCH_SUFFIX` variable is to enable various Comet transports, including sse and various forms of script-tag streaming.

##### 3.3.3.8 GZIP_OK #####

The `GZIP_OK` variable indicates that it is acceptable to use gzip-encoded responses to any request. No server is required to support gzipping. This variable is used instead of the `Accept-Encoding` header because clients may not always have control of the header. Furthermore, even if a browser purports to support gzip, some streaming transports may be buffered incorrectly when gzip is used. If there there is an existing HTTP Comet request that hasn't been completed when another request changes the value of `GZIP_OK`, that request must immediately complete its response. (See [3.3.4.4 Completing the Response](#3344-completing-the-response).)


##### 3.3.3.9 SSE #####

If the `SSE` variable is `1`, then `SSE_ID` is: `id: %(LAST_MSG_ID)\r\n` where `LAST_MSG_ID` is the packet sequence id of the last message in the batch. Otherwise `SSE_ID` is an empty string. The purpose of the `SSE` variable is to enable the server-sent events transports as defined by the html5 specification. Specifically, this variable causes the browser's `event-source` tag to send a correct `Last-Event-Id` when reconnecting.

##### 3.3.3.10 CONTENT_TYPE #####

The `CONTENT_TYPE` variable is a string that represents the value of the `Content-Type` header that will be used in all HTTP response (both for HTTP Comet response and ordinary responses.) It is used to enable multiple variants of HTML5 and Opera server-sent events, IE XML streaming, and reduce the required value of `PREBUFFER_SIZE` in Webkit. The default value of `CONTENT-TYPE` is `text/html`.

##### 3.3.3.11 REQUEST_PREFIX #####

The `REQUEST_PREFIX` indicates the default string that will be sent in the body of a response immediately before the result of that response. It is used to specify a callback for jsonp-style script-tag requests. Once these variables are set, they persist for all responses to `/handshake` and `/send` requests, until explicitly altered.


##### 3.3.3.12 REQUEST_SUFFIX #####

The `REQUEST_SUFFIX` indicates the default string that is sent in the body of a response immediately following the result of that response. 


##### 3.3.3.13 SESSION_KEY #####

The `SESSION_KEY` is first provided in the handshake by the server, and must be sent by the client in all subsequent requests. Any non-handshake request missing a `SESSION_KEY` is invalid. 


##### 3.3.3.14 ACK_ID #####

The `ACK_ID` variable represents the highest packet sequence id that the client previously received. The value of an `ACK_ID` must be an integer. Any request following the handshake may have an `ACK_ID`. The `ACK_ID` is not persisted.

##### 3.3.3.15 DATA ######

The `DATA` varaible represents a client -> server payload of data encoded as a batch of packets. It is used with requests to `/send` and `/hanshake` (in order to specify the value of the handshake object), and does not persist. 

##### 3.3.3.16 NO_CACHE ######

The `NO_CACHE` variable is ignored by the server. It can be used by the client to keep a browser or proxy cache from caching the response to a comet, handshake, or send request. If necessary, the client should base the value of `NO_CACHE` on the javascript Date object. `NO_CACHE` is not persisted.


#### 3.3.4 Server -> Client Data ####

After a valid handshake, the client must establish a Comet connection with the server. This connection is used for downstream communication (all messages flowing from the server to the browser), and is most simply modeled as a sequence of packets. Each packet has a sequence id and a string payload. The client receives this sequence of packets over a series of HTTP Comet requests. Sometimes, the end of an HTTP Comet response may be lost due to a network or intermediary problem. In fact, an entire HTTP Comet request or response may sometimes be completely lost. For this reason, each time the client re-establishes a Comet request, it must indicate the highest packet sequence id that was previously received via the `ACK_ID` variable. The server is therefore expected to buffer any packets that have yet to be acknowledged, even if they were previously sent one or more times. If the server fails to receive any acknowledgments after a set amount of time, or the client fails to receive any packets, then the session is over, the session key is expired,the ready state is changed to `READY_STATE_CLOSED`, and the onclose cb is triggered with the status code `ERR_SESSION_TIMEOUT`.


##### 3.3.4.1 Comet Requests #####

After the handshake, the CSP client will immediately make an HTTP request to the `/comet` url. Whenever the client can determine that the `/comet` request has completed, successfully or otherwise, the request must be re-issued immediately. There should always be one and only one active `/comet` request after a successful handshake and before the end of the session.


When a Comet HTTP request is received by the server, it will first process any variables given in the request. The variables are encoded as a querystring, which can be given as the body of a `POST` or in the url of a `GET`, must contain the `SESSION_KEY` and `ACK_ID`. If the `Last-Event-Id` is present in the HTTP headers, its value will be used for the ACK_ID, and will supersede the value given in the querystring, if any. After parsing the querystring and headers, the server will adjust the persistent session variables and remove acknowledged packets from the buffer accordingly. 

If the server is holding a previous `/comet` request open with the same SESSION_KEY value, then it should immediately complete the response to that connection without sending any more packets in the response.

The Comet Request must contain the following HTTP headers:

    Pragma: no-cache
    Cache-Control: no-cache

The Comet request should not contain extraneous headers such as:

    User-Agent
    Accept
    Accept-Language
    Content-Type

Most browsers will allow the client to remove headers for some transports, such as those that are XMLHttpRequest-based.

##### 3.3.4.2 Comet Responses #####

The body of each Comet response will contain the `PREBUFFER` immediately at the start, followed immediately by the `PREAMBLE`. Unless the connection is in streaming mode, neither the `PREBUFFER` nor the `PREAMBLE` should be sent until the first packet batch is ready for dispatch, or the response is about to be completed without any packet batches having being sent. 

After a Comet HTTP request has been received and parsed, if any unacknowledged packets remain, the server will immediately dispatch a packet batch containing all unacknowledged packets.

The Comet Response must contain the following HTTP headers:

    Content-Type: %(CONTENT_TYPE)
    Cache-Control: no-cache, must-revalidate

If the HTTP request protocol version is `HTTP/1.1`, and `IS_STREAMING` is `1`, then the response must contain the following HTTP header:

    Transfer-Encoding: chunked

and the body must follow the `Transfer-Encoding: chunked` format for `HTTP/1.1`.

A Comet response should not include extraneous headers.

##### 3.3.4.3 Comet Batch Format#####

Each batch of packets should be sent using the following format:

    %(BATCH_PREFIX)(%(BATCH))%(BATCH_SUFFIX)%(SSE_ID)

The general format `%(VAR_NAME)` should be replaced with the value of the specification variable `VAR_NAME`. `BATCH` represents a packet batch.

For example, assume the default persistent variables, except:

    BATCH_PREFIX = "csp_callback"
    BATCH_SUFFIX = ";"

Also, assume there are 2 waiting packets:

    [ 1, 0, "hello" ]
    [ 2, 0, "world\n" ]

The following string represents the packet batch that would be sent (beginning with c and ending with a semicolon): 

    csp_callback([ [ 1, 0, 'hello' ], [ 2, 0, "world\\n"] ]);


##### 3.3.4.4 Completing the Response #####

An HTTP Comet response is considered completed whenever an HTTP response would be considered completed when: 

1) The `Content-length` header is set, and an HTTP body of that size has been sent. 
2) `HTTP/1.1` `Transfer-Encoding: chunked` is used, and the zero chunk has been sent. 
3) `HTTP/1.0` is used, there is no `Content-length` header, and the TCP stream terminates.

When dispatching a packet batch, the server should choose the appropriate method of replying depending on the values of the persistent session variables that modify the Comet operation. For instance, if polling or long-polling is in use, it is recommended that the server include a `Content-length` header when dispatching a packet batch, as the complete size of the response is known at that point because the response should be completed after a packet batch is sent. In the case of a streaming transport, the connection should not necessarily be completed after sending a packet batch, so the server should not specify a `Content-Length` header. In general, `HTTP/1.1` is preferred to `HTTP/1.0`, so case 2 is preferred to case 3 for streaming mode Comet operation without a `Content-length` header.


#### 3.3.5 Client -> Server Data ####

After a valid handshake, the client may send packets to the server. To send data to the sever, the client makes a request to `/send`, and includes the `SESSION_KEY` and `DATA` variable. The `DATA` variable is a packet batch which contains the desired data. The client should maintain a buffer of packets that it has attempted to send to the server.

The server should respond immediately with a `200 OK`, with `OK` in the body of the response. When the client receives an `OK`, it can consider that any packets contained in the `DATA` variable to be acknowledged and may remove them from the buffer.

If the `csp.send(data)` method is called while a `/send` request is in progress, the client should buffer this data until the `/send` request returns. There must never be more than a single outstanding `/send` request at any given time.

In most cases the client will only send a single packet in any given `/send` request. If the user calls `csp.send(data)` twice while an outstanding `/send` request is in progress, the client can merge the data into a single packet for the next request. 

The only time multiple packets should be sent is when the `/send` request is in progress when `csp.send(data)` is called, and the request is then disrupted by a network interruption so as to never receive `OK` after a suitable timeout. In this case, the client must not merge the new packet with the old unacknowledged packet, but must send both packets.

A client may choose to split up data from a single call to `csp.send(data)` into multiple packets for reasons of transport limits, such as a maximum url limit that impacts `GET` requests.

If the user calls `csp.close()` when their are still unsent or unacknowledged packets, the client must wait until all packets are sent and acknowledged before closing the connection.

If the server closes the connections when there are still unsent or unacknowledged packets, the client should throw out the packets are cease any further requests to `/send`.

`/send` requests and responses should follow the same header rules as `/comet` requests, with respect to including `Cache-Control` and `Pragma` headers, and limiting extraneous headers.


### 3.4 Ending the Session ###

The session can be ended by either the client or the server. The client ends the session by making an HTTP request to the `/close` url.

When a session is ended, due to a `/close` request or because server logic caused the session to end, the server will send a null packet.

Even after the session is ended, a server is expected to continue to buffer any unacknowledged packets until a request is made that acknowledges the packets. The client, likewise, is expected to send a final request to acknowledge the last packet, which should be the [null packet][]. The client should send its final acknowledge HTTP request to the `/send` url.

[null packet]: #3314-the-null-packet


### 3.5 Content reflection ###

Sometimes the client needs a particular static resource in order to make a Comet transport function. The client can make a request to the `/reflect` url, and include a `DATA` variable (specified by the querystring parameter `data`), either in the url or in an HTTP `POST` body, and a page will be returned with the contents of that variable. 

## 4. Example Session ##

This is an example session of a server which acts as a CSP echo server. The client is using a script-tag long polling transport. Communication takes place over two TCP streams designated as `TCP1` and `TCP2`.

    Client (TCP1):                                            
    
    GET /csp/handshake?rp=csp_handshake_cb&rs=; HTTP/1.1\r\n   
    Pragma: no-cache\r\n
    Cache-Control: no-cache\r\n
    Hostname: www.example.com\r\n
    \r\n
    
    
    Server (TCP1):
    
    HTTP/1.1 200 OK\r\n
    Content-Length: 28\r\n
    Cache-Control: no-cache, must-revalidate\r\n
    Content-Type: text/html\r\n
    \r\n
    csp_handshake_cb("abcdefg");
    
    Client (TCP1):
    
    GET /csp/comet?s=abcdefg&bp=csp_packets&bs=; HTTP/1.1\r\n
    Pragma: no-cache\r\n
    Cache-Control: no-cache\r\n
    Hostname: www.example.com\r\n
    \r\n
    
    Client (TCP2):
    
    GET /csp/send?d=%5B1%2C%20Hello%5D&s=abcdefg&rp=csp_sent_cb HTTP/1.1\r\n
    Pragma: no-cache\r\n
    Cache-Control: no-cache\r\n
    Hostname: www.example.com\r\n
    \r\n
    
    Server (TCP2):
    
    HTTP/1.1 200 OK\r\n
    Content-Length: 16\r\n
    Cache-Control: no-cache, must-revalidate\r\n
    Content-Type: text/html\r\n
    \r\n
    csp_sent_cb("OK");
    
    Server (TCP1):
    
    HTTP/1.1 200 OK\r\n
    Content-Length: 33\r\n
    Cache-Control: no-cache, must-revalidate\r\n
    Content-Type: text/html\r\n
    \r\n
    csp_packets([[1,"Hello World"]]);
    
    Client (TCP1):
    
    GET /csp/comet?s=abcdefg&a=1 HTTP/1.1\r\n
    Pragma: no-cache\r\n
    Cache-Control: no-cache\r\n
    Hostname: www.example.com\r\n
    \r\n
    
    
    (no activity for 30 seconds)
    
    Server (TCP1):
    
    HTTP/1.1 200 OK\r\n
    Content-Length: 16\r\n
    Cache-Control: no-cache, must-revalidate\r\n
    Content-Type: text/html\r\n
    \r\n
    csp_packets([]);
    
    Client (TCP1):
    
    GET /csp/comet?s=abcdefg&a=1 HTTP/1.1\r\n
    Pragma: no-cache\r\n
    Cache-Control: no-cache\r\n
    Hostname: www.example.com\r\n
    \r\n
    
    Client (TCP2):
    
    GET /csp/close?s=abcdefg&rp=csp_close_cb HTTP/1.1\r\n
    Pragma: no-cache\r\n
    Cache-Control: no-cache\r\n
    Hostname: www.example.com\r\n
    \r\n
    
    Server (TCP2):
    
    HTTP/1.1 200 OK\r\n
    Content-Length: 19\r\n
    Cache-Control: no-cache, must-revalidate\r\n
    Content-Type: text/html\r\n
    \r\n
    csp_close_cb("OK");
    
    Server (TCP1):
    
    HTTP/1.1 200 OK\r\n
    Content-Length: 20\r\n
    Cache-Control: no-cache, must-revalidate\r\n
    Content-Type: text/html\r\n
    \r\n
    csp_packets([null]);
    
    (End of Session)

## 5. Client Implementation Tips ##

This specification doesn't go into browser-specific implementation details of transports. Below, however, are examples of persistent connection variable values for some of the common transports.

### 5.1 Iframe Streaming ###

    PREAMBLE = """
    <html>
    <head>
    <script>
    function b(packets) {
        parent.receivedPackets(packets);
    }
    </script>
    <body>
    """

    BATCH_PREFIX = "<script>b"
    BATCH_SUFFIX = ";</script>"

### 5.2 XHR Long Polling ###

    Default values suffice.

### 5.3 XHR Polling ###

    DURATION = "0"

### 5.4 XHR Streaming ###

    IS_STREAMING = "1"
    BATCH_SUFFIX =  "\n"

### 5.5 Server-Sent Events Long Polling ###

    BATCH_PREFIX = "data: "
    BATCH_SUFFIX = "\r\n"
    SSE = "1"

### 5.6 Server-Sent Events Streaming ###

    BATCH_PREFIX = "data: "
    BATCH_SUFFIX = "\r\n"
    SSE = "1"
    IS_STREAMING = "1"

</div>

