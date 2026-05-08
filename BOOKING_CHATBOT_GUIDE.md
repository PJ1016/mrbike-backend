# Booking Assistant Chatbot - Complete Implementation Guide

## Overview
A conversational AI chatbot that helps users describe bike issues, recommends services, estimates costs, and guides them through the booking process.

---

## 🎯 What You Need to Do

### Phase 1: Backend Setup (3-4 days)

#### 1.1 Install Dependencies
```bash
npm install openai axios dotenv
```

#### 1.2 Create Chatbot Controller
Create: `service/controller/chatbotController.js`

#### 1.3 Create Chatbot Routes
Create: `service/routes/chatbotRoutes.js`

#### 1.4 Create Chatbot Service Logic
Create: `service/services/chatbotService.js`

#### 1.5 Create Database Model for Chat History
Create: `service/models/ChatHistory.js`

#### 1.6 Environment Variables
Add to `.env`:
```
OPENAI_API_KEY=your_api_key_here
GEMINI_API_KEY=your_gemini_key
```

---

### Phase 2: Frontend Setup (2-3 days)

#### 2.1 Create Chatbot Screen Component
Create: `bike-service-app/app/chatbot.tsx`

#### 2.2 Create Chat UI Components
- `bike-service-app/src/components/ChatMessage.tsx`
- `bike-service-app/src/components/ChatInput.tsx`
- `bike-service-app/src/components/ServiceRecommendation.tsx`

#### 2.3 Create Chatbot API Client
Create: `bike-service-app/src/api/chatbot.ts`

#### 2.4 Add Navigation
Update: `bike-service-app/app/(tabs)/_layout.tsx`

---

## 📋 Detailed Implementation Steps

### STEP 1: Backend - Chatbot Controller

**File: `service/controller/chatbotController.js`**

```javascript
const { OpenAI } = require("openai");
const ChatHistory = require("../models/ChatHistory");
const AdminService = require("../models/adminService");
const UserBike = require("../models/userBikeModel");
const jwt_decode = require("jwt-decode");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for the chatbot
const SYSTEM_PROMPT = `You are a helpful bike service assistant. Your role is to:
1. Listen to users describe their bike issues
2. Ask clarifying questions if needed
3. Recommend relevant services based on the issue
4. Provide estimated costs and time
5. Guide them to book services

When recommending services, be specific and practical. Consider:
- Bike type and engine capacity
- Issue severity
- Preventive maintenance needs
- Seasonal requirements

Always be friendly, professional, and concise.`;

// Initialize chat session
exports.initializeChat = async (req, res) => {
  try {
    const token = req.headers.token;
    const data = jwt_decode(token);
    const userId = data.user_id;

    // Create new chat session
    const chatSession = await ChatHistory.create({
      userId: userId,
      messages: [],
      status: "active",
      createdAt: new Date(),
    });

    res.status(200).json({
      status: 200,
      message: "Chat session initialized",
      sessionId: chatSession._id,
      initialMessage: "Hi! I'm your bike service assistant. Tell me, what's the issue with your bike?",
    });
  } catch (error) {
    console.error("Error initializing chat:", error);
    res.status(500).json({
      status: 500,
      message: "Failed to initialize chat",
      error: error.message,
    });
  }
};

// Send message and get AI response
exports.sendMessage = async (req, res) => {
  try {
    const token = req.headers.token;
    const data = jwt_decode(token);
    const userId = data.user_id;
    const { sessionId, message, bikeId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        status: 400,
        message: "Message and sessionId are required",
      });
    }

    // Get chat history
    const chatSession = await ChatHistory.findById(sessionId);
    if (!chatSession) {
      return res.status(404).json({
        status: 404,
        message: "Chat session not found",
      });
    }

    // Get user's bike info if provided
    let bikeContext = "";
    if (bikeId) {
      const bike = await UserBike.findById(bikeId).populate("variant_id");
      if (bike) {
        bikeContext = `User's bike: ${bike.name} ${bike.model} (${bike.bike_cc}cc)`;
      }
    }

    // Build messages array for OpenAI
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...chatSession.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    if (bikeContext) {
      messages.splice(1, 0, { role: "system", content: bikeContext });
    }

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantMessage = response.choices[0].message.content;

    // Save messages to history
    chatSession.messages.push(
      { role: "user", content: message },
      { role: "assistant", content: assistantMessage }
    );
    await chatSession.save();

    // Extract service recommendations if present
    const recommendations = await extractServiceRecommendations(
      assistantMessage,
      bikeId
    );

    res.status(200).json({
      status: 200,
      message: "Message processed",
      response: assistantMessage,
      recommendations: recommendations,
      sessionId: sessionId,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      status: 500,
      message: "Failed to process message",
      error: error.message,
    });
  }
};

