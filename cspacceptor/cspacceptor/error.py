class CSPException(Exception):
    def __init__(self, msg="", response=None):
        self.msg = msg
        self.response = response
        
    def __str__(self):
        output = self.msg
        if self.response:
            output += '\n(Transcript Below)\n' + self.response.formatted_transcript()
        return output