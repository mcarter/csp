import socket
baseUrl = 'http://localhost:8000'

lastTranscript = []
origSocket = socket.socket
class socket2(socket.socket):
    def connect(self, *args, **kwargs):
        global lastTranscript
        lastTranscript = []
        return origSocket.connect(self, *args, **kwargs)
    def recv(self, *args, **kwargs):
        data = origSocket.recv(self, *args, **kargs)    
        lastTranscript.append(['RECV', data])
        return data

    def send(self, data, *args, **kwargs):
        bsent = origSocket.send(self, data, *args, **kwargs)
        lastTranscript.append('SEND', data[:bsent])
        return bsent
    def sendall(self, data, *args, **kwargs):
        lastTranscript.append(['SEND', data])
        return origSocket.sendall(self, data, *args, **kwargs)
    def makefile(self, *args, **kwargs):
        f = origSocket.makefile(self, *args, **kwargs)
        return FPWrapper(f)
    
class FPWrapper(object):
    def __init__(self, fp):
        self.fp = fp    
    def read(self, *args, **kwargs):
        data = self.fp.read(*args, **kwargs)
        if lastTranscript and lastTranscript[-1][0] == 'RECV':
            lastTranscript[-1][1] += data
        else:
            lastTranscript.append(['RECV', data])
        return data
    def readline(self, *args, **kwargs):
        data = self.fp.readline(*args, **kwargs)
        if lastTranscript and lastTranscript[-1][0] == 'RECV':
            lastTranscript[-1][1] += data
        else:
            lastTranscript.append(['RECV', data])
        return data
    def close(self, *args, **kwargs):
        return self.fp.close(*args, **kwargs)
#    def __getattr__(self, item):
#        return self.fp.__getattr__(self, item)
    
socket.socket = socket2

import urllib2
from urllib2 import HTTPError

try:
    import json
except:
    import simplejson as json

class TestException(Exception):
    def __init__(self, err, transcript=[]):
        self.err = err
        self.transcript = transcript
        
    def makeString(self):
        out = str(self.err) + "\n=Transcript:\n"
        for entry in self.transcript:
            out += '==' + entry[0] + '==' + '\n'
            out += entry[1].replace('\n', '\\n\n').replace('\r', '\\r')
            out += '\n'
        return out
        
    
    def __repr__(self):
        print 'REEEPR'
        return Exception.__repr__(self)
    
tests = []
def test(func):
    tests.append(func)
    return func

@test
def test_handshake_fail_get_missing_d():
    try:
        urllib2.urlopen(baseUrl + '/handshake')
        
        raise TestException("Handshake should fail when a request is made that doesn't provide the 'd' variable.", lastTranscript)
    except HTTPError, response:
        pass

@test
def test_handshake_fail_get_invalid_json():
    try:
        urllib2.urlopen(baseUrl + '/handshake?d={/')
        raise TestException("Handshake should fail when 'd' variable is not valid json", lastTranscript)
    except HTTPError, response:
        pass

@test
def test_handshake_fail_get_wrong_json():
    try:
        urllib2.urlopen(baseUrl + '/handshake?d=[]')
        raise TestException("Handshake should fail when 'd' variable is not not a json object (but is rather a json list, string, number, boolean, or null", lastTranscript)
    except HTTPError, response:
        pass
    
    
def verify_handshake_response(data):    
    if not data.startswith('('):
        raise TestException("Handshake return value should begin with '(' character", lastTranscript)
    if not data.endswith(')'):
        raise TestException("Handshake return valid should end with ')' character", lastTranscript)
    try:
        output = json.loads(data[1:-1])
    except ValueError:
        raise TestException("Handshake must return a valid json object", lastTranscript)
    if not isinstance(output, dict):
        raise TestException("Handshake must return a valid json object", lastTranscript);
    
    if 'session' not in output:
        raise TestException("Handshake response must return a 'session' variable", lastTranscript)
    
@test
def test_handshake_get_valid():
    try:
        data = urllib2.urlopen(baseUrl + '/handshake?d={}').read()
    except HTTPError, response:
        raise TestException("Valid Handshake request received response error with status", lastTranscript)
    verify_handshake_response(data)

@test
def test_handshake_get_valid_w_data():
    try:
        data = urllib2.urlopen(baseUrl + '/handshake?d={"spam":"eggs"}').read()
    except HTTPError, response:
        raise TestException("Valid Handshake request received response error with status", lastTranscript)
    verify_handshake_response(data)


@test
def test_handshake_get_valid_rsrp():
    try:
        data = urllib2.urlopen(baseUrl + '/handshake?d={}&rp=testing&rs=;').read()
    except:
        raise TestException("Handshake returned non-200 status", lastTranscript)
    if not data.startswith('testing'):
        raise TestException("Handshake fails to send back 'rp' value", lastTranscript)
    if not data.endswith(';'):
        raise TestException("Handshake fails to send back 'rs' value", lastTranscript)
    verify_handshake_response(data[len('testing'):(-len(';'))])
    
def main():
    failed = 0
    for test in tests:
        try:
            test()
        except TestException, e:
            failed += 1
            print
            print '================'
            print 'FAILED', failed, test.func_name
            print '**'
            print e.err
            print
            for entry in e.transcript:
                print '==' + entry[0] + '=='
                print entry[1].replace('\n', '\\n\n').replace('\r', '\\r')
                print
            print '================'
            print
        except Exception, e:
            print '================'
            print 'FAILED', failed, test.func_name
            print e
        else:
            print "PASSED", test.func_name
        
if __name__ == "__main__":
    main()