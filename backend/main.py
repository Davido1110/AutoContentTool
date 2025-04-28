from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import os
from dotenv import load_dotenv
import requests
from bs4 import BeautifulSoup
import re
import logging
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import time
import json
from datetime import datetime, timedelta

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

# Cache configuration
CACHE_FILE = "product_cache.json"
CACHE_EXPIRY = timedelta(hours=24)  # Cache expires after 24 hours

def load_cache():
    try:
        with open(CACHE_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def save_cache(cache):
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f)

def get_cached_product(url):
    cache = load_cache()
    if url in cache:
        cached_data = cache[url]
        cache_time = datetime.fromisoformat(cached_data['timestamp'])
        if datetime.now() - cache_time < CACHE_EXPIRY:
            return cached_data['data']
    return None

def cache_product(url, data):
    cache = load_cache()
    cache[url] = {
        'data': data,
        'timestamp': datetime.now().isoformat()
    }
    save_cache(cache)

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

def setup_driver():
    """Khởi tạo và cấu hình Chrome WebDriver"""
    chrome_options = Options()
    # Chạy ở chế độ headless (không hiện UI)
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    # Thêm User-Agent
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
    
    # Khởi tạo driver
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver

def get_product_info_selenium(url):
    """Lấy thông tin sản phẩm sử dụng Selenium với selector linh hoạt hơn"""
    logger.info(f"Getting product info with Selenium from: {url}")
    driver = None
    try:
        driver = setup_driver()
        driver.get(url)
        time.sleep(2)
        product_info = []

        # Lấy tên sản phẩm
        try:
            # Thử nhiều selector khác nhau
            name_selectors = [
                "h1.product-title",
                "h1.title",
                "h1",
                ".product-title",
                ".product__title"
            ]
            product_name = None
            for selector in name_selectors:
                try:
                    el = driver.find_element(By.CSS_SELECTOR, selector)
                    if el and el.text.strip():
                        product_name = el.text.strip()
                        break
                except Exception:
                    continue
            if product_name:
                product_info.append(f"Tên sản phẩm: {product_name}")
            else:
                logger.warning("Không tìm thấy tên sản phẩm với các selector phổ biến")
        except Exception as e:
            logger.warning(f"Could not find product name: {str(e)}")

        # Lấy giá sản phẩm
        try:
            price_selectors = [
                "span.product-price",
                "span.price",
                ".product-price",
                ".price",
                "[class*='price']"
            ]
            price = None
            for selector in price_selectors:
                try:
                    el = driver.find_element(By.CSS_SELECTOR, selector)
                    if el and el.text.strip() and '₫' in el.text:
                        price = el.text.strip()
                        break
                except Exception:
                    continue
            if price:
                product_info.append(f"Giá: {price}")
            else:
                logger.warning("Không tìm thấy giá sản phẩm với các selector phổ biến")
        except Exception as e:
            logger.warning(f"Could not find price: {str(e)}")

        # Lấy mô tả sản phẩm
        try:
            desc_selectors = [
                "div.product-description",
                "div#ProductInfo-template--16663828285627__main .rte",
                ".product__description",
                "div[itemprop='description']",
                "#product-description",
                ".product-single__description",
                "div.rte"
            ]
            description = None
            for selector in desc_selectors:
                try:
                    el = driver.find_element(By.CSS_SELECTOR, selector)
                    if el and el.text.strip():
                        description = el.text.strip()
                        break
                except Exception:
                    continue
            if not description:
                # Thử lấy đoạn văn bản đầu tiên sau giá
                try:
                    paragraphs = driver.find_elements(By.TAG_NAME, "p")
                    for p in paragraphs:
                        if p.text and len(p.text) > 30:
                            description = p.text.strip()
                            break
                except Exception:
                    pass
            if description:
                product_info.append(description)
            else:
                logger.warning("Không tìm thấy mô tả sản phẩm với các selector phổ biến")
        except Exception as e:
            logger.warning(f"Could not find description: {str(e)}")

        # Lấy thông tin chi tiết (li, ul)
        try:
            details = []
            ul_elements = driver.find_elements(By.TAG_NAME, "ul")
            for ul in ul_elements:
                text = ul.text.strip()
                if text and len(text) > 20 and text not in product_info:
                    details.append(text)
            if details:
                product_info.extend(details)
        except Exception as e:
            logger.warning(f"Could not find detail list: {str(e)}")

        if not product_info:
            logger.warning("No product information found with Selenium. Dumping body HTML for debug.")
            try:
                body_html = driver.find_element(By.TAG_NAME, "body").get_attribute("innerHTML")
                logger.debug(f"BODY HTML: {body_html[:1000]}")
            except Exception as e:
                logger.error(f"Could not dump body HTML: {str(e)}")
            return None
        return "\n".join(product_info)
    except Exception as e:
        logger.error(f"Error in get_product_info_selenium: {str(e)}")
        return None
    finally:
        if driver:
            driver.quit()

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
            
        # Validate URL format
        if not re.match(r'^https?://(?:www\.)?leonardo\.vn/.*$', product_url):
            return jsonify({
                "status": "error",
                "message": "URL không hợp lệ. URL phải bắt đầu bằng https://leonardo.vn"
            }), 400
            
        # Làm sạch URL
        product_url = clean_url(product_url)
        logger.info(f"Cleaned URL: {product_url}")
        
        # Check cache first
        cached_data = get_cached_product(product_url)
        if cached_data:
            logger.info("Returning cached data")
            return jsonify({
                "status": "success",
                "description": cached_data
            })
            
        # Lấy thông tin sản phẩm bằng Selenium
        try:
            product_info = get_product_info_selenium(product_url)
        except Exception as e:
            logger.error(f"Selenium error: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Không thể truy cập thông tin sản phẩm. Vui lòng thử lại sau."
            }), 503
        
        if not product_info:
            return jsonify({
                "status": "error",
                "message": "Không tìm thấy thông tin sản phẩm"
            }), 404
            
        # Cache the result
        cache_product(product_url, product_info)
            
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
        # Get form data
        product_description = request.form.get("product_description")
        product_link = request.form.get("product_link", "https://leonardo.vn")
        gender = request.form.get("gender")
        age_group = request.form.get("age_group")
        platform = request.form.get("platform")
        
        # Validate all required fields
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

        # Validate gender value
        if gender not in ["male", "female"]:
            return jsonify({
                "error": "Giá trị giới tính không hợp lệ"
            }), 400

        # Validate age group
        valid_age_groups = ["18-22", "23-28", "29-35"]
        if age_group not in valid_age_groups:
            return jsonify({
                "error": "Nhóm tuổi không hợp lệ"
            }), 400

        # Validate platform
        valid_platforms = ["facebook", "instagram", "tiktok"]
        if platform not in valid_platforms:
            return jsonify({
                "error": "Nền tảng không hợp lệ"
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