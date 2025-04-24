from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import openai
import os
from dotenv import load_dotenv
import requests
from io import BytesIO
from mangum import Mangum

load_dotenv()

app = FastAPI()
handler = Mangum(app)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set your OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")

class ContentRequest(BaseModel):
    image_url: Optional[str] = None
    product_description: str
    gender: str
    age_group: str
    platform: str

def generate_content_prompt(request: ContentRequest) -> str:
    return f"""Create engaging content for a product with the following details:

Product Description: {request.product_description}
Target Audience: {request.gender}, Age Group: {request.age_group}
Platform: {request.platform}

Please create content that:
1. Is optimized for {request.platform}
2. Appeals to {request.gender}s in the {request.age_group} age group
3. Highlights key product features and benefits
4. Uses appropriate tone and style for the platform
5. Includes relevant hashtags if applicable
"""

@app.post("/api/generate-content")
async def generate_content(
    file: Optional[UploadFile] = None,
    product_description: str = Form(...),
    gender: str = Form(...),
    age_group: str = Form(...),
    platform: str = Form(...),
    image_url: Optional[str] = Form(None)
):
    try:
        # Create request object
        request = ContentRequest(
            image_url=image_url,
            product_description=product_description,
            gender=gender,
            age_group=age_group,
            platform=platform
        )

        # Generate the prompt
        prompt = generate_content_prompt(request)

        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a professional content creator and copywriter."},
                {"role": "user", "content": prompt}
            ]
        )

        generated_content = response.choices[0].message.content

        return {
            "status": "success",
            "content": generated_content
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 