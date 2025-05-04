import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ClipboardIcon } from '@heroicons/react/24/outline';
import { toast, Toaster } from 'react-hot-toast';

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Đã xảy ra lỗi</h2>
          <p className="mb-4">{this.state.error?.message || 'Lỗi không xác định'}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const API_URL = process.env.REACT_APP_API_URL || 'https://auto-content-tool-c7qx.vercel.app';

// Hàm chuẩn hóa URL Leonardo
const normalizeLeonardoUrl = (url: string): string => {
  let normalizedUrl = url.trim();
  
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }
  
  if (!normalizedUrl.includes('www.')) {
    normalizedUrl = normalizedUrl.replace('https://', 'https://www.');
  }
  
  try {
    const urlObj = new URL(normalizedUrl);
    normalizedUrl = urlObj.origin + urlObj.pathname;
  } catch (e) {
  }
  
  return normalizedUrl;
};

interface FormState {
  productDescription: string;
  productLink: string;
  gender: string;
  ageGroup: string;
  platform: string;
}

interface ApiError {
  message: string;
  missing_fields?: string[];
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

function App() {
  const [formData, setFormData] = useState<FormState>({
    productDescription: '',
    productLink: '',
    gender: 'male',
    ageGroup: '18-22',
    platform: 'facebook'
  });
  const [generatedContent1, setGeneratedContent1] = useState<string>("");
  const [generatedContent2, setGeneratedContent2] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [isFetchingDescription, setIsFetchingDescription] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError(null);
  };

