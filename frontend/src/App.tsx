import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'https://auto-content-tool-c7qx.vercel.app';

function App() {
  const [formData, setFormData] = useState({
    product_description: '',
    gender: '',
    age_group: '',
    platform: '',
  });
  const [generatedContents, setGeneratedContents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setGeneratedContents([]);

    try {
      const formDataObj = new FormData();
      formDataObj.append('product_description', formData.product_description);
      formDataObj.append('gender', formData.gender);
      formDataObj.append('age_group', formData.age_group);
      formDataObj.append('platform', formData.platform);

      console.log('Đang gửi yêu cầu tới:', `${API_URL}/api/generate-content`);
      console.log('Dữ liệu:', Object.fromEntries(formDataObj.entries()));

      const response = await axios.post(`${API_URL}/api/generate-content`, formDataObj, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Phản hồi:', response.data);

      if (response.data.status === 'success' && Array.isArray(response.data.contents)) {
        setGeneratedContents(response.data.contents);
      } else {
        setError(response.data.error || 'Định dạng phản hồi không hợp lệ');
        console.error('Phản hồi không hợp lệ:', response.data);
      }
    } catch (err: any) {
      console.error('Chi tiết lỗi:', err);
      let errorMessage = 'Không thể tạo nội dung. ';
      
      if (err.response) {
        console.error('Phản hồi lỗi:', err.response.data);
        errorMessage += err.response.data.error || err.response.data.message || err.message;
      } else if (err.request) {
        errorMessage += 'Không nhận được phản hồi từ máy chủ. Vui lòng kiểm tra kết nối.';
      } else {
        errorMessage += err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Lỗi khi sao chép:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white mx-8 md:mx-0 shadow rounded-3xl sm:p-10">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">Công Cụ Tạo Nội Dung AI</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Mô tả sản phẩm</label>
                    <textarea
                      name="product_description"
                      value={formData.product_description}
                      onChange={handleChange}
                      rows={4}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      required
                      placeholder="Nhập mô tả chi tiết về sản phẩm của bạn"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Giới tính</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Chọn giới tính</option>
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Độ tuổi</label>
                    <select
                      name="age_group"
                      value={formData.age_group}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Chọn độ tuổi</option>
                      <option value="18-22">18-22 (Sinh viên, mới đi làm)</option>
                      <option value="23-28">23-28 (Phát triển sự nghiệp)</option>
                      <option value="29-35">29-35 (Sự nghiệp ổn định)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nền tảng</label>
                    <select
                      name="platform"
                      value={formData.platform}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Chọn nền tảng</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Blog">Blog</option>
                      <option value="Magazine">Tạp chí</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                  >
                    {loading ? 'Đang tạo...' : 'Tạo nội dung'}
                  </button>
                </form>

                {error && (
                  <div className="mt-4 text-red-600 text-sm">
                    {error}
                  </div>
                )}

                {Array.isArray(generatedContents) && generatedContents.length > 0 && (
                  <div className="mt-6 space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Nội dung đã tạo:</h3>
                    {generatedContents.map((content, index) => (
                      <div key={index} className="relative mt-2 p-4 bg-gray-50 rounded-md">
                        <div className="absolute top-2 right-2">
                          <button
                            onClick={() => handleCopy(content, index)}
                            className="px-3 py-1 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            {copiedIndex === index ? 'Đã sao chép!' : 'Sao chép'}
                          </button>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-2">Phiên bản {index + 1}:</h4>
                        <pre className="whitespace-pre-wrap text-sm">{content}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
