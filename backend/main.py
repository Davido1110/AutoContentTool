from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import os
from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup
import re

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
# Cấu hình CORS chi tiết hơn
CORS(app, resources={
    r"/api/*": {
        "origins": ["https://frontend-alpha-sable-56.vercel.app", "http://localhost:3000"],
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

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

@app.route("/api/fetch-product", methods=["POST", "OPTIONS"])
def fetch_product():
    if request.method == "OPTIONS":
        return "", 204
        
    try:
        # Nhận URL từ frontend
        product_url = request.form.get("product_url")
        print(f"Received URL: {product_url}")
        
        if not product_url:
            return jsonify({
                "status": "error",
                "message": "Vui lòng cung cấp URL sản phẩm"
            }), 400
            
        # Kiểm tra xem có phải URL của Leonardo không
        if "leonardo.vn" not in product_url:
            return jsonify({
                "status": "error",
                "message": "URL không hợp lệ. Chỉ hỗ trợ sản phẩm từ leonardo.vn"
            }), 400
            
        # Thêm headers để giả lập trình duyệt tốt hơn
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        }
        
        print(f"Sending request to: {product_url}")
        # Thêm allow_redirects=True và verify=False để xử lý chuyển hướng và bỏ qua SSL
        response = requests.get(product_url, headers=headers, timeout=10, allow_redirects=True, verify=False)
        response.raise_for_status()
        
        # Parse HTML bằng BeautifulSoup với html5lib parser
        soup = BeautifulSoup(response.text, 'html5lib')
        
        # Tìm phần mô tả sản phẩm
        product_info = []
        
        # Tìm mô tả chính - thử nhiều cách khác nhau
        description_selectors = [
            'div[class*="product-description"]',  # Class chứa product-description
            'div[class*="description"]',          # Class chứa description
            'div[itemprop="description"]',        # Thuộc tính itemprop
            '.product__description',              # Class product__description
            '#product-description'                # ID product-description
        ]
        
        main_description = None
        for selector in description_selectors:
            main_description = soup.select_one(selector)
            if main_description:
                break
                
        if main_description:
            description_text = main_description.get_text().strip()
            if description_text:
                product_info.append(description_text)
                
        # Tìm thông tin chi tiết sản phẩm
        detail_selectors = [
            'li:contains("Chất liệu")',
            'li:contains("Size")',
            'li:contains("Kích thước")',
            'li:contains("Đổi size")',
            'li:contains("Mẹo sử dụng")',
            'div[class*="product-details"]'
        ]
        
        for selector in detail_selectors:
            details = soup.find_all(string=re.compile(r'(Chất liệu|Size|Kích thước|Đổi size|Mẹo sử dụng)'))
            for detail in details:
                if detail.parent.name == 'li' or detail.parent.name == 'div':
                    detail_text = detail.parent.get_text().strip()
                    if detail_text and detail_text not in product_info:
                        product_info.append(detail_text)
                
        if not product_info:
            # Thử tìm bất kỳ đoạn văn bản có ý nghĩa nào
            potential_descriptions = soup.find_all(['p', 'div'], class_=lambda x: x and ('description' in x.lower() or 'detail' in x.lower()))
            for desc in potential_descriptions:
                text = desc.get_text().strip()
                if len(text) > 50:  # Chỉ lấy đoạn văn có ý nghĩa
                    product_info.append(text)
                    break
                    
        if not product_info:
            print("No product information found")
            return jsonify({
                "status": "error",
                "message": "Không tìm thấy thông tin sản phẩm"
            }), 404
            
        # Kết hợp tất cả thông tin
        description = "\n".join(product_info)
        print(f"Found description: {description[:100]}...")
        
        return jsonify({
            "status": "success",
            "description": description
        })
        
    except requests.Timeout:
        print("Request timeout")
        return jsonify({
            "status": "error",
            "message": "Timeout khi kết nối đến server"
        }), 504
    except requests.RequestException as e:
        print(f"Request exception: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Lỗi khi lấy thông tin sản phẩm: {str(e)}"
        }), 500
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Lỗi không xác định: {str(e)}"
        }), 500

@app.route("/api/generate-content", methods=["POST", "OPTIONS"])
def generate_content():
    if request.method == "OPTIONS":
        return "", 204
        
    if not api_key:
        return jsonify({"error": "Chưa cấu hình OpenAI API key"}), 500

    try:
        print("Received form data:", request.form)  # Debug log
        
        # Get form data
        product_description = request.form.get("product_description")
        product_link = request.form.get("product_link", "https://leonardo.vn")
        gender = request.form.get("gender")
        age_group = request.form.get("age_group")
        platform = request.form.get("platform")
        
        if not all([product_description, gender, age_group, platform]):
            missing_fields = []
            if not product_description: missing_fields.append("product_description")
            if not gender: missing_fields.append("gender")
            if not age_group: missing_fields.append("age_group")
            if not platform: missing_fields.append("platform")
            
            return jsonify({
                "error": "Vui lòng điền đầy đủ thông tin",
                "missing_fields": missing_fields
            }), 400

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
- Link sản phẩm: {product_link}
- Mô tả sản phẩm: {product_description}
- Khách hàng mục tiêu: {gender_vn}, độ tuổi {age_group_vn}
- Content dùng cho nền tảng: {platform}"""

        print("Sending request to OpenAI with prompt:", prompt[:100])  # Debug log
        
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
        print("Received response from OpenAI:", content[:100])  # Debug log

        return jsonify({
            "status": "success",
            "content": content
        })

    except openai.error.InvalidRequestError as e:
        print(f"OpenAI InvalidRequestError: {str(e)}")  # Debug log
        return jsonify({"error": f"Lỗi OpenAI API: {str(e)}"}), 400
    except openai.error.AuthenticationError as e:
        print(f"OpenAI AuthenticationError: {str(e)}")  # Debug log
        return jsonify({"error": "Lỗi xác thực OpenAI API key"}), 401
    except Exception as e:
        print(f"Unexpected error in generate_content: {str(e)}")  # Debug log
        return jsonify({"error": f"Lỗi: {str(e)}"}), 500

# For local development
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)

# For Vercel
app = app 