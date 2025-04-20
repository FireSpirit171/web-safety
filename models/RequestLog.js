const mongoose = require("mongoose");

const RequestLogSchema = new mongoose.Schema({
  request: {
    method: String,
    path: String,
    get_params: Object,
    headers: Object,
    cookies: Object,
    post_params: Object,
    body: String,
  },
  response: {
    code: Number,
    message: String,
    headers: Object,
    body: String,
  },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("RequestLog", RequestLogSchema);
