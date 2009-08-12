import simplejson
import http
from error import CSPException
import config

class TestReflectResponse(object):
    base_url = config.base_url
    
    def test_reflect_get(self):
        payload = "<script>alert('woot')</script>"
        response = http.make_request(self.base_url +  "/reflect?d=" + payload)
        if response.code != 200:
            raise CSPException("Reflect should return status code 200",
                               response)
        if pyaload != response.body:
            raise CSPException("Reflect returned invalid response body.",
                               response)
