const http = require("http");
const fs = require("fs");
const { URL } = require("url");
const tls = require("tls");
const path = require("path");
const { execSync } = require("child_process");
const zlib = require("zlib");
const { parse: parseCookie } = require("cookie");
const querystring = require("querystring");
const RequestLog = require("./models/RequestLog");

const CERTS_DIR = path.join(__dirname, "certs");

const generateCert = (hostname) => {
  const certPath = path.join(CERTS_DIR, `${hostname}.crt`);
  if (!fs.existsSync(certPath)) {
    console.log(`Generating certificate for ${hostname}`);
    try {
      execSync(`./gen_certs.sh ${hostname} ${Date.now()}`, {
        stdio: "inherit",
      });
    } catch (err) {
      console.error("Error generating certificate:", err);
      throw new Error("Certificate generation failed");
    }
  }

  const keyPath = "cert.key";
  if (!fs.existsSync(keyPath)) {
    throw new Error("Server key not found");
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
};

const handleRequest = async (clientReq, clientRes, isHttps = false) => {
  const fullUrl = isHttps
    ? `https://${clientReq.headers.host}${clientReq.url}`
    : clientReq.url;

  const url = new URL(fullUrl);
  const { method, headers } = clientReq;
  const cookies = headers.cookie ? parseCookie(headers.cookie) : {};
  const getParams = Object.fromEntries(url.searchParams.entries());

  const reqChunks = [];
  clientReq.on("data", (chunk) => reqChunks.push(chunk));

  clientReq.on("end", () => {
    const reqBodyRaw = Buffer.concat(reqChunks).toString();
    let postParams = {};

    if (
      headers["content-type"]?.includes("application/x-www-form-urlencoded")
    ) {
      postParams = querystring.parse(reqBodyRaw);
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: { ...headers },
    };
    delete options.headers["proxy-connection"];

    const transport = isHttps ? require("https") : require("http");

    const serverReq = transport.request(options, (serverRes) => {
      const chunks = [];
      serverRes.on("data", (chunk) => chunks.push(chunk));
      serverRes.on("end", async () => {
        const rawBody = Buffer.concat(chunks);
        let body = rawBody.toString();

        const encoding = serverRes.headers["content-encoding"];
        try {
          if (encoding === "gzip") body = zlib.gunzipSync(rawBody).toString();
          else if (encoding === "deflate")
            body = zlib.inflateSync(rawBody).toString();
        } catch (err) {
          console.warn("Failed to decompress response:", err);
        }

        await RequestLog.create({
          request: {
            method,
            path: url.pathname,
            get_params: getParams,
            headers,
            cookies,
            post_params: postParams,
            body: reqBodyRaw,
          },
          response: {
            code: serverRes.statusCode,
            message: serverRes.statusMessage,
            headers: serverRes.headers,
            body,
          },
        });

        clientRes.writeHead(serverRes.statusCode, serverRes.headers);
        clientRes.end(rawBody);
      });
    });

    serverReq.on("error", (err) => {
      console.error("Upstream request error:", err);
      clientRes.writeHead(500);
      clientRes.end("Internal Server Error");
    });

    if (reqBodyRaw) serverReq.write(reqBodyRaw);
    serverReq.end();
  });
};

const proxy = http.createServer((req, res) => handleRequest(req, res, false));

proxy.on("connect", (req, clientSocket, head) => {
  const [hostname, port] = req.url.split(":");
  console.log(`CONNECT ${hostname}:${port}`);

  let certs;
  try {
    certs = generateCert(hostname);
  } catch (err) {
    console.error(`Certificate generation error for ${hostname}:`, err);
    clientSocket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
    clientSocket.end();
    return;
  }

  clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");

  const tlsOptions = {
    key: certs.key,
    cert: certs.cert,
  };

  const secureSocket = new tls.TLSSocket(clientSocket, {
    isServer: true,
    ...tlsOptions,
  });

  const fakeServer = http.createServer((req, res) =>
    handleRequest(req, res, true)
  );

  fakeServer.emit("connection", secureSocket);

  secureSocket.on("error", (err) => {
    console.error("TLS socket error:", err);
  });
});

module.exports = proxy;
