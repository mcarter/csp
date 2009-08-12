import simplejson
import http
from error import CSPException
import config

class TestHandshakeResponse(object):
    base_url = config.base_url
    
    def _raise_exception(self, message, response=None):
        raise CSPException(message, response)
    
    def _expect_failure_for_url(self, url, exception_message=None):
        response = http.make_request(self.base_url + url)
        if response.code == 200:
            self._raise_exception(exception_message, response)
        
    def test_handshake_fail_missing_d(self):
        self._expect_failure_for_url("/handshake",
                                     "Handshake should fail when a request "
                                     "is made that doesn't provide the 'd' "
                                     "variable.")
                                     
    def test_handshake_fail_invalid_json(self):
        self._expect_failure_for_url("/handshake?d={/",
                                     "Handshake should fail when 'd' "
                                     "variable is not valid json")
    
    def test_handshake_fail_with_wrong_json(self):
        self._expect_failure_for_url("/handshake?d=[]",
                                     "Handshake should fail when 'd' "
                                     "variable is not not a json object "
                                     "(but is rather a json list, string, "
                                     "number, boolean, or null")
    
    
    def _verify_handshake_response(self, data, response):    
        if not data.startswith('('):
            raise CSPException("Handshake return value should begin with '(' "
                               "character", response)
        if not data.endswith(')'):
            raise CSPException("Handshake return valid should end with ')' "
                               "character", response)
        try:
            output = simplejson.loads(data[1:-1])
        except ValueError:
            raise CSPException("Handshake must return a valid json object", 
                               response)
        if not isinstance(output, dict):
            raise CSPException("Handshake must return a valid json object",
                               response)
        if 'session' not in output:
            raise TestException("Handshake response must return a 'session' variable", 
                                response)    
    
    def test_handshake_get_valid(self):
        response = http.make_request(self.base_url +  "/handshake?d={}")
        print 'response.body is', response.body
        if response.code != 200:
            raise CSPException("Valid Handshake should return status code 200",
                               response)
        self._verify_handshake_response(response.body, response)
    
    def test_handshake_get_valid_rsrp(self):
        response = http.make_request(self.base_url +  "/handshake?d={}&rp=testing&rs=;")
        if response.code != 200:
            raise CSPException("Valid Handshake should return status code 200",
                               response)
        if not response.body.startswith('testing'):
            raise CSPException("Handshake returns invalid REQUEST_PREFIX",
                               response)
        if not response.body.endswith(';'):
            raise CSPException("Handshake returns invalid REQUEST_SUFFIX",
                               response)
        reply = response.body[len('testing'):-len(';')]
        self._verify_handshake_response(reply, response)
        
    def test_handshake_get_valid_w_data(self):
        response = http.make_request(self.base_url + '/handshake?d={"spam":"eggs"}')
        if response.code != 200:
            raise CSPException("Valid Handshake should return status code 200",
                               response)
        self._verify_handshake_response(response.body, response)
