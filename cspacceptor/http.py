from urlparse import urlparse
from urllib import quote
from eventlet import api
def make_request(url, **kwargs):
    method = kwargs.pop('method', 'GET')
    body = kwargs.pop('body', "")
    version = kwargs.pop('version', "1.1")
    socket = kwargs.pop('socket', None)
    if socket and not socket.open:
        socket = None
    # TODO: make headers the right case
    headers = kwargs
    parsed = urlparse(url)
    path = quote(parsed.path or '/')
    if parsed.query:
        path += '?' + quote(parsed.query)
    host_header = parsed.hostname + ((parsed.port == 80) and "" or ":" + str(parsed.port))
    if not socket:
        socket = StructuredSocket(api.connect_tcp((parsed.hostname, parsed.port or 80)))
    socket.start_transcript()
    socket.send("%s %s HTTP/%s\r\n" % (method.upper(), path, version))
    socket.send("Host: %s\r\n" % (host_header,))
    for key, val in headers.items():
        socket.send('%s: %s\r\n' % (key, val))
    if method.lower() == 'POST' and body:
        socket.send("Content-Length: %s\rn" % (len(body),))
    socket.send('\r\n')
    socket.send(body)
    response = HTTPResponse(socket)
    try:
        response.protocol, response.code, response.status = socket.read_line().split(' ', 2)
        response.code = int(response.code)
        while True:
            header_line = socket.read_line()
            if not header_line: break
            key, val = header_line.split(': ')
            response.headers[key] = val
        if response.get_body_length():
            response.body = socket.read_bytes(response.get_body_length())
        response.transcript = socket.transcript
        return response
    except:        
        socket.close()
        print socket.transcript
        raise
        raise HTTPProtocolError()

        
class StructuredSocket(object):
    def __init__(self, socket):
        self.socket = socket
        self.buffer = ""
        self.transcript = []
        
    def start_transcript(self):
        self.transcript = []
        
    def read_bytes(self, num):
        while len(self.buffer) < num:
            self._read()
        output = self.buffer[:num]
        self.buffer = self.buffer[num:]
        return output
        
    def read_line(self, delimiter='\r\n'):
        while delimiter not in self.buffer:
            self._read()
        i = self.buffer.find(delimiter)
        output = self.buffer[:i]
        self.buffer = self.buffer[i + len(delimiter):]
        return output
    
    def _read(self):
        data = self.socket.recv(4096)
        if not data:
            raise ConnectionLost()
        self.buffer += data
        if self.transcript and self.transcript[-1][0] == 'RECV':
            self.transcript[-1][1] += data
            return
        self.transcript.append(['RECV', data])
    
    def send(self, data):
        self.socket.send(data)
        if not self.transcript:
            self.transcript.append(['SEND', data])
            return
        if self.transcript[-1][0] == 'SEND':
            self.transcript[-1][1] += data
        
    def close(self):
        try:
            self.socket.close()
        except:
            pass
        
class HTTPResponse(object):
    def __init__(self, reader):
        self.reader = reader
        self.version = None
        self.code = None
        self.status = None
        self.headers = {}
        self.body = None
        
    def get_body_length(self):
        return int(self.headers.get('Content-Length', 0))

    def formatted_transcript(self):
        output = ""
        for (dir, data) in self.transcript:
            output += "%s:\n%s\n" % (dir, data.replace('\n', '\\n\n').replace('\r', '\\r'))
        return output
            