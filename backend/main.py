from fastapi import FastAPI, UploadFile, Form, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import openai
import os
from dotenv import load_dotenv
from mangum import Mangum
import logging
import sys

# Configure logging to stdout
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up handler for AWS Lambda/Vercel
handler = Mangum(app)

# Set your OpenAI API key
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.error("OpenAI API key not found")
else:
    openai.api_key = api_key
    logger.info("OpenAI API key loaded")

class ContentRequest(BaseModel):
    image_url: Optional[str] = None
    product_description: str
    gender: str
    age_group: str
    platform: str

@app.get("/")
async def root():
    try:
        return {"status": "success", "message": "Content Generator API is running"}
    except Exception as e:
        logger.error(f"Error in root endpoint: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.get("/test")
async def test():
    try:
        if not api_key:
            raise ValueError("OpenAI API key not configured")
        return {
            "status": "success",
            "message": "API is working correctly",
            "openai_key_configured": bool(api_key)
        }
    except Exception as e:
        logger.error(f"Error in test endpoint: {str(e)}")
        return {"status": "error", "message": str(e)}

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
        
        if not api_key:
            raise ValueError("OpenAI API key not configured")

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

    except ValueError as ve:
        logger.error(f"Validation error: {str(ve)}")
        return {"status": "error", "message": str(ve)}
    except openai.error.OpenAIError as oe:
        logger.error(f"OpenAI API error: {str(oe)}")
        return {"status": "error", "message": str(oe)}
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 