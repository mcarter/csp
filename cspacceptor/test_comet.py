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
        response = http.make_request(config.base_url + '/comet?du=1&s=' + session.key, timeout = 1.2)
        packets = json.loads(response.body[1:-1])
        if packets != []:
            raise CSPException("Invalid comet response: expected empty batch", response)
        print response.formatted_transcript()

    def test_streaming(self):
        def comet_stream(session, handshake_response):
            event = coros.Channel()
            api.spawn(http._make_request, event, config.base_url + '/comet?is=1&bs=;;;&du=5&s=' + session.key, incremental_event=event, socket=handshake_response.socket, reset_transcript=False)
            buffer = ""
            while True:
                data = event.wait()
                if isinstance(data, http.HTTPResponse):
                    break
                if not data:
                    break
                buffer += data
                while ';;;' in buffer:
                    line, buffer = buffer.split(';;;', 1)
                    packets = json.loads(line[1:-1])
                    for packet in packets:
                        # XXX: use the proper decode function (urldecode, maybe)
                        yield packet[2]
        
        session, handshake_response = protocol.handshake()
        session.send('foo')
        comet = comet_stream(session, handshake_response)
        if comet.next() != "foo":
            raise CSPException('Invalid comet stream batch: expected "foo"', response)
        response1 = session.send("bar")
        response2 = session.send("baz")
        handshake_response.append_transcript(response2.socket.transcript)
        timer = api.exc_after(3, CSPException("Did not receive a timely comet packet", handshake_response))
        output1 = comet.next()
        output2 = comet.next()
        timer.cancel()
        if output1 != "bar" or output2 != "baz":
            raise CSPException('Invalid comet stream batch: expected "bar" then "baz"', response)
#        raise CSPException("everything went well", handshake_response)
