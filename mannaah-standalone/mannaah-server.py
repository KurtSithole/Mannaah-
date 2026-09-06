from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import json

PAYMENT_SERVICE = "http://127.0.0.1:8787"

class MannaahHandler(SimpleHTTPRequestHandler):

    def do_POST(self):
        if self.path != "/api/payment/create":
            self.send_error(404, "Not found")
            return

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)

        try:
            req = Request(
                PAYMENT_SERVICE + "/api/payment/create",
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                method="POST",
            )

            with urlopen(req, timeout=15) as response:
                payload = response.read()
                status = response.status

        except HTTPError as e:
            payload = e.read()
            status = e.code

        except Exception as e:
            payload = json.dumps({
                "status": "error",
                "message": str(e)
            }).encode()
            status = 502

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

print("Mannaah gateway listening on http://0.0.0.0:8090")
print("Payment proxy: /api/payment/create -> 127.0.0.1:8787")

ThreadingHTTPServer(("0.0.0.0", 8090), MannaahHandler).serve_forever()
