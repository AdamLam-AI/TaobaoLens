import React, { useRef, useState } from 'react';
import heic2any from 'heic2any';

interface ImageUploaderProps {
  onImagesSelected: (images: { base64: string; previewUrl: string }[]) => void;
  onPdfSelected?: (file: File) => void;
  disabled?: boolean;
  label?: string;
  accept?: string;
  maxFiles?: number;
  className?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  onImagesSelected, 
  onPdfSelected,
  disabled, 
  label = "Click to upload or drag & drop",
  accept = "image/*,.heic,.heif,.pdf",
  maxFiles = 20,
  className = ""
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      processFiles(Array.from(files));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFiles = async (files: File[]) => {
    if (files.length > maxFiles) {
      alert(`You can only upload a maximum of ${maxFiles} items at a time.`);
      return;
    }

    const pdfFile = files.find(f => f.type === 'application/pdf');
    if (pdfFile && onPdfSelected) {
      onPdfSelected(pdfFile);
      if (files.length === 1) return; 
    }

    setIsConverting(true);
    try {
      const promises = files
        .filter(file => 
          file.type.startsWith('image/') || 
          file.name.toLowerCase().endsWith('.heic') || 
          file.name.toLowerCase().endsWith('.heif')
        )
        .map(async (file) => {
          let targetFile: File | Blob = file;

          if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            const converted = await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.8
            });
            targetFile = Array.isArray(converted) ? converted[0] : converted;
          }

          return new Promise<{ base64: string; previewUrl: string }>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              const base64Data = result.split(',')[1];
              resolve({ base64: base64Data, previewUrl: result });
            };
            reader.readAsDataURL(targetFile);
          });
        });

      const results = await Promise.all(promises);
      if (results.length > 0) {
        onImagesSelected(results);
      }
    } catch (error) {
      console.error("File processing error:", error);
      alert("Failed to process some images.");
    } finally {
      setIsConverting(false);
    }
  };

  // Expose processFiles for external use (like Paste in App)
  const handleExternalFiles = (files: File[]) => {
    processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(Array.from(files));
    }
  };

  return (
    <div
      onClick={() => !disabled && fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300
        ${isDragging ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-400 hover:bg-gray-50/50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        multiple
        className="hidden"
        disabled={disabled}
      />
      
      <div className="flex flex-col items-center text-gray-400 text-center p-6">
        {isConverting ? (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-3"></div>
            <p className="text-sm font-medium text-gray-600">Processing & Converting...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-orange-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-700 mb-1">{label}</p>
            <p className="text-xs text-gray-400 max-w-[200px]">Supports JPEG, PNG, HEIC, PDF and Ctrl+V Paste</p>
          </>
        )}
      </div>
    </div>
  );
};