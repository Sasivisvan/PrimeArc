import { useState } from "react";
import { useNavigate } from 'react-router-dom'; // 1. Import the hook
import "./App.css";

function App() {
    const [showRightPanel, setShowRightPanel] = useState(true);
    const navigate = useNavigate(); // 2. Initialize the hook
    return (
        <div className="app-container">
            <nav className="top-nav-bar">
                <h2>Chats</h2>
                <button onClick={() => navigate("/tasks")}>Tasks</button>
                <button onClick={() => navigate("/notes")}>Notes</button>
                <button onClick={() => navigate("/MyResources")}>Myresources</button>
            </nav>
            {/* 1. Left Navigation */}
            <nav className="nav-bar">
                <h2>Chats</h2>
                <ul>
                    <li>Chat 1</li>
                    <li>Chat 2</li>
                </ul>
            </nav>

            {/* 2. Main Chat Window */}
            <main className="chat-main">
                <div className="message-list">
                    {/* Messages go here */}
                    <div className="msg">User: Hello!</div>
                    <div className="msg">AI: Hi there.</div>
                </div>

                <div className="input-area">
                    <input type="text" placeholder="Send a message..." />
                </div>

                {/* Button to toggle right panel could go in a header active inside main */}
                <button
                    style={{ position: "absolute", top: 10, right: 10 }}
                    onClick={() => setShowRightPanel(!showRightPanel)}
                >
                    Toggle Info
                </button>
            </main>

            {/* 3. Right Sidebar */}
            {showRightPanel && (
                <aside className="right-panel">
                    <h3>Chat Details</h3>
                    <p>Model: GPT-4</p>
                    <p>Temperature: 0.7</p>
                </aside>
            )}
        </div>
    );
}

export default App;
