const express = require("express");

const requests = [];
const app = express();
app.use(express.json());

// Логирование всех запросов
app.use((req, res, next) => {
  requests.push({
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
  });
  next();
});

// Эндпоинты API
app.get("/requests", (req, res) => {
  res.json(requests);
});

app.get("/requests/:id", (req, res) => {
  const request = requests[req.params.id];
  if (request) {
    res.json(request);
  } else {
    res.status(404).json({ error: "Request not found" });
  }
});

app.post("/repeat/:id", (req, res) => {
  const request = requests[req.params.id];
  if (request) {
    res.redirect(request.url);
  } else {
    res.status(404).json({ error: "Request not found" });
  }
});

app.post("/scan/:id", (req, res) => {
  const request = requests[req.params.id];
  if (request) {
    res.json({ message: "Scan initiated", request });
  } else {
    res.status(404).json({ error: "Request not found" });
  }
});

module.exports = app;
