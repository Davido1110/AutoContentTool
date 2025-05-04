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
      {/* Header Maison Marou style */}
      <header className="w-full bg-[#F47C6E] flex items-center justify-between px-8 py-4 shadow-md z-20 relative">
        <nav className="flex-1 flex gap-8 items-center">
          <span className="uppercase tracking-widest font-semibold text-white text-sm cursor-pointer hover:underline">Cửa hàng</span>
          <span className="uppercase tracking-widest font-semibold text-white text-sm cursor-pointer hover:underline">Académie Marou</span>
          <span className="uppercase tracking-widest font-semibold text-white text-sm cursor-pointer hover:underline">Phiên bản đặc biệt</span>
        </nav>
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className="bg-white rounded-full px-6 py-2 shadow text-[#F47C6E] font-extrabold text-lg tracking-widest border-4 border-white" style={{letterSpacing: '0.15em'}}>MAISON<br/>MAROU</div>
        </div>
        <nav className="flex-1 flex gap-8 items-center justify-end">
          <span className="uppercase tracking-widest font-semibold text-white text-sm cursor-pointer hover:underline">Vị trí</span>
          <span className="uppercase tracking-widest font-semibold text-white text-sm cursor-pointer hover:underline">Đặt hàng</span>
          <span className="text-white text-xl cursor-pointer">🛒</span>
        </nav>
      </header>
      <div className="min-h-screen flex flex-col md:flex-row" style={{fontFamily: 'Inter, Arial, sans-serif'}}>
        {/* Left Section - Hero Image and Title */}
        <div className="w-full md:w-1/2 bg-[#1E3932] relative overflow-hidden min-h-[400px] md:min-h-screen flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-cover bg-center z-0"
            style={{
              backgroundImage: 'url(https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1500&q=80)',
              filter: 'brightness(0.6)'
            }}
          />
          <div className="relative z-10 text-center p-8">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight drop-shadow-lg">
              Tool Content<br />Tự Động
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8">
              By Davido 🔥
            </p>
          </div>
        </div>
        {/* Right Section - Form and Results in white card */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-4 md:p-12 overflow-y-auto max-h-screen">
          <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8 md:p-12 space-y-8">
            {/* Form Section */}
            <form onSubmit={handleSubmit} className="space-y-8">
              {error?.missing_fields && (
                <div className="bg-[#FFF3F0] border border-[#F47C6E] p-4 rounded-lg">
                  <p className="font-medium text-[#F26B5B]">Vui lòng điền đầy đủ thông tin:</p>
                  <ul className="list-disc list-inside mt-2 text-[#F26B5B]">
                    {error.missing_fields.map((field, index) => (
                      <li key={index}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <label className="block text-lg font-semibold text-[#1E3932] mb-3">
                  Link sản phẩm
                </label>
                <div className="relative">
                  <input
                    type="url"
                    name="productLink"
                    value={formData.productLink}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#F7F7F7] border border-[#E0E0E0] rounded-lg text-[#1E3932] placeholder-[#B0B0B0] focus:outline-none focus:ring-2 focus:ring-[#F47C6E] transition-all"
                    placeholder="https://..."
                    required
                  />
                  {isFetchingDescription && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#F47C6E]"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-semibold text-[#1E3932] mb-3">
                    Giới tính
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#F7F7F7] border border-[#E0E0E0] rounded-lg text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#F47C6E] transition-all"
                  >
                    <option value="male" className="text-gray-900">Nam</option>
                    <option value="female" className="text-gray-900">Nữ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-lg font-semibold text-[#1E3932] mb-3">
                    Độ tuổi
                  </label>
                  <select
                    name="ageGroup"
                    value={formData.ageGroup}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#F7F7F7] border border-[#E0E0E0] rounded-lg text-[#1E3932] focus:outline-none focus:ring-2 focus:ring-[#F47C6E] transition-all"
                  >
                    <option value="18-22" className="text-gray-900">18-22 (Sinh viên)</option>
                    <option value="23-28" className="text-gray-900">23-28 (Phát triển)</option>
                    <option value="29-35" className="text-gray-900">29-35 (Ổn định)</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || isFetchingDescription}
                className={`w-full py-4 px-6 rounded-lg text-lg font-bold transition-all tracking-wider shadow-md
                  ${loading || isFetchingDescription 
                    ? 'bg-[#B0D9B1] cursor-not-allowed' 
                    : 'bg-[#3A7D3B] text-white hover:bg-[#2e5e2e]'}`}
              >
                {loading ? 'Đang tạo...' : isFetchingDescription ? 'Đang lấy thông tin...' : 'Tạo nội dung'}
              </button>
            </form>
            {/* Results Section */}
            {(generatedContent1 || generatedContent2) && (
              <div className="space-y-8">
                {/* Result 1 */}
                <div className="bg-[#F7F7F7] rounded-xl p-6 relative shadow-md">
                  <h3 className="text-xl font-bold text-[#1E3932] mb-4">Nội dung 1</h3>
                  <pre className="whitespace-pre-wrap text-[#1E3932] font-sans text-base">
                    {generatedContent1}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedContent1);
                      toast.success("Đã sao chép nội dung 1!");
                    }}
                    className="absolute top-4 right-4 p-2 bg-[#F47C6E] hover:bg-[#F26B5B] rounded-lg transition-all shadow text-white"
                    title="Sao chép nội dung 1"
                  >
                    <ClipboardIcon className="h-5 w-5" />
                  </button>
                </div>
                {/* Result 2 */}
                <div className="bg-[#F7F7F7] rounded-xl p-6 relative shadow-md">
                  <h3 className="text-xl font-bold text-[#1E3932] mb-4">Nội dung 2</h3>
                  <pre className="whitespace-pre-wrap text-[#1E3932] font-sans text-base">
                    {generatedContent2}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedContent2);
                      toast.success("Đã sao chép nội dung 2!");
                    }}
                    className="absolute top-4 right-4 p-2 bg-[#F47C6E] hover:bg-[#F26B5B] rounded-lg transition-all shadow text-white"
                    title="Sao chép nội dung 2"
                  >
                    <ClipboardIcon className="h-5 w-5" />
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
