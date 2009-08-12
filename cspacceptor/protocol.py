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
