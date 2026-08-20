const mongoose = require("mongoose");

//visitor schema - stores information about the visitor

const visitorSchema = new mongoose.Schema({
  name: { type: String, required: true ,trim: true},
  profession: { type: String, required: true ,trim: true},
  goal: { type: String, required: true ,trim: true},
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Visitor", visitorSchema);