import http
import config
import error
try:
    import json
except:
    import simplejson as json

class Session(object):
    def __init__(self, key):
        self.key = key
        self.sentEventId = 1
    
    def send(self, data):
        packet = json.dumps([[self.sentEventId,0, data]])
        self.sentEventId += 1
        response = http.make_request(config.base_url + '/send?s=' + self.key + '&d=' + packet)
        try:
            # XXX: check spec and fully parse response
            assert 'OK' in response.body
        except:
            raise error.CSPException("Invalid send response", response)
        return response

    def comet(self):
        response = http.make_request(config.base_url + '/comet?s=' + self.key)
        output = ""
        try:
            packets = json.loads(response.body[1:-1])
            for packet in packets:
                # XXX: use the proper decode function (urldecode, maybe)
                output += packet[2]
        except:
            raise error.CSPException("Invalid comet response", response)
        return output, response
    

def handshake():
    response = http.make_request(config.base_url + '/handshake?d={}')
    try:
        session_data = json.loads(response.body[1:-1])
        session = Session(session_data['session'])
        return session, response
    except:
        raise error.CSPException("Invalid handshake response", response)

    
