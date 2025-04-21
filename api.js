const express = require("express");
const http = require("http");
const https = require("https");
const RequestLog = require("./models/RequestLog");
const qs = require("qs");
const fs = require("fs");
const path = require("path");
const followRedirects = require("follow-redirects"); // Добавление поддержки редиректов

const app = express();
app.use(express.json());

app.get("/requests", async (req, res) => {
  const logs = await RequestLog.find().limit(100).sort({ _id: -1 });
  res.json(logs);
});

app.get("/requests/:id", async (req, res) => {
  const log = await RequestLog.findById(req.params.id);
  if (!log) return res.status(404).json({ error: "Request not found" });
  res.json(log);
});

app.post("/repeat/:id", async (req, res) => {
  const log = await RequestLog.findById(req.params.id);
  if (!log) return res.status(404).json({ error: "Request not found" });

  const { method, path, get_params, headers, post_params } = log.request;

  // Проверяем, был ли изначальный запрос на HTTPS
  const isHttps =
    headers.host?.includes(":443") ||
    log.originalProtocol === "https" ||
    headers[":scheme"] === "https"; // если записано в заголовках

  const protocol = isHttps ? "https" : "http";
  const url = `${protocol}://${headers.host}${path}?${qs.stringify(
    get_params
  )}`;

  const data = headers["content-type"]?.includes(
    "application/x-www-form-urlencoded"
  )
    ? qs.stringify(post_params)
    : log.request.body;

  const options = {
    method,
    headers: {
      ...headers,
      host: headers.host, // обязательно
    },
  };

  // Используем модуль follow-redirects для следования за редиректами
  const requestModule = isHttps ? followRedirects.https : followRedirects.http;

  console.log(`[REPEAT] ${method} ${url}`);

  const request = requestModule.request(url, options, (response) => {
    let responseData = "";

    response.on("data", (chunk) => {
      responseData += chunk;
    });

    response.on("end", () => {
      res.json({
        status: response.statusCode,
        statusText: response.statusMessage,
        data: responseData,
      });
    });
  });

  request.on("error", (err) => {
    console.error("Repeat request error:", err);
    res.status(500).json({ error: "Repeat request failed" });
  });

  if (["POST", "PUT", "PATCH"].includes(method)) {
    request.write(data);
  }

  request.end();
});

app.post("/scan/:id", async (req, res) => {
  const log = await RequestLog.findById(req.params.id);
  if (!log) return res.status(404).json({ error: "Request not found" });

  const { headers } = log.request;

  const isHttps =
    headers.host?.includes(":443") ||
    log.originalProtocol === "https" ||
    headers[":scheme"] === "https";

  const protocol = isHttps ? "https" : "http";
  const baseUrl = `${protocol}://${headers.host}`;

  // Загружаем словарь
  const dictPath = path.join(__dirname, "dicts", "short-dicc.txt");
  const lines = fs
    .readFileSync(dictPath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const requestModule = isHttps ? followRedirects.https : followRedirects.http;

  const results = [];
  let completed = 0;
  let running = 0;
  let index = 0;
  const maxConcurrent = 10;

  const scanSingle = (line, callback) => {
    const testPath = line.startsWith("/") ? line : `/${line}`;
    const url = `${baseUrl}${testPath}`;
    const options = {
      method: "GET",
      headers: {
        host: headers.host,
      },
    };

    console.log(`[SCAN] Проверка: ${url}`);

    const req = requestModule.request(url, options, (response) => {
      if (response.statusCode !== 404) {
        results.push({
          path: testPath,
          status: response.statusCode,
          statusText: response.statusMessage,
        });
      }
      response.resume();
      callback();
    });

    req.setTimeout(5000, () => {
      req.abort();
      callback();
    });

    req.on("error", () => callback());
    req.end();
  };

  const runNext = () => {
    while (running < maxConcurrent && index < lines.length) {
      running++;
      scanSingle(lines[index++], () => {
        running--;
        completed++;
        if (completed === lines.length) {
          return res.json({ found: results });
        }
        runNext();
      });
    }
  };

  runNext();
});

module.exports = app;
