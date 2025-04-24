from fastapi import FastAPI, UploadFile, Form, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import openai
import os
from dotenv import load_dotenv
from mangum import Mangum

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

# Set OpenAI API key
api_key = os.getenv("OPENAI_API_KEY")
openai.api_key = api_key

class ContentRequest(BaseModel):
    image_url: Optional[str] = None
    product_description: str
    gender: str
    age_group: str
    platform: str

@app.get("/")
def root():
    return {"message": "Content Generator API is running"}

@app.get("/test")
def test():
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    return {
        "status": "success",
        "message": "API is working correctly",
        "openai_key_configured": bool(api_key)
    }

@app.post("/api/generate-content")
async def generate_content(
    file: Optional[UploadFile] = File(None),
    product_description: str = Form(...),
    gender: str = Form(...),
    age_group: str = Form(...),
    platform: str = Form(...),
    image_url: Optional[str] = Form(None)
):
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    try:
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

        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a professional content creator and copywriter."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=500
        )

        return {
            "status": "success",
            "content": response.choices[0].message.content
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Create handler for AWS Lambda
handler = Mangum(app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 