// Extract service recommendations from AI response
async function extractServiceRecommendations(aiResponse, bikeId) {
  try {
    // Use OpenAI to extract structured recommendations
    const extractionPrompt = `
    From this bike service assistant response, extract any service recommendations.
    Return as JSON array with: { serviceName, reason, estimatedCost, estimatedTime }
    
    Response: "${aiResponse}"
    
    Return only valid JSON array, no other text.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: extractionPrompt }],
      temperature: 0.3,
      max_tokens: 300,
    });

    try {
      const recommendations = JSON.parse(response.choices[0].message.content);
      return Array.isArray(recommendations) ? recommendations : [];
    } catch {
      return [];
    }
  } catch (error) {
    console.error("Error extracting recommendations:", error);
    return [];
  }
}

// Get chat history
exports.getChatHistory = async (req, res) => {
  try {
    const token = req.headers.token;
    const data = jwt_decode(token);
    const userId = data.user_id;
    const { sessionId } = req.params;

    const chatSession = await ChatHistory.findById(sessionId);
    if (!chatSession) {
      return res.status(404).json({
        status: 404,
        message: "Chat session not found",
      });
    }

    res.status(200).json({
      status: 200,
      data: chatSession,
    });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({
      status: 500,
      message: "Failed to fetch chat history",
      error: error.message,
    });
  }
};

// Close chat session
exports.closeChat = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const chatSession = await ChatHistory.findByIdAndUpdate(
      sessionId,
      { status: "closed", closedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      status: 200,
      message: "Chat session closed",
      data: chatSession,
    });
  } catch (error) {
    console.error("Error closing chat:", error);
    res.status(500).json({
      status: 500,
      message: "Failed to close chat",
      error: error.message,
    });
  }
};

// Get service recommendations based on issue description
exports.getServiceRecommendations = async (req, res) => {
  try {
    const { issueDescription, bikeId, dealerId } = req.body;

    if (!issueDescription) {
      return res.status(400).json({
        status: 400,
        message: "Issue description is required",
      });
    }

    // Get bike details
    let bikeContext = "";
    if (bikeId) {
      const bike = await UserBike.findById(bikeId).populate("variant_id");
      if (bike) {
        bikeContext = `Bike: ${bike.name} ${bike.model} (${bike.bike_cc}cc)`;
      }
    }

    // Get available services
    let availableServices = [];
    if (dealerId) {
      availableServices = await AdminService.find({ dealer_id: dealerId })
        .populate("base_service_id")
        .limit(20);
    } else {
      availableServices = await AdminService.find()
        .populate("base_service_id")
        .limit(20);
    }

    const servicesContext = availableServices
      .map((s) => `- ${s.base_service_id?.name}: ${s.description}`)
      .join("\n");

    const prompt = `
    ${bikeContext}
    
    Issue: ${issueDescription}
    
    Available services:
    ${servicesContext}
    
    Based on the issue and bike type, recommend the most relevant services.
    Provide: service name, reason, estimated cost, and time.
    Format as JSON array.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 500,
    });

    try {
      const recommendations = JSON.parse(response.choices[0].message.content);
      res.status(200).json({
        status: 200,
        recommendations: recommendations,
      });
    } catch {
      res.status(200).json({
        status: 200,
        message: response.choices[0].message.content,
      });
    }
  } catch (error) {
    console.error("Error getting recommendations:", error);
    res.status(500).json({
      status: 500,
      message: "Failed to get recommendations",
      error: error.message,
    });
  }
};
```

---

### STEP 2: Backend - Chat History Model

**File: `service/models/ChatHistory.js`**

```javascript
const mongoose = require("mongoose");

const chatHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
      required: true,
    },
    messages: [
      {
        role: {
          type: String,
          enum: ["user", "assistant"],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },
    bikeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserBike",
    },
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    recommendedServices: [
      {
        serviceId: mongoose.Schema.Types.ObjectId,
        serviceName: String,
        reason: String,
        estimatedCost: Number,
        estimatedTime: String,
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    closedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatHistory", chatHistorySchema);
```

---

### STEP 3: Backend - Chatbot Routes

**File: `service/routes/chatbotRoutes.js`**

```javascript
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

module.exports = router;
```

---

### STEP 4: Backend - Add Routes to Server

**File: `service/server.js` (Add this line)**

```javascript
const chatbotRoutes = require("./routes/chatbotRoutes");
app.use("/api/v2", chatbotRoutes);
```

---

### STEP 5: Frontend - Chatbot API Client

**File: `bike-service-app/src/api/chatbot.ts`**

```typescript
import { v2Client } from "./client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface ChatSession {
  _id: string;
  messages: ChatMessage[];
  status: "active" | "closed";
}

export interface ServiceRecommendation {
  serviceName: string;
  reason: string;
  estimatedCost: number;
  estimatedTime: string;
}

export const chatbotApi = {
  // Initialize chat session
  initializeChat: () =>
    v2Client.post<{
      status: number;
      sessionId: string;
      initialMessage: string;
    }>("/chat/initialize", {}),

  // Send message to chatbot
  sendMessage: (sessionId: string, message: string, bikeId?: string) =>
    v2Client.post<{
      status: number;
      response: string;
      recommendations: ServiceRecommendation[];
      sessionId: string;
    }>("/chat/message", {
      sessionId,
      message,
      bikeId,
    }),

  // Get chat history
  getChatHistory: (sessionId: string) =>
    v2Client.get<{ status: number; data: ChatSession }>(
      `/chat/history/${sessionId}`
    ),

  // Close chat session
  closeChat: (sessionId: string) =>
    v2Client.post<{ status: number; message: string; data: ChatSession }>(
      `/chat/close/${sessionId}`,
      {}
    ),

  // Get service recommendations
  getRecommendations: (
    issueDescription: string,
    bikeId?: string,
    dealerId?: string
  ) =>
    v2Client.post<{
      status: number;
      recommendations: ServiceRecommendation[];
    }>("/chat/recommendations", {
      issueDescription,
      bikeId,
      dealerId,
    }),
};
```

---

### STEP 6: Frontend - Chat Message Component

**File: `bike-service-app/src/components/ChatMessage.tsx`**

```typescript
import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content }) => {
  const isUser = role === "user";

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userText : styles.assistantText,
          ]}
        >
          {content}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  userContainer: {
    alignItems: "flex-end",
  },
  assistantContainer: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  userBubble: {
    backgroundColor: "#007AFF",
  },
  assistantBubble: {
    backgroundColor: "#E5E5EA",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userText: {
    color: "#FFFFFF",
  },
  assistantText: {
    color: "#000000",
  },
});
```

---

### STEP 7: Frontend - Chat Input Component

**File: `bike-service-app/src/components/ChatInput.tsx`**

```typescript
import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
}) => {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Describe your bike issue..."
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={500}
        editable={!isLoading}
      />
      <TouchableOpacity
        style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={isLoading || !message.trim()}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Ionicons name="send" size={20} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
});
```

---

### STEP 8: Frontend - Service Recommendation Component

**File: `bike-service-app/src/components/ServiceRecommendation.tsx`**

```typescript
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Recommendation {
  serviceName: string;
  reason: string;
  estimatedCost: number;
  estimatedTime: string;
}

interface ServiceRecommendationProps {
  recommendations: Recommendation[];
  onSelectService: (service: Recommendation) => void;
}

