const http = require("http");
const { URL } = require("url");

const proxy = http.createServer((clientReq, clientRes) => {
  const url = new URL(clientReq.url);
  const options = {
    hostname: url.hostname,
    port: 80,
    path: url.pathname + url.search,
    method: clientReq.method,
    headers: { ...clientReq.headers },
  };

  delete options.headers["proxy-connection"];

  const serverReq = http.request(options, (serverRes) => {
    clientRes.writeHead(serverRes.statusCode, serverRes.headers);
    serverRes.pipe(clientRes);
  });

  clientReq.pipe(serverReq);

  serverReq.on("error", (err) => {
    console.error("Proxy error:", err);
    clientRes.writeHead(500);
    clientRes.end("Internal Server Error");
  });
});

module.exports = proxy;
