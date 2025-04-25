import React, { useState } from 'react';
import axios from 'axios';
import { ClipboardIcon } from '@heroicons/react/24/outline';
import { toast, Toaster } from 'react-hot-toast';

const API_URL = 'https://auto-content-tool-c7qx.vercel.app';

interface FormState {
  productDescription: string;
  gender: string;
  ageGroup: string;
  platform: string;
}

function App() {
  const [formData, setFormData] = useState<FormState>({
    productDescription: '',
    gender: 'male',
    ageGroup: '18-22',
    platform: 'facebook'
  });
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const formDataToSend = new FormData();
    formDataToSend.append("product_description", formData.productDescription);
    formDataToSend.append("gender", formData.gender);
    formDataToSend.append("age_group", formData.ageGroup);
    formDataToSend.append("platform", formData.platform);

    try {
      const response = await axios.post(`${API_URL}/api/generate-content`, formDataToSend);
      
      if (response.data.status === "success" && response.data.content) {
        setGeneratedContent(response.data.content);
      } else {
        setError("Phản hồi không hợp lệ từ API");
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.error || "Lỗi kết nối đến API");
      } else {
        setError("Đã xảy ra lỗi không xác định");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white mx-8 md:mx-0 shadow rounded-3xl sm:p-10">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h1 className="text-2xl font-bold text-center mb-8">Công Cụ Tạo Nội Dung AI</h1>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mô tả sản phẩm
                    </label>
                    <input
                      type="text"
                      name="productDescription"
                      value={formData.productDescription}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
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
                      <option value="facebook">Facebook</option>
                      <option value="tiktok">TikTok</option>
                      <option value="instagram">Instagram</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                      loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                  >
                    {loading ? 'Đang tạo...' : 'Tạo nội dung'}
                  </button>
                </form>

                {error && (
                  <div className="mt-4 text-red-600 text-sm">{error}</div>
                )}

                {generatedContent && (
                  <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
                    <div className="relative">
                      <pre className="whitespace-pre-wrap text-gray-800">{generatedContent}</pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedContent);
                          toast.success("Đã sao chép nội dung!");
                        }}
                        className="absolute top-2 right-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        <ClipboardIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
