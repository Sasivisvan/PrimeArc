import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    completed: { type: Boolean, default: false },
    scope: { type: String, enum: ['personal', 'class'], default: 'personal' },
    classLevel: { type: Number }, // Only required if scope is 'class'
    createdBy: { type: String }, // username of who created it
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    dueDate: { type: Date },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Task", TaskSchema);
