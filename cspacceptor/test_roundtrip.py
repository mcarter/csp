import simplejson
import http
from error import CSPException
import config
import protocol
from eventlet import coros, api

class TestRoundtrip(object):
    base_url = config.base_url
    
    def test_echo_roundtrip(self):
        session, handshake_response = protocol.handshake()
        def comet_request(event):
            try:
                event.send(session.comet())
            except Exception, e:
                event.send_exception(e)
        def send_request(event):
            try:
                event.send(session.send("abc"))
            except Exception, e:
                event.send_exception(e)
                
        comet_event = coros.event()
        send_event = coros.event()
        api.spawn(comet_request, comet_event)
        api.spawn(send_request, send_event)
        result, comet_response = comet_event.wait()
        send_response = send_event.wait()
        send_response.prepend_transcript(handshake_response.socket.transcript)
        send_response.append_transcript(comet_response.socket.transcript)
        if result != 'abc':
            raise CSPException("Received different data than we sent.", send_response)
        