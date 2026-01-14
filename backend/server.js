import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

// Initialize dotenv
dotenv.config();

// Initialize App
const app = express(); // Renamed to 'app' to avoid conflict with the import

// Middleware
app.use(cors());
app.use(express.json());

// const app = express();
const PORT = process.env.PORT || 5000;

// Basic Route
app.get("/", (req, res) => {
    res.send("Backend is running with LangChain.js ready.");
});

// Database Connection
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.log(err));

app.get("/addme", (req, res) => {
    
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
