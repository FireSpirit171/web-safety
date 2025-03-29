const proxy = require("./proxy");
const app = require("./api");

const PROXY_PORT = 8080;
const API_PORT = 8000;

proxy.listen(PROXY_PORT, () => {
  console.log(`Proxy server running on port ${PROXY_PORT}`);
});

app.listen(API_PORT, () => {
  console.log(`API server running on port ${API_PORT}`);
});
