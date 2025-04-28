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
  
  // Thêm https:// nếu không có
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }
  
  // Thêm www nếu không có
  if (!normalizedUrl.includes('www.')) {
    normalizedUrl = normalizedUrl.replace('https://', 'https://www.');
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
const RETRY_DELAY = 1000; // 1 second

function App() {
  const [formData, setFormData] = useState<FormState>({
    productDescription: '',
    productLink: '',
    gender: 'male',
    ageGroup: '18-22',
    platform: 'facebook'
  });
  const [generatedContent, setGeneratedContent] = useState<string>("");
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
    // Clear error when user makes changes
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
    
    const formDataToSend = new URLSearchParams();
    formDataToSend.append("product_description", formData.productDescription);
    formDataToSend.append("product_link", normalizeLeonardoUrl(formData.productLink));
    formDataToSend.append("gender", formData.gender);
    formDataToSend.append("age_group", formData.ageGroup);
    formDataToSend.append("platform", formData.platform);

    try {
      const response = await axios.post(`${API_URL}/api/generate-content`, formDataToSend, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      if (response.data.status === "success" && response.data.content) {
        setGeneratedContent(response.data.content);
        toast.success("Đã tạo nội dung thành công!");
      } else {
        throw new Error("Phản hồi không hợp lệ từ API");
      }
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
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">Công Cụ Tạo Nội Dung AI</h1>
          
          <div className="flex gap-6">
            {/* Form Section - Left Side */}
            <ErrorBoundary>
              <div className="w-1/2 bg-white rounded-xl shadow-lg p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error?.missing_fields && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                      <p className="font-medium">Vui lòng điền đầy đủ thông tin:</p>
                      <ul className="list-disc list-inside mt-2">
                        {error.missing_fields.map((field, index) => (
                          <li key={index}>{field}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Link sản phẩm
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        name="productLink"
                        value={formData.productLink}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 border ${
                          error?.message?.includes('link') ? 'border-red-500' : 'border-gray-300'
                        } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
                        placeholder="https://..."
                        required
                      />
                      {isFetchingDescription && (
                        <div className="absolute right-2 top-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
                        </div>
                      )}
                    </div>
                    {error?.message?.includes('link') && (
                      <p className="mt-1 text-sm text-red-600">{error.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Giới tính
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Độ tuổi
                    </label>
                    <select
                      name="ageGroup"
                      value={formData.ageGroup}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="18-22">18-22 (Sinh viên, mới đi làm)</option>
                      <option value="23-28">23-28 (Phát triển sự nghiệp)</option>
                      <option value="29-35">29-35 (Sự nghiệp ổn định)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nền tảng
                    </label>
                    <select
                      name="platform"
                      value={formData.platform}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="facebook">Facebook Page</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || isFetchingDescription}
                    className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                      loading || isFetchingDescription ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200`}
                  >
                    {loading ? 'Đang tạo...' : isFetchingDescription ? 'Đang lấy thông tin...' : 'Tạo nội dung'}
                  </button>

                  {error && (
                    <div className="mt-4 text-red-600 text-sm">{error.message}</div>
                  )}
                </form>
              </div>
            </ErrorBoundary>

            {/* Generated Content Section - Right Side */}
            <ErrorBoundary>
              <div className="w-1/2 bg-white rounded-xl shadow-lg p-6">
                <div className="h-full flex flex-col">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Nội dung đã tạo</h2>
                  {generatedContent ? (
                    <div className="flex-1 relative bg-gray-50 rounded-lg p-6">
                      <pre className="whitespace-pre-wrap text-gray-800 text-base" style={{ fontFamily: 'Arial, sans-serif' }}>{generatedContent}</pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedContent);
                          toast.success("Đã sao chép nội dung!");
                        }}
                        className="absolute top-4 right-4 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-200"
                        title="Sao chép nội dung"
                      >
                        <ClipboardIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-50 rounded-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
                      Nội dung sẽ xuất hiện ở đây sau khi được tạo
                    </div>
                  )}
                </div>
              </div>
            </ErrorBoundary>
          </div>
        </div>
        <Toaster position="top-right" />
      </div>
    </ErrorBoundary>
  );
}

export default App;
