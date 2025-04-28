from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import os
from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup
import re
import logging

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

# Cấu hình logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

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

def clean_url(url):
    # Loại bỏ các ký tự đặc biệt ở đầu URL
    url = url.strip().lstrip('@')
    
    # Đảm bảo URL bắt đầu bằng https://
    if not url.startswith('http'):
        url = 'https://' + url
    
    # Đảm bảo có www nếu là domain leonardo.vn
    if 'leonardo.vn' in url and 'www.' not in url:
        url = url.replace('https://', 'https://www.')
        
    return url

def get_product_info(url):
    # Tạo session để duy trì cookies
    session = requests.Session()
    
    # Headers giả lập trình duyệt Chrome trên Mac
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://www.leonardo.vn/',
        'Origin': 'https://www.leonardo.vn'
    }
    
    try:
        # Trước tiên truy cập trang chủ để lấy cookies
        logger.info("Accessing homepage to get cookies...")
        session.get('https://www.leonardo.vn/', headers=headers, timeout=10)
        
        # Sau đó mới truy cập trang sản phẩm
        logger.info(f"Accessing product page: {url}")
        response = session.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Log response status và headers
        logger.info(f"Response status: {response.status_code}")
        logger.info(f"Response headers: {dict(response.headers)}")
        
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html5lib')
        
        # Tìm thông tin sản phẩm
        product_info = []
        
        # Tìm tên sản phẩm
        product_name = soup.find('h1', class_='product-title')
        if product_name:
            product_info.append(f"Tên sản phẩm: {product_name.get_text().strip()}")
        
        # Tìm giá
        product_price = soup.find('span', class_='price')
        if product_price:
            product_info.append(f"Giá: {product_price.get_text().strip()}")
        
        # Tìm mô tả sản phẩm - thử nhiều selector khác nhau
        description_selectors = [
            'div.product-description',
            'div.description',
            'div[itemprop="description"]',
            '.product__description',
            '#product-description',
            '.product-single__description',
            '.product-info__description'
        ]
        
        for selector in description_selectors:
            description = soup.select_one(selector)
            if description:
                text = description.get_text().strip()
                if text and text not in product_info:
                    product_info.append(text)
                    break
        
        # Tìm thông tin chi tiết
        details = soup.find_all(['li', 'div'], string=re.compile(r'(Chất liệu|Size|Kích thước|Đổi size|Mẹo sử dụng)'))
        for detail in details:
            text = detail.get_text().strip()
            if text and text not in product_info:
                product_info.append(text)
        
        if not product_info:
            logger.warning("No product information found in the page")
            # Log HTML content để debug
            logger.debug(f"Page HTML: {response.text[:1000]}...")
            return None
            
        return "\n".join(product_info)
        
    except Exception as e:
        logger.error(f"Error fetching product info: {str(e)}")
        return None

@app.route("/api/fetch-product", methods=["POST", "OPTIONS"])
def fetch_product():
    if request.method == "OPTIONS":
        return "", 204
        
    try:
        # Nhận URL từ frontend
        product_url = request.form.get("product_url")
        logger.info(f"Received URL: {product_url}")
        
        if not product_url:
            return jsonify({
                "status": "error",
                "message": "Vui lòng cung cấp URL sản phẩm"
            }), 400
            
        # Làm sạch URL
        product_url = clean_url(product_url)
        logger.info(f"Cleaned URL: {product_url}")
            
        # Kiểm tra xem có phải URL của Leonardo không
        if "leonardo.vn" not in product_url:
            return jsonify({
                "status": "error",
                "message": "URL không hợp lệ. Chỉ hỗ trợ sản phẩm từ leonardo.vn"
            }), 400
            
        # Lấy thông tin sản phẩm
        product_info = get_product_info(product_url)
        
        if not product_info:
            return jsonify({
                "status": "error",
                "message": "Không tìm thấy thông tin sản phẩm"
            }), 404
            
        return jsonify({
            "status": "success",
            "description": product_info
        })
        
    except Exception as e:
        logger.error(f"Error in fetch_product: {str(e)}")
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