import React, { useState, useEffect, useCallback } from 'react';
import ExcelJS from 'exceljs';
import { ImageUploader } from './components/ImageUploader';
import { ResultCard } from './components/ResultCard';
import { analyzeProductImage } from './services/gemini';
import { extractImagesFromPdf } from './services/pdf';
import { AppState, AnalyzedItem, ProductAnalysis } from './types';
import heic2any from 'heic2any';

function App() {
  const [items, setItems] = useState<AnalyzedItem[]>([]);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const cropImage = async (base64: string, box: number[]): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const [ymin, xmin, ymax, xmax] = box;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(`data:image/jpeg;base64,${base64}`);

        const width = Math.max(1, (xmax - xmin) * img.width / 1000);
        const height = Math.max(1, (ymax - ymin) * img.height / 1000);
        const left = (xmin * img.width / 1000);
        const top = (ymin * img.height / 1000);

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = `data:image/jpeg;base64,${base64}`;
    });
  };

  const handleImagesSelected = useCallback(async (newImages: { base64: string; previewUrl: string }[]) => {
    const newItems: AnalyzedItem[] = newImages.map((img) => ({
      id: crypto.randomUUID(),
      base64: img.base64,
      previewUrl: img.previewUrl,
      status: 'pending',
      result: null,
    }));

    setItems((prev) => [...prev, ...newItems]);
    setAppState(AppState.PROCESSING);

    for (const item of newItems) {
      await processImageEntry(item);
    }

    setAppState(AppState.FINISHED);
  }, []);

  const handlePdfOrImageSelected = async (file: File) => {
    setIsProcessingFile(true);
    try {
      if (file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer();
        const extractedImages = await extractImagesFromPdf(buffer);
        if (extractedImages.length > 0) {
          await handleImagesSelected(extractedImages);
        }
      } else {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const result = e.target?.result as string;
          const base64 = result.split(',')[1];
          await handleImagesSelected([{ base64, previewUrl: result }]);
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error("Processing Error:", error);
      alert("Error processing file.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const processImageEntry = async (item: AnalyzedItem) => {
    setItems((prev) => 
      prev.map((i) => (i.id === item.id ? { ...i, status: 'analyzing' } : i))
    );

    try {
      const results: ProductAnalysis[] = await analyzeProductImage(item.base64);
      
      if (results.length === 0) throw new Error("No products detected.");

      const processedResults = await Promise.all(results.map(async (res, idx) => {
        let finalPreview = item.previewUrl;
        if (res.boundingBox) {
          finalPreview = await cropImage(item.base64, res.boundingBox);
        }
        return {
          id: idx === 0 ? item.id : crypto.randomUUID(),
          base64: item.base64,
          previewUrl: finalPreview,
          status: 'success' as const,
          result: res,
        };
      }));

      setItems((prev) => {
        const itemIndex = prev.findIndex(i => i.id === item.id);
        if (itemIndex === -1) return prev;
        const nextItems = [...prev];
        nextItems.splice(itemIndex, 1, ...processedResults);
        return nextItems;
      });

    } catch (err) {
      console.error(err);
      setItems((prev) => 
        prev.map((i) => (i.id === item.id ? { ...i, status: 'error', error: "Separation Failed" } : i))
      );
    }
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      const files: File[] = [];
      for (let i = 0; i < clipboardItems.length; i++) {
        if (clipboardItems[i].type.indexOf('image') !== -1) {
          const file = clipboardItems[i].getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        setIsProcessingFile(true);
        const processed = await Promise.all(files.map(async (file) => {
          let targetFile: File | Blob = file;
          if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            const converted = await heic2any({ blob: file, toType: 'image/jpeg' });
            targetFile = Array.isArray(converted) ? converted[0] : converted;
          }
          return new Promise<{base64: string, previewUrl: string}>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve({ base64: res.split(',')[1], previewUrl: res });
            };
            reader.readAsDataURL(targetFile);
          });
        }));
        await handleImagesSelected(processed);
        setIsProcessingFile(false);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleImagesSelected]);

  const resetApp = () => { setItems([]); setAppState(AppState.IDLE); };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Taobao_Sourcing');

    // Define columns to match requested template + Photo column
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 5 },
      { header: 'Photo', key: 'photo', width: 15 },
      { header: 'Golden Title', key: 'goldenTitle', width: 40 },
      { header: 'Product Name', key: 'productName', width: 25 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Sub-Category', key: 'subCategory', width: 15 },
      { header: 'Color', key: 'color', width: 10 },
      { header: 'Feature', key: 'feature', width: 15 },
      { header: 'Material', key: 'material', width: 15 },
      { header: 'Shape', key: 'shape', width: 10 },
      { header: 'Style', key: 'style', width: 10 },
      { header: 'Link', key: 'link', width: 15 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    const successItems = items.filter(i => i.status === 'success' && i.result);

    for (let i = 0; i < successItems.length; i++) {
      const item = successItems[i];
      const res = item.result!;
      const rowNumber = i + 2;
      
      const searchUrl = `https://s.taobao.com/search?q=${encodeURIComponent(res.goldenTitle || '')}`;

      const row = worksheet.addRow({
        id: i + 1,
        photo: '', // Placeholder for image
        goldenTitle: res.goldenTitle,
        productName: res.productName,
        category: res.category,
        subCategory: res.subCategory,
        color: res.attributes?.['Color'] || '',
        feature: res.attributes?.['Feature'] || '',
        material: res.attributes?.['Material'] || '',
        shape: res.attributes?.['Shape'] || '',
        style: res.attributes?.['Style'] || '',
        link: { text: 'Open Link', hyperlink: searchUrl }
      });

      // Increase row height to fit the image
      row.height = 80;
      row.alignment = { vertical: 'middle', horizontal: 'center' };

      // Embed image
      try {
        const imageId = workbook.addImage({
          base64: item.previewUrl,
          extension: 'jpeg',
        });

        worksheet.addImage(imageId, {
          tl: { col: 1, row: rowNumber - 1 },
          ext: { width: 100, height: 100 },
          editAs: 'oneCell'
        });
      } catch (err) {
        console.error("Failed to embed image for row", rowNumber, err);
      }
    }

    // Generate buffer and trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Taobao_Sourcing_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-900 selection:bg-orange-100">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 group">
            <div className="w-9 h-9 bg-gradient-to-br from-[#ff5000] to-red-500 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-orange-200 group-hover:scale-105 transition-transform">T</div>
            <h1 className="text-xl font-black text-gray-900 tracking-tighter uppercase">Taobao<span className="text-[#ff5000]">Lens</span></h1>
          </div>
          {items.length > 0 && (
            <div className="flex items-center space-x-4">
              <button onClick={resetApp} className="text-sm font-bold text-gray-400 hover:text-red-500 transition-colors">RESET</button>
              <div className="h-6 w-px bg-gray-100"></div>
              <button onClick={exportToExcel} className="hidden sm:block text-sm font-bold text-green-600 hover:text-green-700 transition-colors uppercase tracking-widest">Excel Export</button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {items.length === 0 ? (
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <div className="mb-10 inline-flex items-center space-x-2 bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100">
               <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
               <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Multi-Product Extraction Enabled</span>
            </div>
            <h2 className="text-5xl font-black text-gray-900 mb-4 tracking-tighter uppercase leading-[0.9]">Taobao item <br/><span className="text-[#ff5000]">search engine</span></h2>
            <p className="text-gray-500 text-lg mb-12 max-w-xl mx-auto font-medium">Upload photos with multiple products. Our AI separates them one by one into independent listings.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              <div className="bg-white p-8 rounded-[32px] shadow-2xl shadow-gray-200/50 border border-gray-100 flex flex-col group hover:border-orange-200 transition-all">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Manual Upload</h3>
                  <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 font-bold">1</div>
                </div>
                <ImageUploader 
                  onImagesSelected={handleImagesSelected} 
                  label="Drop an image here" 
                  className="h-64"
                />
              </div>

              <div className="bg-white p-8 rounded-[32px] shadow-2xl shadow-gray-200/50 border border-gray-100 flex flex-col group hover:border-red-200 transition-all">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">split image</h3>
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 font-bold">2</div>
                </div>
                <ImageUploader 
                  onImagesSelected={handleImagesSelected} 
                  onPdfSelected={handlePdfOrImageSelected}
                  accept="image/*,.pdf"
                  label="Separate multi-Items photo"
                  className="h-64 border-red-100"
                  disabled={isProcessingFile}
                />
              </div>
            </div>
            
            <p className="mt-8 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Press <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-200 text-gray-800">Ctrl + V</kbd> anywhere to start separation</p>
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="bg-white p-5 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6 mb-12 sticky top-24 z-40 backdrop-blur-md bg-white/90">
                <div className="flex items-center space-x-6 w-full sm:w-auto">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Separation Progress</span>
                      <span className="text-lg font-black text-gray-900">{items.filter(i => i.status === 'success').length} <span className="text-gray-300">/</span> {items.length} Products</span>
                    </div>
                    <div className="flex-1 sm:w-64 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-700 ease-out" 
                          style={{ width: `${(items.filter(i => i.status === 'success').length / items.length) * 100}%` }}
                        ></div>
                    </div>
                </div>
                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <button onClick={exportToExcel} className="flex-1 sm:flex-none px-8 py-3 bg-gray-900 text-white text-xs font-black rounded-2xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 uppercase tracking-widest">Export All</button>
                  <button onClick={resetApp} className="p-3 text-gray-400 hover:text-red-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
            </div>

            <div className="space-y-8">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white p-8 rounded-[40px] shadow-2xl shadow-gray-200/40 border border-gray-50 animate-fade-in transition-all hover:border-orange-200/50">
                  <div className="lg:col-span-3">
                    <div className="relative aspect-square rounded-[32px] overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center shadow-inner group">
                      <img src={item.previewUrl} alt="Separated Product" className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500" />
                      {item.status === 'analyzing' && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center">
                          <div className="relative w-12 h-12">
                             <div className="absolute inset-0 border-4 border-orange-100 rounded-full"></div>
                             <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                          <span className="mt-4 text-[10px] font-black text-orange-600 uppercase tracking-widest">Extracting...</span>
                        </div>
                      )}
                      {item.status === 'error' && (
                        <div className="absolute inset-0 bg-red-50/90 flex items-center justify-center p-4 text-center">
                           <p className="text-[10px] font-black text-red-600 uppercase">Analysis Failed</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="lg:col-span-9">
                    {item.status === 'success' && item.result ? (
                      <ResultCard analysis={item.result} imageBase64={item.base64} />
                    ) : (
                      <div className="h-full flex flex-col justify-center space-y-6">
                        <div className="space-y-2">
                           <div className="h-8 bg-gray-50 rounded-xl w-1/3 animate-pulse"></div>
                           <div className="h-4 bg-gray-50 rounded-lg w-1/4 animate-pulse"></div>
                        </div>
                        <div className="h-32 bg-gray-50/50 rounded-3xl w-full animate-pulse"></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 flex flex-col items-center">
                <div className="h-12 w-px bg-gradient-to-b from-gray-200 to-transparent"></div>
                <button 
                  onClick={() => document.documentElement.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="mt-4 text-[10px] font-black text-gray-400 hover:text-orange-500 transition-colors uppercase tracking-[0.3em]"
                >
                  Upload More Content
                </button>
            </div>
          </div>
        )}
      </main>
      
      <footer className="py-12 px-6 mt-10 border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center text-gray-400 text-[10px] font-bold uppercase tracking-widest">
           <div className="mb-4 md:mb-0">Powered by Gemini Pro Vision API &bull; AI-Powered Sourcing</div>
           <div className="flex space-x-6">
              <a href="#" className="hover:text-orange-500">About Separation</a>
              <a href="#" className="hover:text-orange-500">API Status</a>
              <a href="#" className="hover:text-orange-500">Privacy</a>
           </div>
        </div>
      </footer>
    </div>
  );
}

export default App;