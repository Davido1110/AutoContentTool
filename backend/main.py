from fastapi import FastAPI, UploadFile, Form, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import openai
import os
from dotenv import load_dotenv
from mangum import Mangum
import logging
import sys
import json

# Configure logging to stdout with more details
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI app with docs configuration
app = FastAPI(
    title="Content Generator API",
    description="API for generating content using OpenAI",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set your OpenAI API key
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.error("OpenAI API key not found in environment variables")
else:
    openai.api_key = api_key
    logger.info("OpenAI API key loaded successfully")

class ContentRequest(BaseModel):
    image_url: Optional[str] = None
    product_description: str
    gender: str
    age_group: str
    platform: str

@app.get("/")
async def root():
    try:
        logger.info("Root endpoint accessed")
        return {
            "status": "success",
            "message": "Content Generator API is running",
            "environment": os.getenv("VERCEL_ENV", "local"),
            "python_version": sys.version
        }
    except Exception as e:
        logger.error(f"Error in root endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/test")
async def test():
    try:
        logger.info("Test endpoint accessed")
        env_vars = {
            "VERCEL_ENV": os.getenv("VERCEL_ENV", "not set"),
            "PYTHON_VERSION": sys.version,
            "OPENAI_API_KEY_SET": bool(api_key)
        }
        logger.info(f"Environment variables: {json.dumps(env_vars)}")
        
        if not api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        
        return {
            "status": "success",
            "message": "API is working correctly",
            "environment": env_vars
        }
    except Exception as e:
        logger.error(f"Error in test endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-content")
async def generate_content(
    file: Optional[UploadFile] = File(None),
    product_description: str = Form(...),
    gender: str = Form(...),
    age_group: str = Form(...),
    platform: str = Form(...),
    image_url: Optional[str] = Form(None)
):
    try:
        logger.info(f"Received request for {platform} content")
        logger.info(f"Product description: {product_description[:50]}...")
        
        if not api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")

        prompt = f"""Create engaging content for a product with the following details:
Product Description: {product_description}
Target Audience: {gender}s in {age_group} age group
Platform: {platform}

Please create content that:
1. Is optimized for {platform}
2. Appeals to {gender}s in the {age_group} age group
3. Highlights key product features and benefits
4. Uses appropriate tone and style
5. Includes relevant hashtags if applicable"""

        logger.info("Calling OpenAI API")
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a professional content creator and copywriter."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=500
        )
        logger.info("Received response from OpenAI")

        return {
            "status": "success",
            "content": response.choices[0].message.content
        }

    except HTTPException as he:
        logger.error(f"HTTP error: {str(he)}")
        raise he
    except openai.error.OpenAIError as oe:
        logger.error(f"OpenAI API error: {str(oe)}")
        raise HTTPException(status_code=500, detail=str(oe))
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Handler for AWS Lambda/Vercel
handler = Mangum(app, lifespan="off")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 