# Booking Assistant Chatbot - Quick Setup Guide

## ✅ What's Been Created

### Backend Files
1. ✅ `controller/chatbotController.js` - Main chatbot logic with OpenAI integration
2. ✅ `models/ChatHistory.js` - Database model for storing chat conversations
3. ✅ `routes/chatbotRoutes.js` - API endpoints for chatbot

### Frontend Files
1. ✅ `src/api/chatbot.ts` - API client for chatbot endpoints
2. ✅ `src/components/ChatMessage.tsx` - Message display component
3. ✅ `src/components/ChatInput.tsx` - Message input component
4. ✅ `src/components/ServiceRecommendation.tsx` - Service recommendation cards
5. ✅ `app/chatbot.tsx` - Main chatbot screen

---

## 🚀 Installation Steps

### Step 1: Backend Setup

#### 1.1 Install OpenAI Package
```bash
cd service
npm install openai
```

#### 1.2 Add Environment Variable
Edit `.env` file and add:
```
OPENAI_API_KEY=your_openai_api_key_here
```

Get your API key from: https://platform.openai.com/api-keys

#### 1.3 Register Routes in Server
Edit `service/server.js` and add this line (after other route registrations):

```javascript
// Add this with other route imports at the top
const chatbotRoutes = require("./routes/chatbotRoutes");

// Add this with other app.use() calls
app.use("/api/v2", chatbotRoutes);
```

#### 1.4 Verify MongoDB Connection
Make sure your MongoDB is running and the connection string is correct in `.env`

---

### Step 2: Frontend Setup

#### 2.1 No Additional Dependencies Needed
The frontend uses existing packages (axios, react-native, expo)

#### 2.2 Verify API Client Configuration
Check `src/api/client.ts` has `v2Client` configured correctly:
```typescript
export const v2Client = axios.create({
  baseURL: "your_backend_url/api/v2",
  // ... other config
});
```

---

## 🧪 Testing the Chatbot

### Test Backend API with Postman

#### 1. Initialize Chat
```
POST http://localhost:5000/api/v2/chat/initialize
Headers: 
  - Authorization: Bearer <your_token>
  - token: <your_jwt_token>
```

Response:
```json
{
  "status": 200,
  "message": "Chat session initialized",
  "sessionId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "initialMessage": "Hi! 👋 I'm your bike service assistant..."
}
```

#### 2. Send Message
```
POST http://localhost:5000/api/v2/chat/message
Headers:
  - token: <your_jwt_token>
Body:
{
  "sessionId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "message": "My bike is making a strange noise",
  "bikeId": "optional_bike_id"
}
```

Response:
```json
{
  "status": 200,
  "message": "Message processed",
  "response": "That sounds concerning! Can you describe...",
  "recommendations": [
    {
      "serviceName": "Engine Diagnosis",
      "reason": "Strange noise indicates potential engine issue",
      "estimatedCost": 500,
      "estimatedTime": "1 hour"
    }
  ],
  "sessionId": "64f1a2b3c4d5e6f7g8h9i0j1"
}
```

#### 3. Get Chat History
```
GET http://localhost:5000/api/v2/chat/history/64f1a2b3c4d5e6f7g8h9i0j1
Headers:
  - token: <your_jwt_token>
```

#### 4. Close Chat
```
POST http://localhost:5000/api/v2/chat/close/64f1a2b3c4d5e6f7g8h9i0j1
Headers:
  - token: <your_jwt_token>
```

---

## 📱 Frontend Integration

### Add Chatbot to Navigation

Edit `app/(tabs)/_layout.tsx` and add chatbot tab:

```typescript
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors[colorScheme ?? "light"].tint,
      }}
    >
      {/* ... existing tabs ... */}
      
      <Tabs.Screen
        name="chatbot"
        options={{
          title: "Service Assistant",
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubble-ellipses" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

### Access Chatbot from Booking Screen

```typescript
import { useNavigation } from "@react-navigation/native";

