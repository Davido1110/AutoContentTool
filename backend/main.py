from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Set OpenAI API key
api_key = os.getenv("OPENAI_API_KEY")
openai.api_key = api_key

@app.route("/", methods=["GET"])
def root():
    return jsonify({"message": "Content Generator API is running"})

@app.route("/test", methods=["GET"])
def test():
    if not api_key:
        return jsonify({"error": "OpenAI API key not configured"}), 500
    return jsonify({
        "status": "success",
        "message": "API is working correctly",
        "openai_key_configured": bool(api_key)
    })

@app.route("/api/generate-content", methods=["POST"])
def generate_content():
    if not api_key:
        return jsonify({"error": "OpenAI API key not configured"}), 500

    try:
        # Get form data
        product_description = request.form.get("product_description")
        gender = request.form.get("gender")
        age_group = request.form.get("age_group")
        platform = request.form.get("platform")
        
        if not all([product_description, gender, age_group, platform]):
            return jsonify({"error": "Missing required fields"}), 400

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

        return jsonify({
            "status": "success",
            "content": response.choices[0].message.content
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# For local development
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)

# For Vercel
app = app 