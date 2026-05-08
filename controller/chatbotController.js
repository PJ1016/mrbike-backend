const { AzureOpenAI } = require("openai");
const ChatHistory = require("../models/ChatHistory");
const AdminService = require("../models/adminService");
const UserBike = require("../models/userBikeModel");
const jwt_decode = require("jwt-decode");

const openai = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.OPENAI_API_VERSION || "2024-02-15-preview",
});

// System prompt for the chatbot
const SYSTEM_PROMPT = `You are a helpful and friendly bike service assistant. Your role is to:
1. Listen to users describe their bike issues in a conversational way
2. Ask clarifying questions if needed (bike model, mileage, etc.)
3. Recommend relevant services based on the issue and bike type
4. Provide EXACT pricing in Indian Rupees (₹) from available services
5. Show service details including estimated time
6. Guide them through the booking process

IMPORTANT:
- Always provide prices in Indian Rupees (₹)
- Be specific about service names and prices
- If user asks for lower prices, show budget-friendly options
- Consider bike type and service requirements
- Provide realistic time estimates
- Format prices clearly: "₹500", "₹1000", etc.
- Always mention service name, price, and estimated time

When recommending services, be specific and practical. Consider:
- Bike type and engine capacity
- Issue severity and urgency
- Preventive maintenance needs
- Seasonal requirements (monsoon, summer, winter)
- Common issues for the bike model

Always be friendly, professional, concise, and use simple language.`;

// Get available services from database
async function getAvailableServices() {
  try {
    const services = await AdminService.find()
      .populate("base_service_id")
      .limit(50)
      .lean();
    
    if (!services || services.length === 0) {
      return "No services available";
    }

    // Format services for the prompt
    const servicesList = services.map(s => {
      const baseName = s.base_service_id?.name || "Unknown Service";
      const price = s.price || "Contact for price";
      const description = s.description || "";
      return `- ${baseName}: ₹${price} (${description})`;
    }).join("\n");

    return servicesList;
  } catch (error) {
    console.error("Error fetching services:", error);
    return "Unable to fetch services";
  }
}

// Initialize chat session
exports.initializeChat = async (req, res) => {
  try {
    const token = req.headers.token;
    if (!token) {
      return res.status(401).json({
        status: 401,
        message: "Authorization token required",
      });
    }

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
      initialMessage:
        "Hi! 👋 I'm your bike service assistant. Tell me, what's the issue with your bike? Whether it's a strange noise, performance problem, or just time for maintenance, I'm here to help!",
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
    if (!token) {
      return res.status(401).json({
        status: 401,
        message: "Authorization token required",
      });
    }

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

    // Get available services from database
    const availableServices = await getAvailableServices();

    // Build messages array for Azure OpenAI with real services
    const messages = [
      { 
        role: "system", 
        content: SYSTEM_PROMPT + "\n\nAvailable Services:\n" + availableServices 
      },
      ...chatSession.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    if (bikeContext) {
      messages.splice(1, 0, { role: "system", content: bikeContext });
    }

    // Call Azure OpenAI API
    const response = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o-mini",
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
    console.error("Error details:", {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      response: error.response?.data,
    });
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
    Return as JSON array with objects containing: { serviceName, reason, estimatedCost, estimatedTime }
    
    If no services are recommended, return empty array [].
    
    Response: "${aiResponse}"
    
    Return ONLY valid JSON array, no other text. Example format:
    [
      { "serviceName": "Oil Change", "reason": "Regular maintenance", "estimatedCost": 500, "estimatedTime": "30 mins" }
    ]
    `;

    const response = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o-mini",
      messages: [{ role: "user", content: extractionPrompt }],
      temperature: 0.3,
      max_tokens: 300,
    });

    try {
      const content = response.choices[0].message.content.trim();
      let recommendations = JSON.parse(content);
      
      if (!Array.isArray(recommendations)) {
        return [];
      }

      // Enrich recommendations with service IDs from database
      const enrichedRecommendations = await Promise.all(
        recommendations.map(async (rec) => {
          try {
            // Find matching service in database
            const service = await AdminService.findOne({
              $or: [
                { "base_service_id.name": { $regex: rec.serviceName, $options: "i" } },
                { description: { $regex: rec.serviceName, $options: "i" } }
              ]
            }).populate("base_service_id");

            return {
              ...rec,
              serviceId: service?._id?.toString() || null,
              baseName: service?.base_service_id?.name || rec.serviceName,
              variantId: service?._id?.toString() || null,
            };
          } catch (err) {
            console.error("Error enriching recommendation:", err);
            return rec;
          }
        })
      );

      return enrichedRecommendations;
    } catch (parseError) {
      console.log("Could not parse recommendations as JSON, returning empty array");
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
    if (!token) {
      return res.status(401).json({
        status: 401,
        message: "Authorization token required",
      });
    }

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
    const token = req.headers.token;
    if (!token) {
      return res.status(401).json({
        status: 401,
        message: "Authorization token required",
      });
    }

    const { sessionId } = req.params;

    const chatSession = await ChatHistory.findByIdAndUpdate(
      sessionId,
      { status: "closed", closedAt: new Date() },
      { new: true }
    );

    if (!chatSession) {
      return res.status(404).json({
        status: 404,
        message: "Chat session not found",
      });
    }

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
    const token = req.headers.token;
    if (!token) {
      return res.status(401).json({
        status: 401,
        message: "Authorization token required",
      });
    }

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
    Format as JSON array with objects: { serviceName, reason, estimatedCost, estimatedTime }
    Return ONLY JSON array, no other text.
    `;

    const response = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 500,
    });

    try {
      const content = response.choices[0].message.content.trim();
      const recommendations = JSON.parse(content);
      res.status(200).json({
        status: 200,
        recommendations: Array.isArray(recommendations) ? recommendations : [],
      });
    } catch (parseError) {
      res.status(200).json({
        status: 200,
        message: response.choices[0].message.content,
        recommendations: [],
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

// Get all chat sessions for a user
exports.getUserChatSessions = async (req, res) => {
  try {
    const token = req.headers.token;
    if (!token) {
      return res.status(401).json({
        status: 401,
        message: "Authorization token required",
      });
    }

    const data = jwt_decode(token);
    const userId = data.user_id;

    const sessions = await ChatHistory.find({ userId: userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      status: 200,
      data: sessions,
    });
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    res.status(500).json({
      status: 500,
      message: "Failed to fetch chat sessions",
      error: error.message,
    });
  }
};
