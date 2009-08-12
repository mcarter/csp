import http
from error import CSPException
import config
import protocol
from eventlet import coros, api
try:
    import json
except:
    import simplejson as json
    

class TestComet(object):
    base_url = config.base_url
    
    def test_duration_timeout(self):
        session, handshake_response = protocol.handshake()
        response = http.make_request(config.base_url + '/comet?du=2&s=' + session, timeout = 3)
        packets = json.loads(response.body[1:-1])
        if packets != []:
            raise CSPException("Invalid comet response: expected empty batch", response)                
        print response.formatted_transcript()
