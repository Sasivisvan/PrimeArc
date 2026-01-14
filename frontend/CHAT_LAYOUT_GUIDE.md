# Guide: Building a Chat Layout with Navigation and Right Panel

This guide explains how to structure a modern 3-column chat interface using React and CSS Flexbox.

## 1. The High-Level Concept

Most chat applications (like Discord, Slack, or ChatGPT) use a "Holy Grail" layout or a Flexbox row layout. We want the screen to be split into three horizontal sections:

1.  **Left Sidebar (Navigation):** For switching between chats or tools.
2.  **Middle (Main Chat):** The active conversation history and input.
3.  **Right Panel (Context/Info):** Details about the current chat, settings, or AI parameters.

## 2. Component Structure (React)

Think of your layout active hierarchy like this:

```tsx
<AppContainer>      {/* CSS: display: flex; height: 100vh; */}
  <NavBar />        {/* Left side, fixed width */}
  <ChatArea />      {/* Middle, flex-grow: 1 (takes available space) */}
  <RightPanel />    {/* Right side, fixed width */}
</AppContainer>
```

## 3. Implementation Steps

### Step A: The Container
The container needs to fill the entire browser window and align its children side-by-side.

**CSS:**
```css
/* App.css or layout classes */
.app-container {
  display: flex;        /* Aligns children in a row */
  flex-direction: row;  /* Explicitly side-by-side */
  height: 100vh;        /* 100% of the viewport height */
  width: 100vw;         /* 100% of the viewport width */
  overflow: hidden;     /* Prevents full-page scrolling */
}
```

### Step B: The Component Styles

#### 1. The Navigation Bar (Left)
Usually a fixed width.

```css
.nav-bar {
  width: 260px;           /* Fixed width */
  background-color: #202123; /* Dark theme example */
  color: white;
  display: flex;
  flex-direction: column; /* Stack items vertically inside */
  border-right: 1px solid #444;
}
```

#### 2. The Main Chat Area (Middle)
This needs to be flexible. It should grab all the space remaining after the Left and Right panels take their share.

```css
.chat-main {
  flex: 1;                /* "Grow" to fill available space */
  display: flex;
  flex-direction: column; /* Stack messages and input vertically */
  background-color: #343541;
  position: relative;
}

/* Inside the chat area, you often have a scrollable message list */
.message-list {
  flex: 1;                /* Push input box to the bottom */
  overflow-y: auto;       /* Allow scrolling only here */
  padding: 20px;
}

.input-area {
  min-height: 100px;      /* Fixed space for typing */
}
```

#### 3. The Right Panel
Similar to the sidebar, but often togglable (can be shown or hidden).

```css
.right-panel {
  width: 300px;
  background-color: #202123;
  border-left: 1px solid #444;
}
```

### Step C: React Implementation Example

Here is how you might structure this in `App.tsx`:

```tsx
import { useState } from 'react';
import './App.css'; 

function App() {
  const [showRightPanel, setShowRightPanel] = useState(true);

  return (
    <div className="app-container">
      
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
          style={{position: 'absolute', top: 10, right: 10}}
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
```

## 4. Key Takeaways for Mobile Response

If you want this to work on mobile, you usually don't show all 3 columns at once. You would use **CSS Media Queries** to hide the operational panels active on smaller screens:

```css
@media (max-width: 768px) {
  .nav-bar, .right-panel {
    display: none; /* Hide sidebars on mobile by default */
    /* Or make them absolute position 'drawers' that slide in */
  }
}
```