export default function BookingScreen() {
  const navigation = useNavigation();
  
  const openChatbot = (bikeId: string) => {
    navigation.navigate("chatbot", { bikeId });
  };
  
  return (
    <TouchableOpacity onPress={() => openChatbot(selectedBikeId)}>
      <Text>Get Service Recommendations</Text>
    </TouchableOpacity>
  );
}
```

---

## 🔧 Configuration

### OpenAI Model Selection

In `chatbotController.js`, you can change the model:

```javascript
// Current: GPT-4 (most capable, higher cost)
model: "gpt-4"

// Alternative: GPT-3.5 Turbo (faster, cheaper)
model: "gpt-3.5-turbo"

// Alternative: GPT-4 Turbo (balanced)
model: "gpt-4-turbo"
```

### Adjust Temperature (Creativity)

```javascript
temperature: 0.7  // 0 = deterministic, 1 = creative
```

### Adjust Max Tokens (Response Length)

```javascript
max_tokens: 500  // Increase for longer responses
```

---

## 📊 Database Indexes

The ChatHistory model includes indexes for efficient queries:
- `userId + createdAt` - For fetching user's chat history
- `status + createdAt` - For finding active/closed chats

---

## 🐛 Troubleshooting

### Issue: "OPENAI_API_KEY is not defined"
**Solution:** 
- Check `.env` file has `OPENAI_API_KEY=your_key`
- Restart the server after adding the key
- Verify the key is valid at https://platform.openai.com/api-keys

### Issue: "Chat session not found"
**Solution:**
- Make sure sessionId is correct
- Check MongoDB connection
- Verify ChatHistory model is registered

### Issue: "Authorization token required"
**Solution:**
- Include `token` header in all requests
- Token should be a valid JWT from your auth system

### Issue: "Failed to process message"
**Solution:**
- Check OpenAI API quota and billing
- Verify internet connection
- Check OpenAI API status at https://status.openai.com

### Issue: Recommendations not showing
**Solution:**
- Check if OpenAI response contains valid JSON
- Verify AdminService model has data
- Check browser console for errors

---

## 📈 Performance Tips

1. **Cache Chat Sessions** - Store active sessions in Redis for faster access
2. **Batch Recommendations** - Pre-compute common service recommendations
3. **Rate Limiting** - Implement rate limiting to prevent API abuse
4. **Message Pagination** - Load older messages on demand

---

## 🔐 Security Considerations

1. **API Key Protection** - Never commit `.env` to git
2. **Rate Limiting** - Implement per-user rate limits
3. **Input Validation** - Validate message length and content
4. **Token Verification** - Always verify JWT tokens
5. **CORS** - Configure CORS properly for frontend

---

## 📝 Next Steps

1. ✅ Install dependencies
2. ✅ Add environment variables
3. ✅ Register routes in server
4. ✅ Test API endpoints with Postman
5. ✅ Add chatbot to navigation
6. ✅ Test end-to-end flow
7. ✅ Monitor OpenAI API usage
8. ✅ Gather user feedback and optimize prompts

---

## 💡 Enhancement Ideas

- [ ] Add image upload for damage assessment
- [ ] Implement multi-language support
- [ ] Add FAQ knowledge base
- [ ] Implement booking directly from chat
- [ ] Add dealer availability checking
- [ ] Add sentiment analysis
- [ ] Implement chat search
- [ ] Add typing indicators
- [ ] Implement chat export/download
- [ ] Add analytics dashboard

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review OpenAI documentation: https://platform.openai.com/docs
3. Check MongoDB documentation: https://docs.mongodb.com
4. Review React Native documentation: https://reactnative.dev

---

## 📄 Files Summary

| File | Purpose | Status |
|------|---------|--------|
| `controller/chatbotController.js` | Main chatbot logic | ✅ Created |
| `models/ChatHistory.js` | Chat storage model | ✅ Created |
| `routes/chatbotRoutes.js` | API routes | ✅ Created |
| `src/api/chatbot.ts` | Frontend API client | ✅ Created |
| `src/components/ChatMessage.tsx` | Message display | ✅ Created |
| `src/components/ChatInput.tsx` | Message input | ✅ Created |
| `src/components/ServiceRecommendation.tsx` | Recommendations | ✅ Created |
| `app/chatbot.tsx` | Main screen | ✅ Created |

---

**Ready to go! Start with Step 1 of the Installation Steps above.** 🚀
