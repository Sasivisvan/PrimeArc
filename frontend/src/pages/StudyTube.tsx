import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';

interface YouTubeVideo {
    id: string;
    title: string;
    thumbnail: string;
    author: string;
    duration: string;
    views: number;
}

export default function StudyTube() {
    const { classLevel } = useUser();
    const [videos, setVideos] = useState<YouTubeVideo[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

    const fetchVideos = async (queryParam?: string) => {
        setLoading(true);
        setActiveVideoId(null);
        try {
            const q = queryParam || `Class ${classLevel} educational`;
            const res = await fetch(`http://localhost:5000/api/youtube-search?q=${encodeURIComponent(q)}`);
            if (res.ok) {
                const data = await res.json();
                setVideos(data);
            }
        } catch (err) {
            console.error("Failed to fetch youtube videos", err);
        }
        setLoading(false);
    };

    // Fetch default videos for the current class when the component loads or class changes
    useEffect(() => {
        fetchVideos(`Class ${classLevel} strictly educational concepts`);
    }, [classLevel]);

    const NON_EDU_WORDS = ['game', 'movie', 'song', 'music', 'prank', 'funny', 'trailer', 'esports', 'tiktok', 'mrbeast', 'gta', 'minecraft', 'skibidi'];

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        const isNonEdu = NON_EDU_WORDS.some(w => searchQuery.toLowerCase().includes(w));
        if (isNonEdu) {
            alert("This search appears to not be related to education! Get back to studying.");
            return;
        }

        // Prefix with class level and append strict negative logic to force YT's hand natively
        fetchVideos(`Class ${classLevel} ${searchQuery} educational lecture tutorial -game -prank -funny -movie -song -skit -minecraft -gta`);
    };

    return (
        <div style={{ padding: '20px', color: 'white', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', margin: '0 0 10px 0' }}>▶️ StudyTube</h1>
                    <p style={{ margin: 0, color: '#aaa', fontSize: '1.1rem' }}>Curated, distraction-free YouTube search for Class {classLevel}.</p>
                </div>

                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '500px' }}>
                    <input 
                        type="text" 
                        placeholder={`Search educational videos for Class ${classLevel}...`}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ flex: 1, padding: '12px 20px', borderRadius: '30px', border: '1px solid #444', backgroundColor: '#1a1a25', color: 'white', fontSize: '1rem' }}
                    />
                    <button type="submit" style={{ padding: '0 25px', borderRadius: '30px', border: 'none', backgroundColor: '#ff4d4d', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
                        Search
                    </button>
                </form>
            </div>

            {/* Video Player Section */}
            {activeVideoId && (
                <div style={{ marginBottom: '40px', backgroundColor: '#1a1a25', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                        <iframe 
                            src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowFullScreen 
                            title="StudyTube Player"
                        />
                    </div>
                    <div style={{ padding: '15px 20px', backgroundColor: '#2a2a35' }}>
                        <button 
                            onClick={() => setActiveVideoId(null)}
                            style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', padding: 0 }}
                        >
                            ✕ Close Player
                        </button>
                    </div>
                </div>
            )}

            {/* Video Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '100px 0', color: '#888', fontSize: '1.5rem' }}>
                    Searching YouTube... 🔍
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' }}>
                    {videos.map(video => (
                        <div 
                            key={video.id} 
                            onClick={() => setActiveVideoId(video.id)}
                            style={{ backgroundColor: '#2a2a35', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.4)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)'; }}
                        >
                            <div style={{ position: 'relative' }}>
                                <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.8)', color: 'white', padding: '3px 8px', borderRadius: '5px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    {video.duration}
                                </div>
                            </div>
                            
                            <div style={{ padding: '15px' }}>
                                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {video.title}
                                </h3>
                                <div style={{ color: '#aaa', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                                    <span style={{ fontWeight: 'bold', color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🧑‍🏫 {video.author}</span>
                                    <span>👁️ {video.views?.toLocaleString() || 'Many'} views</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {!loading && videos.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: '#666' }}>
                            <p style={{ fontSize: '1.2rem' }}>No videos found. Try a different search.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
