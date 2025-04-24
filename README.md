# AI Content Generator

A web application that automatically generates content for products based on various parameters using AI.

## Features

- Upload product images or provide image URLs
- Input detailed product descriptions
- Select target gender and age group
- Choose content platform (Facebook/Blog/Instagram/Magazine)
- Generate AI-powered content optimized for your target audience

## Prerequisites

- Node.js (v14 or higher)
- Python (v3.8 or higher)
- OpenAI API key

## Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment and activate it:
```bash
python -m venv venv
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a .env file in the backend directory and add your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

1. Start the backend server (from the backend directory):
```bash
uvicorn main:app --reload
```

2. Start the frontend development server (from the frontend directory):
```bash
npm start
```

3. Open your browser and visit http://localhost:3000

## Deployment

### Backend Deployment

You can deploy the backend to platforms like Vercel, DigitalOcean, or AWS:

1. Create a Procfile in the backend directory:
```
web: uvicorn main:app --host=0.0.0.0 --port=${PORT:-8000}
```

2. Deploy to your chosen platform following their Python application deployment guidelines.

### Frontend Deployment

You can deploy the frontend to platforms like Vercel, Netlify, or GitHub Pages:

1. Build the production version:
```bash
npm run build
```

2. Deploy the build folder to your chosen platform.

Remember to update the API endpoint in the frontend code (App.tsx) to point to your deployed backend URL.

## License

MIT 
