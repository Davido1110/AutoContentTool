from fastapi import FastAPI, UploadFile, Form, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import openai
import os
from dotenv import load_dotenv
import requests
from io import BytesIO
from mangum import Mangum
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Content Generator API",
    description="API for generating content using OpenAI",
    version="1.0.0"
)

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
    logger.error("OpenAI API key not found in environment variables")
    raise ValueError("OpenAI API key not found")
else:
    openai.api_key = api_key
    logger.info("OpenAI API key loaded successfully")

class ContentRequest(BaseModel):
    image_url: Optional[str] = None
    product_description: str
    gender: str
    age_group: str
    platform: str

def analyze_image(image_url: Optional[str] = None, image_file: Optional[UploadFile] = None) -> str:
    try:
        if image_file:
            image_content = image_file.file.read()
            return "Image successfully uploaded and analyzed."
        elif image_url:
            return "Image URL successfully analyzed."
        return ""
    except Exception as e:
        logger.error(f"Error analyzing image: {str(e)}")
        return ""

def generate_content_prompt(request: ContentRequest, image_analysis: str = "") -> str:
    age_group_details = {
        "18-22": "young adults who are typically students or early career professionals, price-sensitive, trend-conscious, and tech-savvy",
        "23-28": "young professionals focusing on career growth, becoming financially independent, developing personal style",
        "29-35": "established professionals with stable income, sophisticated taste, quality-oriented"
    }

    platform_style = {
        "Facebook": "casual and informative, use emojis moderately, focus on value proposition",
        "Instagram": "visual-centric, trendy, use relevant hashtags, emotional appeal",
        "Blog": "detailed, informative, SEO-friendly, focus on benefits and features",
        "Magazine": "sophisticated, professional tone, focus on lifestyle and quality"
    }

    return f"""Create engaging content for a product with the following details:

Product Description: {request.product_description}
Target Audience: {request.gender}s, {age_group_details.get(request.age_group, '')}
Platform: {request.platform} ({platform_style.get(request.platform, '')})
{f'Image Analysis: {image_analysis}' if image_analysis else ''}

Please create content that:
1. Is specifically optimized for {request.platform}'s format and audience
2. Appeals directly to {request.gender}s in the {request.age_group} age group
3. Highlights key product features and benefits that matter to this demographic
4. Uses appropriate tone and style for {request.platform}
5. Includes relevant hashtags if it's for Instagram
6. Maintains the brand's professional image while being relatable
7. Creates desire and urgency without being pushy
8. Includes a clear call-to-action appropriate for the platform

Format the content appropriately for {request.platform}, including line breaks and sections as needed."""

@app.get("/")
async def root():
    return {"message": "Content Generator API is running"}

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
        logger.info(f"Received request - Platform: {platform}, Gender: {gender}, Age Group: {age_group}")
        
        request = ContentRequest(
            image_url=image_url,
            product_description=product_description,
            gender=gender,
            age_group=age_group,
            platform=platform
        )

        image_analysis = analyze_image(image_url=image_url, image_file=file)
        logger.info("Image analysis completed")

        prompt = generate_content_prompt(request, image_analysis)
        logger.info("Prompt generated")

        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a professional content creator and copywriter with expertise in social media marketing, branding, and audience targeting."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        logger.info("Received response from OpenAI")

        generated_content = response.choices[0].message.content

        return {
            "status": "success",
            "content": generated_content
        }

    except Exception as e:
        logger.error(f"Error generating content: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 