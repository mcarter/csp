import http
import config
import error
try:
    import json
except:
    import simplejson as json
    
def handshake():
    response = http.make_request(config.base_url + '/handshake?d={}')
    try:
        session_data = json.loads(response.body[1:-1])
        return session_data['session'], response
    except:
        raise error.CSPException("Invalid handshake response", response)

def send(session, data):
    packet = json.dumps([[1,0, data]])
    response = http.make_request(config.base_url + '/send?s=' + session + '&d=' + packet)
    try:
        # XXX: check spec and fully parse response
        assert 'OK' in response.body
    except:
        raise error.CSPException("Invalid send response", response)
    return response
    
def comet(session):
    response = http.make_request(config.base_url + '/comet?s=' + session)
    output = ""
    try:
        packets = json.loads(response.body[1:-1])
        for packet in packets:
            # XXX: use the proper decode function (urldecode, maybe)
            output += packet[2]
    except:
        raise error.CSPException("Invalid comet response", response)
    return output, response