import simplejson
import http
from error import CSPException
import config
import protocol

class TestReflectResponse(object):
    base_url = config.base_url
    
    def test_reflect_get(self):
        session, handshake_response = protocol.handshake()
        payload = "<script>alert('woot')</script>"
        url = self.base_url +  "/reflect?s=" + session + "&d=" + payload
        response = http.make_request(url, reset_transcript=False, socket=handshake_response.socket)
        if response.code != 200:
            raise CSPException("Reflect should return status code 200",
                               response)
        if payload != response.body:
            raise CSPException("Reflect returned invalid response body.",
                               response)
