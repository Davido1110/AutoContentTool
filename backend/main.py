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
    return jsonify({"message": "Hệ thống đang hoạt động"})

@app.route("/test", methods=["GET"])
def test():
    if not api_key:
        return jsonify({"error": "Chưa cấu hình OpenAI API key"}), 500
    return jsonify({
        "status": "success",
        "message": "API đang hoạt động bình thường",
        "openai_key_configured": bool(api_key)
    })

@app.route("/api/generate-content", methods=["POST"])
def generate_content():
    if not api_key:
        return jsonify({"error": "Chưa cấu hình OpenAI API key"}), 500

    try:
        # Get form data
        product_description = request.form.get("product_description")
        gender = request.form.get("gender")
        age_group = request.form.get("age_group")
        platform = request.form.get("platform")
        
        if not all([product_description, gender, age_group, platform]):
            return jsonify({"error": "Vui lòng điền đầy đủ thông tin"}), 400

        # Chuyển đổi gender sang tiếng Việt
        gender_vn = "nam" if gender == "male" else "nữ"
        
        # Chuyển đổi age_group sang mô tả tiếng Việt
        age_descriptions = {
            "18-22": "18-22 tuổi (sinh viên, mới đi làm)",
            "23-28": "23-28 tuổi (phát triển sự nghiệp)",
            "29-35": "29-35 tuổi (sự nghiệp ổn định)"
        }
        age_group_vn = age_descriptions.get(age_group, age_group)

        system_message = """Bạn là một chuyên gia marketing và copywriting chuyên nghiệp, thành thạo tiếng Việt và am hiểu sâu sắc về insight của người tiêu dùng Việt Nam. Bạn luôn viết nội dung theo phong cách gần gũi thân thiện dưới 150 chữ và tối đa 2 câu thì tách thành 1 đoạn văn.

Yêu cầu nội dung:

Chỉ cần chọn ra 1 insight từ mô tả sản phẩm để viết nội dung.
- Luôn có link và CTA. Để nguyên link sản phẩm, không hyperlink
- Linh hoạt nghĩ insight phù hợp với lứa tuổi chứ không chỉ bó buộc vào thông tin đã cung cấp
- Không đề cập trực tiếp tuổi của khách hàng vào trong nội dung
- Viết hoàn toàn bằng tiếng Việt, có thể thêm hashtag hoặc emoji nếu cần.
- Câu Headline luôn viết hoa và có Emoji
- Không sử dụng những từ như Đầu tư, kiếm tiền, làm giàu...
- Kết thúc content luôn chèn phần địa chỉ cửa hàng sau: "_______________ 
Danh sách cửa hàng Leonardo trên toàn quốc:

👜 HÀ NỘI
CN1: 198 Tôn Đức Thắng, Quận Đống Đa, HN

👜 TP. HỒ CHÍ MINH
CN2: 284 Pasteur, Quận 3, HCM
CN3: 244 Trần Hưng Đạo, Quận 1, HCM
CN4: 513 Âu Cơ, Quận Tân Phú, HCM
CN5: 175 Quang Trung, P. 10, Quận Gò Vấp, HCM

👜 VŨNG TÀU
CN6: 424 Trương Công Định, Phường 8, VT

👜 ĐỒNG NAI
CN7: 552 Phạm Văn Thuận, P. Tam Hiệp, TP. Biên Hòa"""

        prompt = f"""Hãy viết cho tôi nội dung quảng cáo sáng tạo cho sản phẩm dựa vào thông tin sau:
- Link sản phẩm: https://leonardo.vn
- Mô tả sản phẩm: {product_description}
- Khách hàng mục tiêu: {gender_vn}, độ tuổi {age_group_vn}
- Content dùng cho nền tảng: {platform}"""

        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=1000
        )

        content = response.choices[0].message.content.strip()

        return jsonify({
            "status": "success",
            "content": content
        })

    except Exception as e:
        return jsonify({"error": f"Lỗi: {str(e)}"}), 500

# For local development
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)

# For Vercel
app = app 