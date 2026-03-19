import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'primearc_resources';

const CATEGORIES = ['All', 'Study', 'Tools', 'Videos', 'Articles', 'Docs', 'Other'];
const CATEGORY_ICONS: Record<string, string> = {
    'Study': '📚', 'Tools': '🔧', 'Videos': '🎬',
    'Articles': '📰', 'Docs': '📄', 'Other': '🔗'
};
const MAX_FILE_SIZE_MB = 10;

interface AttachedFile {
    name: string;
    type: string;
    size: number;
    dataUrl: string;
}

interface Resource {
    id: string;
    title: string;
    url?: string;
    file?: AttachedFile;
    isFileResource: boolean;
    category: string;
    description: string;
    createdAt: number;
}

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type === 'application/pdf') return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    return '📎';
};

const isValidUrl = (url: string) => {
    try { new URL(url); return true; } catch { return false; }
};

const getDomain = (url: string) => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
};

const MyResources = () => {
    const [resources, setResources] = useState<Resource[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [activeCategory, setActiveCategory] = useState('All');
    const [showForm, setShowForm] = useState(false);
    const [addMode, setAddMode] = useState<'link' | 'file'>('link');
    const [form, setForm] = useState({ title: '', url: '', category: 'Study', description: '' });
    const [urlError, setUrlError] = useState('');
    const [fileError, setFileError] = useState('');
    const [selectedFile, setSelectedFile] = useState<AttachedFile | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resources));
    }, [resources]);

    const handleFormChange = (field: keyof typeof form, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (field === 'url') setUrlError('');
    };

    const readFile = (file: File): Promise<AttachedFile> =>
        new Promise((resolve, reject) => {
            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                reject(new Error(`File exceeds ${MAX_FILE_SIZE_MB}MB limit.`));
                return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result as string });
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const handleFileDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (!file) return;
        setFileError('');
        try { setSelectedFile(await readFile(file)); }
        catch (err: any) { setFileError(err.message); }
    };

    const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileError('');
        try { setSelectedFile(await readFile(file)); }
        catch (err: any) { setFileError(err.message); }
        e.target.value = '';
    };

    const addResource = () => {
        if (addMode === 'link') {
            if (!form.title.trim() || !form.url.trim()) return;
            const urlToCheck = form.url.startsWith('http') ? form.url : `https://${form.url}`;
            if (!isValidUrl(urlToCheck)) { setUrlError('Please enter a valid URL'); return; }
            const res: Resource = {
                id: Date.now().toString(),
                title: form.title.trim(),
                url: urlToCheck,
                isFileResource: false,
                category: form.category,
                description: form.description.trim(),
                createdAt: Date.now(),
            };
            setResources(prev => [res, ...prev]);
        } else {
            if (!selectedFile) { setFileError('Please select a file.'); return; }
            const res: Resource = {
                id: Date.now().toString(),
                title: form.title.trim() || selectedFile.name,
                file: selectedFile,
                isFileResource: true,
                category: form.category,
                description: form.description.trim(),
                createdAt: Date.now(),
            };
            setResources(prev => [res, ...prev]);
        }
        setForm({ title: '', url: '', category: 'Study', description: '' });
        setSelectedFile(null);
        setShowForm(false);
        setUrlError('');
        setFileError('');
    };

    const downloadFile = (f: AttachedFile) => {
        const a = document.createElement('a');
        a.href = f.dataUrl;
        a.download = f.name;
        a.click();
    };

    const deleteResource = (id: string) => setResources(prev => prev.filter(r => r.id !== id));

    const filtered = activeCategory === 'All'
        ? resources
        : resources.filter(r => r.category === activeCategory);

    const categoryCounts = CATEGORIES.reduce((acc, cat) => {
        acc[cat] = cat === 'All' ? resources.length : resources.filter(r => r.category === cat).length;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Resources</h1>
                    <p className="page-subtitle">{resources.length} resource{resources.length !== 1 ? 's' : ''} saved</p>
                </div>
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? '✕ Cancel' : '+ Add Resource'}
                </button>
            </div>

            {/* Add Form */}
            {showForm && (
                <div className="glass-card add-form">
                    {/* Mode Toggle */}
                    <div className="mode-toggle">
                        <button
                            className={`mode-btn ${addMode === 'link' ? 'active' : ''}`}
                            onClick={() => { setAddMode('link'); setFileError(''); setSelectedFile(null); }}
                        >🔗 Add Link</button>
                        <button
                            className={`mode-btn ${addMode === 'file' ? 'active' : ''}`}
                            onClick={() => { setAddMode('file'); setUrlError(''); }}
                        >📎 Upload File</button>
                    </div>

                    <div className="form-row" style={{ gap: '12px' }}>
                        <input
                            className="form-input"
                            placeholder={addMode === 'file' ? 'Title (uses filename if blank)' : 'Title *'}
                            value={form.title}
                            onChange={e => handleFormChange('title', e.target.value)}
                            style={{ flex: 2 }}
                        />
                        <select className="form-select" value={form.category} onChange={e => handleFormChange('category', e.target.value)} style={{ flex: 1 }}>
                            {CATEGORIES.filter(c => c !== 'All').map(cat => (
                                <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {cat}</option>
                            ))}
                        </select>
                    </div>

                    {addMode === 'link' ? (
                        <div>
                            <input
                                className={`form-input ${urlError ? 'input-error' : ''}`}
                                placeholder="URL * (e.g. youtube.com/watch?v=...)"
                                value={form.url}
                                onChange={e => handleFormChange('url', e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addResource()}
                            />
                            {urlError && <span className="error-msg">{urlError}</span>}
                        </div>
                    ) : (
                        <div>
                            {/* Drag & Drop Zone */}
                            <div
                                className={`drop-zone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleFileDrop}
                                onClick={() => !selectedFile && fileInputRef.current?.click()}
                            >
                                {selectedFile ? (
                                    <div className="drop-zone-preview">
                                        {selectedFile.type.startsWith('image/') ? (
                                            <img src={selectedFile.dataUrl} alt="" className="preview-thumb" />
                                        ) : (
                                            <div className="file-icon-large">{fileIcon(selectedFile.type)}</div>
                                        )}
                                        <div className="file-info">
                                            <span className="file-name">{selectedFile.name}</span>
                                            <span className="file-size-label">{formatSize(selectedFile.size)}</span>
                                        </div>
                                        <button
                                            className="icon-btn-ghost"
                                            onClick={e => { e.stopPropagation(); setSelectedFile(null); setFileError(''); }}
                                        >✕</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="drop-icon">⬆️</div>
                                        <p className="drop-text">Drop a file here or <span className="drop-browse">browse</span></p>
                                        <p className="drop-hint">Max {MAX_FILE_SIZE_MB}MB · Any file type</p>
                                    </>
                                )}
                                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFilePick} />
                            </div>
                            {fileError && <span className="error-msg">{fileError}</span>}
                        </div>
                    )}

                    <input
                        className="form-input"
                        placeholder="Description (optional)"
                        value={form.description}
                        onChange={e => handleFormChange('description', e.target.value)}
                    />
                    <div className="form-row" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn-primary" onClick={addResource}>
                            {addMode === 'file' ? '⬆ Upload & Save' : 'Save Resource'}
                        </button>
                    </div>
                </div>
            )}

            {/* Category Filter */}
            <div className="filter-tabs" style={{ flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat =>
                    categoryCounts[cat] > 0 || cat === 'All' ? (
                        <button
                            key={cat}
                            className={`filter-tab ${activeCategory === cat ? 'active' : ''}`}
                            onClick={() => setActiveCategory(cat)}
                        >
                            {cat !== 'All' && CATEGORY_ICONS[cat]} {cat}
                            <span className="filter-count">{categoryCounts[cat]}</span>
                        </button>
                    ) : null
                )}
            </div>

            {/* Resources Grid */}
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">🔗</div>
                    <p>{activeCategory !== 'All' ? `No ${activeCategory} resources yet.` : 'Save your first resource!'}</p>
                </div>
            ) : (
                <div className="resources-grid">
                    {filtered.map(res => (
                        <div key={res.id} className="resource-card glass-card">
                            <div className="resource-card-header">
                                <div className="resource-favicon">
                                    {res.isFileResource
                                        ? (res.file?.type.startsWith('image/')
                                            ? <img src={res.file.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                                            : <span style={{ fontSize: '1.2rem' }}>{fileIcon(res.file?.type || '')}</span>)
                                        : <img src={`https://www.google.com/s2/favicons?domain=${getDomain(res.url!)}&sz=32`} alt=""
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    }
                                </div>
                                <div className="resource-meta">
                                    <span className="resource-title">{res.title}</span>
                                    <span className="resource-domain">
                                        {res.isFileResource
                                            ? `${res.file?.type || 'file'} · ${formatSize(res.file?.size || 0)}`
                                            : getDomain(res.url!)}
                                    </span>
                                </div>
                                <span className="category-badge">{CATEGORY_ICONS[res.category]} {res.category}</span>
                            </div>

                            {res.description && <p className="resource-desc">{res.description}</p>}

                            <div className="resource-actions">
                                {res.isFileResource ? (
                                    <button className="btn-link" onClick={() => res.file && downloadFile(res.file)}>
                                        ⬇ Download File
                                    </button>
                                ) : (
                                    <a href={res.url} target="_blank" rel="noopener noreferrer" className="btn-link">
                                        Open Link ↗
                                    </a>
                                )}
                                <button className="btn-danger icon-btn" onClick={() => deleteResource(res.id)}>🗑</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MyResources;
