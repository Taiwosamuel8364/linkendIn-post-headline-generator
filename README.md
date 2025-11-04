# LinkedIn Post Headline Generator

An AI-powered workflow that generates engaging LinkedIn post headlines using Mastra AI framework and Anthropic's Claude.

## Features

- 🤖 **AI-Powered Generation**: Uses Claude Sonnet 3.5 to create catchy, professional headlines
- 📝 **Multiple Options**: Generates 5 headline variations per request
- 🎯 **Smart Recommendations**: Automatically selects and recommends the best headline
- 🔄 **A2A Protocol Support**: Fully compatible with Telex and other A2A-compliant platforms
- 🌐 **Webhook Integration**: Easy integration via JSON-RPC 2.0 webhooks

## Project Structure

```
linkendIn-post-headline-generator/
├── src/
│   └── mastra/
│       ├── index.ts                    # Main Mastra configuration & webhook
│       ├── agents/
│       │   └── linkedin-agent.ts       # AI agent configuration
│       └── workflows/
│           └── linkedin-headline.workflow.ts  # Headline generation workflow
├── .env                                # Environment variables
├── package.json
└── README.md
```

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Anthropic API key

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd linkendIn-post-headline-generator
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your API keys:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## Usage

### Running Locally

1. Start the development server:
```bash
npm run dev
```

2. The server will start on `http://localhost:4111`

### Testing the Workflow

Send a POST request to the webhook endpoint:

```bash
curl -X POST http://localhost:4111/webhook/linkedin-headline \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-123",
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "role": "user",
        "parts": [
          {
            "kind": "text",
            "text": "generate a headline for this post: The future of AI in healthcare is transforming patient care through personalized medicine and early disease detection."
          }
        ]
      }
    }
  }'
```

### Response Format

The API returns a JSON-RPC 2.0 response with headline options:

```json
{
  "jsonrpc": "2.0",
  "id": "test-123",
  "result": {
    "status": {
      "state": "completed",
      "message": {
        "role": "agent",
        "parts": [
          {
            "kind": "text",
            "text": "Here are 5 LinkedIn headline options:\n\n1. AI in Healthcare: Revolutionizing Patient Care 🏥\n\n2. The Future is Here: How AI is Transforming Medicine\n\n3. Personalized Medicine Meets AI: A Healthcare Game-Changer\n\n4. Early Detection, Better Outcomes: AI's Role in Healthcare\n\n5. Healthcare's AI Revolution: What You Need to Know 💡\n\n💡 Recommended: AI in Healthcare: Revolutionizing Patient Care 🏥"
          }
        ]
      }
    }
  }
}
```

## Deployment

### Deploying to Mastra Cloud

1. Connect your GitHub repository to Mastra Cloud
2. Push your code to GitHub:
```bash
git add .
git commit -m "Deploy to Mastra Cloud"
git push origin main
```
3. Mastra Cloud will automatically build and deploy your workflow
4. Your webhook will be available at: `https://your-app.mastra.cloud/webhook/linkedin-headline`

### Environment Variables

Make sure to set these in your deployment environment:
- `ANTHROPIC_API_KEY`: Your Anthropic API key

## Workflow Details

The headline generation workflow consists of 3 steps:

1. **Generate Headlines**: Creates 5 headline variations using Claude AI
2. **Select Best Headline**: Analyzes and ranks headlines based on:
   - Clarity and conciseness
   - Engagement potential
   - Professional tone
   - Use of emojis and formatting
3. **Format Response**: Converts output to A2A-compliant JSON-RPC 2.0 format

## Integration with Telex

This workflow is designed to work seamlessly with Telex:

1. Set up a channel in Telex
2. Configure the webhook URL: `https://your-app.mastra.cloud/webhook/linkedin-headline`
3. Users can now generate headlines by sending messages like:
   - "generate a headline for this post: [your post content]"
   - The bot will respond with 5 headline options and a recommendation

## Customization

### Adjusting the AI Model

Edit `src/mastra/agents/linkedin-agent.ts` to change the model:

```typescript
model: {
  provider: "ANTHROPIC",
  name: "claude-3-5-sonnet-20241022", // Change model here
  toolChoice: "auto",
}
```

### Modifying Headline Generation

Edit the prompt in `src/mastra/workflows/linkedin-headline.workflow.ts`:

```typescript
const prompt = `You are a LinkedIn expert... [customize instructions]`;
```

## Troubleshooting

### Common Issues

**Issue**: `rawText.replace is not a function`
- **Solution**: Ensure input data is properly formatted as a string

**Issue**: Response ID mismatch
- **Solution**: Check that the webhook is passing the request ID through all workflow steps

**Issue**: Connection errors to Turso/LibSQL
- **Solution**: Remove storage configuration and let Mastra Cloud handle it automatically

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own purposes.

## Support

For issues and questions:
- Open an issue on GitHub
- Contact the Mastra team
- Check the [Mastra documentation](https://docs.mastra.ai)