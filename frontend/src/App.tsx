import React, { useState, useRef } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function App() {
  const [formData, setFormData] = useState({
    image_url: '',
    product_description: '',
    gender: '',
    age_group: '',
    platform: '',
  });
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setFormData(prev => ({ ...prev, image_url: '' })); // Clear image URL when file is selected
    }
  };

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(null); // Clear selected file when URL is entered
    setFormData(prev => ({ ...prev, image_url: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formDataObj = new FormData();
      
      // Add file if selected, otherwise add image URL
      if (selectedFile) {
        formDataObj.append('file', selectedFile);
      } else if (formData.image_url) {
        formDataObj.append('image_url', formData.image_url);
      }

      // Add other form data
      formDataObj.append('product_description', formData.product_description);
      formDataObj.append('gender', formData.gender);
      formDataObj.append('age_group', formData.age_group);
      formDataObj.append('platform', formData.platform);

      const response = await axios.post(`${API_URL}/api/generate-content`, formDataObj, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.status === 'success') {
        setGeneratedContent(response.data.content);
      } else {
        setError(response.data.message || 'An error occurred');
      }
    } catch (err) {
      setError('Failed to generate content. Please try again.');
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

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white mx-8 md:mx-0 shadow rounded-3xl sm:p-10">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h2 className="text-2xl font-bold mb-8 text-center text-gray-900">AI Content Generator</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Image Upload</label>
                    <div className="mt-1 flex items-center space-x-4">
                      <input
                        type="file"
                        onChange={handleFileSelect}
                        accept="image/*"
                        ref={fileInputRef}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Choose File
                      </button>
                      {selectedFile && (
                        <span className="text-sm text-gray-500">{selectedFile.name}</span>
                      )}
                    </div>
                  </div>

                  <div className="- or -">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Or</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Image URL</label>
                    <input
                      type="text"
                      name="image_url"
                      value={formData.image_url}
                      onChange={handleImageUrlChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="https://example.com/image.jpg"
                      disabled={!!selectedFile}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Product Description</label>
                    <textarea
                      name="product_description"
                      value={formData.product_description}
                      onChange={handleChange}
                      rows={4}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Gender</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Age Group</label>
                    <select
                      name="age_group"
                      value={formData.age_group}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Select age group</option>
                      <option value="18-22">18-22 (Students, Early Career)</option>
                      <option value="23-28">23-28 (Career Development)</option>
                      <option value="29-35">29-35 (Established Professionals)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Platform</label>
                    <select
                      name="platform"
                      value={formData.platform}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Select platform</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Blog">Blog</option>
                      <option value="Magazine">Magazine</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                  >
                    {loading ? 'Generating...' : 'Generate Content'}
                  </button>
                </form>

                {error && (
                  <div className="mt-4 text-red-600 text-sm">
                    {error}
                  </div>
                )}

                {generatedContent && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900">Generated Content:</h3>
                    <div className="mt-2 p-4 bg-gray-50 rounded-md">
                      <pre className="whitespace-pre-wrap">{generatedContent}</pre>
                    </div>
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