  const fetchProductDescription = async (url: string, retry = 0): Promise<void> => {
    try {
      setIsFetchingDescription(true);
      setError(null);
      
      const normalizedUrl = normalizeLeonardoUrl(url);
      console.log('Normalized URL:', normalizedUrl);
      
      const formData = new URLSearchParams();
      formData.append("product_url", normalizedUrl);
      
      const response = await axios.post(`${API_URL}/api/fetch-product`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      if (response.data.status === "success") {
        setFormData(prev => ({
          ...prev,
          productDescription: response.data.description
        }));
        toast.success("Đã tự động điền thông tin sản phẩm!");
        setRetryCount(0);
      } else {
        throw new Error(response.data.message || "Không thể lấy thông tin sản phẩm");
      }
    } catch (error) {
      console.error('Error fetching product description:', error);
      
      if (retry < MAX_RETRIES) {
        toast.loading(`Đang thử lại lần ${retry + 1}...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return fetchProductDescription(url, retry + 1);
      }
      
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || "Lỗi khi lấy thông tin sản phẩm";
        toast.error(errorMessage);
        setError({ message: errorMessage });
      } else {
        const errorMessage = "Đã xảy ra lỗi không xác định";
        toast.error(errorMessage);
        setError({ message: errorMessage });
      }
    } finally {
      setIsFetchingDescription(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.productLink) {
        const normalizedUrl = formData.productLink.toLowerCase().trim();
        if (normalizedUrl.includes('leonardo.vn')) {
          fetchProductDescription(formData.productLink);
        } else if (formData.productLink.length > 5) {
          toast.error("Vui lòng nhập link sản phẩm từ leonardo.vn");
        }
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [formData.productLink]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productLink) {
      toast.error("Vui lòng nhập link sản phẩm");
      return;
    }
    if (!formData.productLink.includes('leonardo.vn')) {
      toast.error("Vui lòng nhập link sản phẩm từ leonardo.vn");
      return;
    }
    setLoading(true);
    setError(null);
    setGeneratedContent1("");
    setGeneratedContent2("");
    
    const formDataToSend1 = new URLSearchParams();
    formDataToSend1.append("product_description", formData.productDescription);
    formDataToSend1.append("product_link", normalizeLeonardoUrl(formData.productLink));
    formDataToSend1.append("gender", formData.gender);
    formDataToSend1.append("age_group", formData.ageGroup);
    formDataToSend1.append("platform", formData.platform);
    const formDataToSend2 = new URLSearchParams(formDataToSend1);

    try {
      const [res1, res2] = await Promise.all([
        axios.post(`${API_URL}/api/generate-content`, formDataToSend1, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
        axios.post(`${API_URL}/api/generate-content`, formDataToSend2, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
      ]);
      setGeneratedContent1(res1.data.content);
      setGeneratedContent2(res2.data.content);
      toast.success("Đã tạo 2 nội dung thành công!");
    } catch (error) {
      console.error('Error generating content:', error);
      
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        if (errorData?.missing_fields) {
          setError({
            message: "Vui lòng điền đầy đủ thông tin",
            missing_fields: errorData.missing_fields
          });
          toast.error("Vui lòng điền đầy đủ thông tin");
        } else {
          const errorMessage = errorData?.error || "Lỗi kết nối đến API";
          setError({ message: errorMessage });
          toast.error(errorMessage);
        }
      } else {
        const errorMessage = "Đã xảy ra lỗi không xác định";
        setError({ message: errorMessage });
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col md:flex-row" style={{fontFamily: 'Inter, Arial, sans-serif'}}>
        {/* Left Section - Starbucks style image and bold text */}
        <div className="w-full md:w-1/2 relative flex items-center justify-center min-h-[400px] md:min-h-screen">
          <div className="absolute inset-0 bg-cover bg-center z-0" style={{backgroundImage: 'url(https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1500&q=80)'}} />
          <div className="absolute inset-0 bg-black/30 z-0" />
          <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-8">
            <h1 className="text-4xl md:text-6xl font-extrabold text-white uppercase leading-tight text-center drop-shadow-lg" style={{letterSpacing: '0.05em'}}>
              Tool Content<br />Tự Động<br />By Davido 🔥
            </h1>
          </div>
        </div>
        {/* Right Section - Starbucks green, headline, subtext, button, form/results */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center bg-[#1E3932] p-8 md:p-16 min-h-[400px] md:min-h-screen">
          <div className="w-full max-w-xl flex flex-col items-center justify-center text-center space-y-8">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-2">More reasons to stay awhile</h2>
            <p className="text-lg md:text-2xl text-white/90 mb-6">Tạo nội dung quảng cáo sản phẩm tự động, nhanh chóng và sáng tạo cho mọi nền tảng mạng xã hội.</p>
            {/* Form Section */}
            <form onSubmit={handleSubmit} className="w-full flex flex-col items-center space-y-6">
              <input
                type="url"
                name="productLink"
                value={formData.productLink}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg border border-white/30 bg-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                placeholder="Link sản phẩm (https://...)"
                required
              />
              <div className="w-full flex flex-col md:flex-row gap-4">
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="flex-1 px-4 py-3 rounded-lg border border-white/30 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                >
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
                <select
                  name="ageGroup"
                  value={formData.ageGroup}
                  onChange={handleInputChange}
                  className="flex-1 px-4 py-3 rounded-lg border border-white/30 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                >
                  <option value="18-22">18-22 (Sinh viên)</option>
                  <option value="23-28">23-28 (Phát triển)</option>
                  <option value="29-35">29-35 (Ổn định)</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading || isFetchingDescription}
                className="mt-4 px-8 py-3 rounded-full border-2 border-white text-white text-lg font-bold bg-transparent hover:bg-white hover:text-[#1E3932] transition-all duration-200 shadow-md"
              >
                {loading ? 'Đang tạo...' : isFetchingDescription ? 'Đang lấy thông tin...' : 'Tạo nội dung'}
              </button>
              {error && (
                <div className="w-full bg-red-100 text-red-700 rounded-lg px-4 py-2 text-sm mt-2">{error.message}</div>
              )}
            </form>
            {/* Results Section */}
            {(generatedContent1 || generatedContent2) && (
              <div className="w-full space-y-6 mt-8">
                <div className="bg-white/10 rounded-xl p-6 text-white text-left shadow">
                  <h3 className="text-xl font-bold mb-2">Nội dung 1</h3>
                  <pre className="whitespace-pre-wrap font-sans text-base">{generatedContent1}</pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedContent1);
                      toast.success("Đã sao chép nội dung 1!");
                    }}
                    className="mt-2 px-4 py-2 rounded-full border border-white text-white hover:bg-white hover:text-[#1E3932] transition-all text-sm"
                  >
                    Sao chép nội dung 1
                  </button>
                </div>
                <div className="bg-white/10 rounded-xl p-6 text-white text-left shadow">
                  <h3 className="text-xl font-bold mb-2">Nội dung 2</h3>
                  <pre className="whitespace-pre-wrap font-sans text-base">{generatedContent2}</pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedContent2);
                      toast.success("Đã sao chép nội dung 2!");
                    }}
                    className="mt-2 px-4 py-2 rounded-full border border-white text-white hover:bg-white hover:text-[#1E3932] transition-all text-sm"
                  >
                    Sao chép nội dung 2
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: '#1E3932',
              color: '#fff',
            },
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;
