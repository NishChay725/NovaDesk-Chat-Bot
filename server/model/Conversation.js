const mongoose = require("mongoose");

// Conversation schema - represents a conversation between a visitor and the AI
const conversationSchema = new mongoose.Schema({
  visitorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Visitor",
    required: true,
    },
    messages: 
    {
      type: Date,
      default: Date.now
    }

});

module.exports = mongoose.model("Conversation", conversationSchema);