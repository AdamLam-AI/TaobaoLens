import React from 'react';
import { ProductAnalysis } from '../types';

interface ResultCardProps {
  analysis: ProductAnalysis;
  imageBase64: string;
  onReset?: () => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ analysis, imageBase64, onReset }) => {
  // Mapping of internal keys to Chinese labels
  const labelMap: Record<string, string> = {
    'Category': '类别',
    'Color': '颜色',
    'Feature': '特色',
    'Material': '材质',
    'Shape': '版型',
    'Style': '风格'
  };

  // Helper to render attribute tags
  const SpecRow = ({ label, value }: { label: string, value: string }) => (
    <div className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide w-24">{label}</span>
      <span className="text-xs font-semibold text-gray-700 text-right flex-1 truncate">{value}</span>
    </div>
  );

  // Strict display order requested: Category, Color, Feature, Material, Shape and Style.
  const PRIORITY_ORDER = ['Category', 'Color', 'Feature', 'Material', 'Shape', 'Style'];

  const handleSearch = () => {
    const taobaoUrl = `https://s.taobao.com/search?q=${encodeURIComponent(analysis.goldenTitle)}`;
    window.open(taobaoUrl, '_blank');
  };

  return (
    <div className="bg-transparent h-full flex flex-col">
        {/* Header with Traffic Tags */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-1.5 mb-2">
             <span className="px-2 py-0.5 bg-gray-900 text-white text-[10px] font-bold rounded uppercase">
                {analysis.category}
              </span>
              {analysis.marketingTags?.slice(0, 3).map((tag, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded border border-red-100">
                      {tag}
                  </span>
              ))}
          </div>
          <h2 className="text-lg font-bold text-gray-900 leading-snug line-clamp-1" title={analysis.productName}>
              {analysis.productName}
          </h2>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar space-y-4">
            
            {/* The Golden Title Strategy */}
            <div className="bg-gradient-to-br from-orange-50 via-white to-orange-50 p-3 rounded-xl border border-orange-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-orange-500/5 rounded-bl-3xl -mr-2 -mt-2"></div>
                <h3 className="text-[10px] font-extrabold text-orange-600 uppercase tracking-widest mb-1.5 flex items-center">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-1.5"></span>
                    搜索标题 (Search Identity)
                </h3>
                <p className="text-sm font-bold text-gray-800 leading-relaxed selection:bg-orange-200 break-words">
                    {analysis.goldenTitle}
                </p>
            </div>

            {/* Visual Specs Table - Ordered by Priority */}
            <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-100 pb-1">
                    视觉特征 (Visual Fingerprint)
                </h3>
                <div className="space-y-0.5">
                    {PRIORITY_ORDER.map((key) => {
                        const value = analysis.attributes?.[key] || 
                                     (key === 'Category' ? analysis.category :
                                      key === 'Color' ? analysis.color : 
                                      key === 'Shape' ? analysis.shape :
                                      key === 'Material' ? analysis.material :
                                      key === 'Feature' ? analysis.visualFeature :
                                      key === 'Style' ? analysis.style : null);
                        
                        if (value && value !== 'N/A') {
                            return <SpecRow key={key} label={labelMap[key] || key} value={value} />;
                        }
                        return null;
                    })}
                </div>
            </div>
            
            {analysis.detectedText && (
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">OCR Detected Model</span>
                    <p className="text-xs text-gray-700 font-mono break-all">{analysis.detectedText}</p>
                </div>
            )}
        </div>

        {/* Action Area */}
        <div className="mt-4 pt-3 border-t border-gray-100">
            <button
                onClick={handleSearch}
                className="w-full flex items-center justify-center px-4 py-3.5 bg-gradient-to-r from-[#ff5000] to-[#ff6000] hover:from-[#ff6000] hover:to-[#ff7000] text-white text-sm font-black rounded-xl shadow-lg shadow-orange-100 transition-all transform hover:-translate-y-0.5 uppercase tracking-widest"
            >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Result
            </button>
        </div>
    </div>
  );
};