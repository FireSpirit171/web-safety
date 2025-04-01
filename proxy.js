const http = require("http")
const fs = require("fs")
const { URL } = require("url")
const tls = require("tls")
const path = require("path")
const { execSync } = require("child_process")

const CERTS_DIR = path.join(__dirname, "certs")

const generateCert = hostname => {
    const certPath = path.join(CERTS_DIR, `${hostname}.crt`)
    
    if (!fs.existsSync(certPath)) {
        console.log(`Generating certificate for ${hostname}`)
        try {
            execSync(`./gen_certs.sh ${hostname} ${Date.now()}`, { stdio: "inherit" })
        } catch (err) {
            console.error("Error generating certificate:", err)
            throw new Error("Certificate generation failed")
        }
    }

    const keyPath = "cert.key"
    if (!fs.existsSync(keyPath)) {
        throw new Error("Server key not found")
    }

    return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    }
}

const proxy = http.createServer((clientReq, clientRes) => {
    if (!clientReq.url.startsWith("http")) {
        clientRes.writeHead(400)
        clientRes.end("Bad Request")
        return
    }

    const url = new URL(clientReq.url)
    const options = {
        hostname: url.hostname,
        port: 80,
        path: url.pathname + url.search,
        method: clientReq.method,
        headers: { ...clientReq.headers }
    }
    delete options.headers["proxy-connection"]

    const serverReq = http.request(options, serverRes => {
        clientRes.writeHead(serverRes.statusCode, serverRes.headers)
        serverRes.pipe(clientRes)
    })
    
    clientReq.pipe(serverReq)
    
    serverReq.on("error", err => {
        console.error("Proxy HTTP request error:", err)
        clientRes.writeHead(500)
        clientRes.end("Internal Server Error")
    })
})

proxy.on("connect", (req, clientSocket, head) => {
    const [hostname, port] = req.url.split(":")
    console.log(`CONNECT ${hostname}:${port}`)

    let certs
    try {
        certs = generateCert(hostname)
    } catch (err) {
        console.error(`Error generating certificate for ${hostname}:`, err)
        clientSocket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n")
        clientSocket.end()
        return
    }

    const serverSocket = tls.connect({
        host: hostname,
        port: port || 443,
        rejectUnauthorized: false 
    }, () => {
        clientSocket.write("HTTP/1.1 200 Connection established\r\n\r\n")

        const tlsServer = new tls.TLSSocket(clientSocket, {
            isServer: true,
            key: certs.key,
            cert: certs.cert,
            rejectUnauthorized: false
        })

        tlsServer.pipe(serverSocket)
        serverSocket.pipe(tlsServer)

        if (head && head.length) {
            serverSocket.write(head)
        }
    })

    serverSocket.on("error", err => {
        console.error("Server TLS socket error:", err)
        clientSocket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n")
        clientSocket.end()
    })

    clientSocket.on("error", err => {
        console.error("Client socket error:", err)
        serverSocket.end()
    })
})

module.exports = proxy