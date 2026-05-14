/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, ChangeEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Wand2, Scissors, Trash2, History, Download, X, Layers, Maximize, Crop, User, Coins } from 'lucide-react';
import { analyzeImageWithGemini, processImageTask } from './services/geminiService';
import { saasService, SaasUser, SaasTool } from './services/saasService';

interface DetectedObject {
  id: number;
  name: string;
  box_2d: number[];
}

interface HistoryItem {
  id: string;
  original: string;
  processed: string;
  task: string;
  object: string;
  timestamp: number;
  quality: string;
  ratio: string;
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [processing, setProcessing] = useState<number[] | null>(null);
  const [analysis, setAnalysis] = useState<DetectedObject[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [quality, setQuality] = useState('2k');
  const [ratio, setRatio] = useState('1:1');

  const [saasUser, setSaasUser] = useState<SaasUser | null>(null);
  const [saasTool, setSaasTool] = useState<SaasTool | null>(null);

  useEffect(() => {
    const handleInit = (event: MessageEvent) => {
      if (event.data?.type === 'SAAS_INIT') {
        const { userId, toolId } = event.data;
        if (userId && toolId && userId !== 'null' && toolId !== 'null') {
          saasService.init(userId, toolId);
          loadSaasInfo();
        }
      }
    };

    window.addEventListener('message', handleInit);
    return () => window.removeEventListener('message', handleInit);
  }, []);

  const loadSaasInfo = async () => {
    const data = await saasService.launch();
    if (data) {
      setSaasUser(data.user);
      setSaasTool(data.tool);
    }
  };

  const saveToHistory = (item: HistoryItem) => {
    const newHistory = [item, ...history].slice(0, 20);
    setHistory(newHistory);
  };

  const downloadImage = (dataUrl: string, name: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `SmartCut_${name.replace(/\s+/g, '_')}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setPreviewImage(null);
        setAnalysis(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
      if (!image) return;
      setLoading(true);
      try {
          const data = await analyzeImageWithGemini(image);
          setAnalysis(data);
      } catch (err) {
          console.error(err);
      } finally {
          setLoading(false);
      }
  };

  const handleTask = async (task: 'cutout' | 'remove', objects: DetectedObject[]) => {
      if (!image || objects.length === 0) return;

      // 1. Verify
      const verification = await saasService.verify();
      if (!verification.success) {
          alert(verification.message || "Integral verification failed.");
          return;
      }

      setProcessing(objects.map(o => o.id));
      try {
          const names = objects.map(o => o.name);
          const boxes = objects.map(o => o.box_2d);
          
          // 2. Generate (AI)
          const result = await processImageTask(image, task, names, boxes, quality, ratio);
          const finalImage = result && result.startsWith('data:') ? result : image;
          
          // 3. Consume
          const consumption = await saasService.consume();
          if (consumption.success) {
            if (consumption.data) {
                setSaasUser(prev => prev ? { ...prev, integral: consumption.data!.currentIntegral } : null);
            }
            
            // 4. Persistence
            if (finalImage.startsWith('data:')) {
                await saasService.saveResultImage(finalImage);
            }
          }

          const newItem: HistoryItem = {
            id: Math.random().toString(36).substr(2, 9),
            original: image,
            processed: finalImage,
            task: task === 'cutout' ? 'One-click Cutout' : `Remove ${objects.length} Objects`,
            object: names.join(', '),
            timestamp: Date.now(),
            quality,
            ratio
          };
          saveToHistory(newItem);
          setPreviewImage(finalImage);
          setSelectedIds([]);
          alert(`Successfully performed ${task} on ${names.join(', ')}.`);
      } catch (err) {
          console.error(err);
          alert("Failed to process image. Please try again.");
      } finally {
          setProcessing(null);
      }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd] p-4 md:p-8 font-sans text-neutral-900 selection:bg-neutral-200">
      <header className="mx-auto mb-12 flex max-w-6xl items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950">SmartCut AI</h1>
          <p className="mt-1 text-neutral-500">Professional asset optimization powered by Gemini 3.1</p>
        </div>

        <div className="flex items-center gap-6">
          {saasUser && (
            <div className="flex items-center gap-4 rounded-full bg-white px-4 py-1.5 shadow-sm ring-1 ring-neutral-100">
               <div className="flex items-center gap-2 border-r border-neutral-100 pr-4">
                 <div className="flex size-7 items-center justify-center rounded-full bg-neutral-900 text-white">
                   <User size={14} />
                 </div>
                 <span className="text-sm font-semibold">{saasUser.name}</span>
               </div>
               <div className="flex items-center gap-2 text-neutral-600">
                 <Coins size={16} className="text-amber-500" />
                 <span className="text-sm font-bold">{saasUser.integral}</span>
                 {saasTool && <span className="text-[10px] text-neutral-400">/ {saasTool.integral} pts per use</span>}
               </div>
            </div>
          )}
          
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="relative flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-5 py-2 text-sm font-medium transition hover:bg-neutral-50"
          >
            <History size={18} />
            History
            {history.length > 0 && (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] text-white">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Editor */}
        <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] bg-neutral-100 ring-1 ring-neutral-200 shadow-inner">
                {!image ? (
                    <div className="flex h-full flex-col items-center justify-center p-12 text-center">
                        <div className="mb-6 flex size-20 items-center justify-center rounded-[2rem] bg-white shadow-xl ring-1 ring-neutral-200">
                           <Upload className="size-8 text-neutral-900" />
                        </div>
                        <h2 className="mb-2 text-xl font-semibold">Upload your source material</h2>
                        <p className="mb-8 max-w-xs text-neutral-500 leading-relaxed">High-resolution images work best for clean cutouts and removals.</p>
                        <input type="file" onChange={handleFileUpload} className="hidden" id="file-upload" accept="image/*" />
                        <label htmlFor="file-upload" className="cursor-pointer rounded-full bg-neutral-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 active:scale-95 shadow-lg shadow-neutral-200">
                          Choose File
                        </label>
                    </div>
                ) : (
                    <>
                        <img 
                          src={previewImage || image} 
                          alt="Stage" 
                          className="h-full w-full cursor-zoom-in object-contain" 
                          onClick={() => setFullScreenImage(previewImage || image)}
                        />
                        
                        <div className="absolute right-4 top-4 flex gap-2">
                           {previewImage && (
                             <button 
                              onClick={() => setPreviewImage(null)}
                              className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-bold backdrop-blur-md transition hover:bg-white"
                             >
                               Reset View
                             </button>
                           )}
                           <button 
                            onClick={() => { setImage(null); setPreviewImage(null); setAnalysis(null); }} 
                            className="flex size-10 items-center justify-center rounded-full bg-white/80 backdrop-blur-md text-neutral-600 transition hover:bg-white hover:text-neutral-900 shadow-sm"
                           >
                              <X size={20} />
                           </button>
                        </div>

                        {previewImage && (
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900/10 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-900 backdrop-blur-sm">
                            Preview Mode
                          </div>
                        )}
                    </>
                )}
            </div>

            {/* Controls Bar */}
            <AnimatePresence>
              {image && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap items-center gap-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-100"
                >
                  <div className="flex items-center gap-3">
                    <Maximize size={18} className="text-neutral-400" />
                    <div className="flex gap-2">
                       {[
                         { id: '1k', label: '1K' },
                         { id: '2k', label: '2K' },
                         { id: '4k', label: '4K' }
                       ].map(q => (
                         <button 
                          key={q.id} 
                          onClick={() => setQuality(q.id)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${quality === q.id ? 'bg-neutral-900 text-white shadow-md' : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'}`}
                         >
                           {q.label}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-l border-neutral-100 pl-6">
                    <Crop size={18} className="text-neutral-400" />
                    <div className="flex gap-2">
                       {['1:1', '3:4', '4:3', '16:9'].map(r => (
                         <button 
                          key={r} 
                          onClick={() => setRatio(r)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${ratio === r ? 'bg-neutral-900 text-white shadow-md' : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'}`}
                         >
                           {r}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="ml-auto flex gap-3">
                    {previewImage && (
                      <button 
                        onClick={() => downloadImage(previewImage, "Result")}
                        className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-6 py-2.5 text-sm font-semibold transition hover:bg-neutral-50"
                      >
                        <Download size={18} />
                        Download
                      </button>
                    )}
                    <button 
                        onClick={analyzeImage}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-200 shadow-lg shadow-neutral-100"
                    >
                        <Wand2 size={18} />
                        {loading ? "Analyzing..." : "Analyze Image"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
        </div>

        {/* Right Column: Object List */}
        <aside className="lg:col-span-4 h-fit sticky top-8">
            <div className="rounded-[2rem] bg-white p-8 shadow-xl shadow-neutral-100 ring-1 ring-neutral-100">
                <div className="mb-6 flex items-center gap-3">
                    <Layers size={22} className="text-neutral-900" />
                    <h3 className="text-lg font-bold">Object Analysis</h3>
                </div>

                {!analysis ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-400">
                        <Wand2 size={32} className="mb-4 opacity-20" />
                        <p className="text-sm">Click 'Analyze Image' to detect objects automatically</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                            <span className="text-sm font-medium text-neutral-500">{selectedIds.length} items selected</span>
                            {selectedIds.length > 0 && (
                                <button 
                                    onClick={() => handleTask('remove', analysis.filter(o => selectedIds.includes(o.id)))}
                                    disabled={processing !== null}
                                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                                >
                                    <Trash2 size={14} />
                                    Remove Selection
                                </button>
                            )}
                        </div>
                        <ul className="space-y-4">
                            {analysis.map((obj) => (
                              <li 
                                key={obj.id} 
                                onClick={() => toggleSelect(obj.id)}
                                className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all hover:shadow-md ${selectedIds.includes(obj.id) ? 'border-neutral-900 bg-neutral-900/5 ring-1 ring-neutral-900 shadow-md' : 'border-neutral-100 bg-neutral-50/50 hover:border-neutral-200 hover:bg-white'}`}
                              >
                                  <div className="mb-4 flex items-start justify-between">
                                      <div className="flex flex-col gap-1">
                                          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Detection #{obj.id}</span>
                                          <span className="text-base font-semibold text-neutral-800 capitalize">{obj.name}</span>
                                      </div>
                                      <div className={`flex size-5 items-center justify-center rounded border transition-colors ${selectedIds.includes(obj.id) ? 'bg-neutral-900 border-neutral-900' : 'bg-white border-neutral-200'}`}>
                                          {selectedIds.includes(obj.id) && <div className="size-2 rounded-full bg-white" />}
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
                                      <button 
                                        onClick={() => handleTask('cutout', [obj])}
                                        disabled={processing !== null}
                                        className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-bold ring-1 ring-neutral-200 transition hover:bg-neutral-900 hover:text-white hover:ring-neutral-900 shadow-sm disabled:opacity-50"
                                      >
                                          <Scissors size={14} />
                                          {processing?.includes(obj.id) ? "Working..." : "一键抠图"}
                                      </button>
                                      <button 
                                        onClick={() => handleTask('remove', [obj])}
                                        disabled={processing !== null}
                                        className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-600 hover:text-white shadow-sm disabled:opacity-50"
                                      >
                                          <Trash2 size={14} />
                                          {processing?.includes(obj.id) ? "Working..." : "去除物体"}
                                      </button>
                                  </div>
                              </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </aside>
      </main>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 z-40 bg-neutral-950/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-md bg-white p-8 shadow-2xl"
            >
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-2xl font-bold">History</h2>
                <button onClick={() => setShowHistory(false)} className="rounded-full bg-neutral-100 p-2 text-neutral-500 hover:bg-neutral-200">
                  <X size={20} />
                </button>
              </div>

              {history.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-center text-neutral-400">
                  <History size={48} className="mb-4 opacity-20" />
                  <p>No processed images yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6 overflow-y-auto pb-8 pr-1 max-h-[calc(100vh-160px)]">
                  {history.map((item) => (
                    <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                      <div 
                        className="mb-4 aspect-video cursor-zoom-in overflow-hidden rounded-lg bg-neutral-200 transition hover:opacity-90"
                        onClick={() => setFullScreenImage(item.processed)}
                      >
                        <img src={item.processed} alt="History Item" className="h-full w-full object-cover" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-neutral-900">{item.task}</span>
                          <span className="text-[10px] text-neutral-400">{new Date(item.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs text-neutral-500">Object: <span className="font-semibold text-neutral-700">{item.object}</span> • {item.quality} • {item.ratio}</p>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => { setPreviewImage(item.processed); setShowHistory(false); }}
                          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold ring-1 transition ${previewImage === item.processed ? 'bg-neutral-900 text-white ring-neutral-900' : 'bg-white text-neutral-900 ring-neutral-200 hover:bg-neutral-50'}`}
                        >
                          {previewImage === item.processed ? 'Viewing' : 'View'}
                        </button>
                        <button 
                          onClick={() => downloadImage(item.processed, `${item.task}_${item.object}`)}
                          className="flex items-center justify-center gap-2 rounded-xl bg-neutral-900 py-2.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
                        >
                          <Download size={14} />
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Full-screen Preview Modal */}
      <AnimatePresence>
        {fullScreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-neutral-950/95 backdrop-blur-xl p-4 md:p-12"
          >
             <button 
                onClick={() => setFullScreenImage(null)}
                className="absolute right-6 top-6 flex size-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <X size={24} />
              </button>
              
              <div className="relative flex h-full w-full flex-col items-center justify-center gap-8">
                 <motion.img 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  src={fullScreenImage} 
                  alt="Full-screen preview" 
                  className="h-full max-h-[85vh] w-full object-contain shadow-2xl"
                 />
                 <button 
                  onClick={() => downloadImage(fullScreenImage, "Full_Resolution")}
                  className="flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold text-neutral-900 shadow-xl transition hover:bg-neutral-100 active:scale-95"
                 >
                   <Download size={20} />
                   Download High Resolution
                 </button>
              </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