export const ServiceRecommendation: React.FC<ServiceRecommendationProps> = ({
  recommendations,
  onSelectService,
}) => {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <ScrollView style={styles.container} horizontal showsHorizontalScrollIndicator={false}>
      {recommendations.map((rec, index) => (
        <TouchableOpacity
          key={index}
          style={styles.card}
          onPress={() => onSelectService(rec)}
        >
          <View style={styles.header}>
            <Text style={styles.serviceName}>{rec.serviceName}</Text>
            <Ionicons name="chevron-forward" size={20} color="#007AFF" />
          </View>
          <Text style={styles.reason}>{rec.reason}</Text>
          <View style={styles.footer}>
            <View style={styles.detail}>
              <Ionicons name="cash" size={16} color="#34C759" />
              <Text style={styles.detailText}>₹{rec.estimatedCost}</Text>
            </View>
            <View style={styles.detail}>
              <Ionicons name="time" size={16} color="#FF9500" />
              <Text style={styles.detailText}>{rec.estimatedTime}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F9F9F9",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 280,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    flex: 1,
  },
  reason: {
    fontSize: 13,
    color: "#666666",
    marginBottom: 12,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: "#333333",
    fontWeight: "500",
  },
});
```

---

### STEP 9: Frontend - Chatbot Screen

**File: `bike-service-app/app/chatbot.tsx`**

```typescript
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { ChatMessage } from "../src/components/ChatMessage";
import { ChatInput } from "../src/components/ChatInput";
import { ServiceRecommendation } from "../src/components/ServiceRecommendation";
import { chatbotApi } from "../src/api/chatbot";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatbotScreen() {
  const route = useRoute();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const flatListRef = useRef<FlatList>(null);
  const bikeId = (route.params as any)?.bikeId;

  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    try {
      setIsLoading(true);
      const response = await chatbotApi.initializeChat();
      setSessionId(response.data.sessionId);
      setMessages([
        {
          id: "1",
          role: "assistant",
          content: response.data.initialMessage,
        },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to initialize chat");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!sessionId) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      setIsLoading(true);
      const response = await chatbotApi.sendMessage(sessionId, message, bikeId);

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.data.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Set recommendations if available
      if (response.data.recommendations?.length > 0) {
        setRecommendations(response.data.recommendations);
      }

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      Alert.alert("Error", "Failed to send message");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectService = (service: any) => {
    // Navigate to booking with selected service
    // This will be implemented based on your navigation structure
    console.log("Selected service:", service);
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatMessage role={item.role} content={item.content} />
        )}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {recommendations.length > 0 && (
        <ServiceRecommendation
          recommendations={recommendations}
          onSelectService={handleSelectService}
        />
      )}

      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  messagesList: {
    paddingVertical: 16,
  },
});
```

---

### STEP 10: Frontend - Add to Navigation

**Update: `bike-service-app/app/(tabs)/_layout.tsx`**

Add this to your tab navigation:

```typescript
{
  name: "chatbot",
  options: {
    title: "Service Assistant",
    tabBarIcon: ({ color }) => (
      <Ionicons name="chatbubble-ellipses" size={24} color={color} />
    ),
  },
}
```

---

## 🔧 Configuration Checklist

- [ ] Install OpenAI package: `npm install openai`
- [ ] Add `OPENAI_API_KEY` to `.env`
- [ ] Create ChatHistory model
- [ ] Create chatbot controller
- [ ] Create chatbot routes
- [ ] Add routes to server.js
- [ ] Create frontend API client
- [ ] Create ChatMessage component
- [ ] Create ChatInput component
- [ ] Create ServiceRecommendation component
- [ ] Create chatbot screen
- [ ] Add to navigation

---

## 🎯 Key Features Implemented

1. **Conversational AI** - Natural language understanding
2. **Service Recommendations** - AI-powered service suggestions
3. **Chat History** - Persistent conversation storage
4. **Cost Estimation** - Estimated pricing for services
5. **Bike Context** - Personalized recommendations based on bike type
6. **Session Management** - Multiple chat sessions support

---

## 📊 Expected Workflow

```
User Opens Chatbot
    ↓
Chat Session Initialized
    ↓
User Describes Issue
    ↓
AI Analyzes & Asks Clarifying Questions
    ↓
AI Recommends Services
    ↓
User Selects Service
    ↓
Redirects to Booking Screen
    ↓
Booking Created
```

---

## 🚀 Next Steps

1. Implement backend first (Steps 1-4)
2. Test API endpoints with Postman
3. Implement frontend (Steps 5-10)
4. Test end-to-end flow
5. Optimize AI prompts based on user feedback
6. Add analytics to track chatbot effectiveness

---

## 💡 Enhancement Ideas

- Add image upload for damage assessment
- Implement multi-language support
- Add FAQ knowledge base
- Implement booking directly from chat
- Add dealer availability checking
- Implement payment integration
- Add review/rating after service completion
