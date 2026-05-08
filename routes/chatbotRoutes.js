const express = require("express");
const router = express.Router();
const chatbotController = require("../controller/chatbotController");

// Initialize chat session
router.post("/chat/initialize", chatbotController.initializeChat);

// Send message to chatbot
router.post("/chat/message", chatbotController.sendMessage);

// Get chat history
router.get("/chat/history/:sessionId", chatbotController.getChatHistory);

// Close chat session
router.post("/chat/close/:sessionId", chatbotController.closeChat);

// Get service recommendations
router.post("/chat/recommendations", chatbotController.getServiceRecommendations);

// Get all chat sessions for user
router.get("/chat/sessions", chatbotController.getUserChatSessions);

module.exports = router;
